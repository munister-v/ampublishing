import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const SITE_URL = 'https://ampublishing.org';
const today = new Date().toISOString().slice(0, 10);

const staticRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/catalog', changefreq: 'weekly', priority: '0.9' },
  { path: '/our-authors', changefreq: 'monthly', priority: '0.8' },
  { path: '/authors', changefreq: 'monthly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/media', changefreq: 'weekly', priority: '0.7' },
  { path: '/radio', changefreq: 'weekly', priority: '0.6' },
  { path: '/services', changefreq: 'monthly', priority: '0.6' },
];

const escapeXml = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const readBooks = async language => {
  const path = `public/content/books.${language}.json`;
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    console.warn(`[sitemap] Cannot read ${path}: ${error.message}`);
    return [];
  }
};

const booksById = new Map();
const safeLastmod = value => {
  if (!value || value > today) return today;
  return value;
};

for (const language of ['ru', 'en', 'de']) {
  for (const book of await readBooks(language)) {
    if (!book?.id || booksById.has(book.id)) continue;
    booksById.set(book.id, {
      path: `/product/${encodeURIComponent(book.id)}`,
      changefreq: 'monthly',
      priority: '0.9',
      lastmod: safeLastmod(book.releaseDate),
    });
  }
}

const routes = [
  ...staticRoutes.map(route => ({ ...route, lastmod: today })),
  ...Array.from(booksById.values()),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map(route => `  <url>
    <loc>${escapeXml(`${SITE_URL}${route.path}`)}</loc>
    <lastmod>${escapeXml(route.lastmod)}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

await writeFile('public/sitemap.xml', xml);
console.log(`[sitemap] Wrote ${routes.length} URLs to public/sitemap.xml`);
