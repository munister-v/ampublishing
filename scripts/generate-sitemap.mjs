// Pre-build: public/sitemap.xml with every indexable static page, book and
// public event — hreflang alternates (?lang=ru|en|de) and image entries for
// covers so Google Images can pick them up.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  SITE_URL,
  LANGS,
  ROUTE_SEO,
  mergeSeoSettings,
  absoluteUrl,
  getBookPath,
  getNewsPath,
  isPublicNews,
} from '../seo/core.mjs';

const today = new Date().toISOString().slice(0, 10);

const escapeXml = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const readJson = async (path, fallback) => {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    console.warn(`[sitemap] Cannot read ${path}: ${error.message}`);
    return fallback;
  }
};

const settings = mergeSeoSettings(await readJson('public/content/seo.json', null));
const safeDate = value => {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : today;
};

const routes = [];

for (const [path, config] of Object.entries(ROUTE_SEO)) {
  if (config.sitemap === false || settings.pages?.[path]?.noindex) continue;
  routes.push({ path, changefreq: config.changefreq || 'monthly', priority: config.priority || '0.5', lastmod: today, images: [] });
}

const seenBooks = new Set();
for (const language of LANGS) {
  for (const book of await readJson(`public/content/books.${language}.json`, [])) {
    if (!book?.id || seenBooks.has(book.id) || book.seo?.noindex) continue;
    seenBooks.add(book.id);
    routes.push({
      path: getBookPath(book),
      changefreq: 'monthly',
      priority: '0.9',
      lastmod: safeDate(book.releaseDate),
      images: book.coverUrl ? [{ loc: absoluteUrl(book.coverUrl), title: book.title }] : [],
    });
  }
}

const seenNews = new Set();
for (const language of LANGS) {
  for (const item of await readJson(`public/content/news.${language}.json`, [])) {
    if (!item?.id || seenNews.has(item.id) || !isPublicNews(item) || item.seo?.noindex) continue;
    seenNews.add(item.id);
    routes.push({
      path: getNewsPath(item),
      changefreq: 'yearly',
      priority: '0.6',
      lastmod: safeDate(item.publishAt || item.date),
      images: item.imageUrl ? [{ loc: absoluteUrl(item.imageUrl), title: item.title }] : [],
    });
  }
}

const url = route => {
  const loc = `${SITE_URL}${route.path}`;
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${route.lastmod}</lastmod>`,
    `    <changefreq>${route.changefreq}</changefreq>`,
    `    <priority>${route.priority}</priority>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(loc)}"/>`,
    ...LANGS.map(lang => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${escapeXml(`${loc}?lang=${lang}`)}"/>`),
    ...route.images.map(image => `    <image:image><image:loc>${escapeXml(image.loc)}</image:loc><image:title>${escapeXml(image.title || '')}</image:title></image:image>`),
    '  </url>',
  ].join('\n');
};

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${routes.map(url).join('\n')}
</urlset>
`;

await writeFile('public/sitemap.xml', xml);
console.log(`[sitemap] Wrote ${routes.length} URLs (${seenBooks.size} books, ${seenNews.size} events)`);
