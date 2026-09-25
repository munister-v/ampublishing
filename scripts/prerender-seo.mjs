// Post-build: write a static HTML shell for every public URL with its own
// <title>, description, canonical, hreflang, Open Graph / Twitter tags and
// schema.org JSON-LD — plus a plain-text rendition of the page inside #root.
//
// Why: the site is a SPA on GitHub Pages. Telegram / Facebook / WhatsApp
// link previews and non-rendering crawlers only read the raw HTML, so before
// this every book and event shared as the generic homepage card. React
// replaces the #root content on mount, so visitors never see the fallback.
//
// Replaces the old generate-route-shells.mjs (which copied index.html as-is).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  SITE_URL,
  LANGS,
  OG_LOCALES,
  ROUTE_SEO,
  mergeSeoSettings,
  absoluteUrl,
  resolveRouteMeta,
  resolveBookMeta,
  resolveNewsMeta,
  buildOrganizationSchema,
  buildWebsiteSchema,
  buildBreadcrumbSchema,
  buildBookSchema,
  buildNewsSchema,
  buildItemListSchema,
  crumbsForPath,
  getBookPath,
  getNewsPath,
  isPublicNews,
  plainText,
  clip,
} from '../seo/core.mjs';

// The shells are rendered in Russian: it is the source language of every
// book and event, and the audience that shares links (Telegram) reads it.
const LANG = 'ru';
const distDir = path.resolve('dist');
const contentDir = path.resolve('public/content');

const readJson = async (file, fallback) => {
  const full = path.join(contentDir, file);
  if (!existsSync(full)) return fallback;
  try {
    return JSON.parse(await readFile(full, 'utf8'));
  } catch (error) {
    console.warn(`[prerender] cannot parse ${file}: ${error.message}`);
    return fallback;
  }
};

const esc = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

// JSON inside <script> must not be able to close the tag.
const jsonLd = value => `<script type="application/ld+json">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`;

const settings = mergeSeoSettings(await readJson('seo.json', null));
const site = await readJson('site-settings.json', null);
const books = await readJson(`books.${LANG}.json`, []);
const news = (await readJson(`news.${LANG}.json`, [])).filter(item => isPublicNews(item));
const template = await readFile(path.join(distDir, 'index.html'), 'utf8');

// Strip every tag this script owns from the template head, keep the rest
// (charset, viewport, fonts, preload, the built JS/CSS).
const OWNED = [
  /\s*<title>[\s\S]*?<\/title>/g,
  /\s*<meta\s+name="(description|robots|googlebot|keywords|author|twitter:[^"]+)"[^>]*>/g,
  /\s*<meta\s+property="(og:[^"]+|book:[^"]+|article:[^"]+)"[^>]*>/g,
  /\s*<link\s+rel="(canonical|alternate)"[^>]*>/g,
  /\s*<!-- (Open Graph|Twitter)[^>]*-->/g,
];
const baseHtml = OWNED.reduce((html, pattern) => html.replace(pattern, ''), template);

const organization = buildOrganizationSchema(settings, site);
const website = buildWebsiteSchema(settings, LANG);

const verificationTags = [
  ['google-site-verification', settings.verification.google],
  ['msvalidate.01', settings.verification.bing],
  ['yandex-verification', settings.verification.yandex],
  ['p:domain_verify', settings.verification.pinterest],
  ['facebook-domain-verification', settings.verification.facebookDomain],
].filter(([, value]) => value).map(([name, value]) => `<meta name="${name}" content="${esc(value)}" />`);

const headFor = ({ meta, canonicalPath, schemas, extraMeta = [] }) => {
  const canonical = `${SITE_URL}${canonicalPath}`;
  const image = absoluteUrl(meta.image, settings.defaultImage);
  const ogType = meta.type === 'book' ? 'book' : meta.type === 'article' ? 'article' : 'website';
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${meta.robots}" />`,
    `<meta name="googlebot" content="${meta.robots}" />`,
    `<meta name="keywords" content="${esc(settings.keywords)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}" />`,
    ...LANGS.map(lang => `<link rel="alternate" hreflang="${lang}" href="${esc(`${canonical}?lang=${lang}`)}" />`),
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="${esc(settings.siteName)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:alt" content="${esc(meta.imageAlt || meta.title)}" />`,
    `<meta property="og:locale" content="${OG_LOCALES[LANG]}" />`,
    ...LANGS.filter(lang => lang !== LANG).map(lang => `<meta property="og:locale:alternate" content="${OG_LOCALES[lang]}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
    settings.twitterHandle ? `<meta name="twitter:site" content="${esc(settings.twitterHandle)}" />` : '',
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    ...extraMeta,
    ...verificationTags,
    ...schemas.filter(Boolean).map(jsonLd),
  ].filter(Boolean).join('\n    ');
};

const PRERENDER_STYLE = `<style>.prerender{max-width:760px;margin:0 auto;padding:96px 24px;font-family:Manrope,system-ui,sans-serif;color:#040F1E;line-height:1.6;opacity:0;animation:prerender-in .2s 2.5s forwards}.prerender h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:2.4rem;line-height:1.1}.prerender img{max-width:240px;height:auto}.prerender a{color:inherit}@keyframes prerender-in{to{opacity:1}}</style>`;

const navLinks = () => {
  const items = (site?.headerNav || []).filter(item => item.enabled !== false && item.path?.startsWith('/'));
  const labels = { '/catalog': 'Каталог', '/our-authors': 'Наши авторы', '/authors': 'Авторам', '/services': 'Услуги', '/about': 'О нас', '/media': 'Мероприятия', '/radio': 'Радио' };
  return `<nav><a href="/">${esc(settings.siteName)}</a> · ${items.map(item => `<a href="${esc(item.path)}">${esc(labels[item.path] || item.path)}</a>`).join(' · ')}</nav>`;
};

const paragraphs = text =>
  plainText(text) ? String(text).split(/\n+/).map(line => plainText(line)).filter(Boolean).map(line => `<p>${esc(line)}</p>`).join('') : '';

const bodyFor = inner => `<div class="prerender">${navLinks()}<main>${inner}</main></div>`;

const HERO_PRELOAD = /\s*<link rel="preload" as="image" href="\/images\/home-hero\.webp"[^>]*>/;

const renderPage = ({ html, head, body, home = false }) =>
  (home ? html : html.replace(HERO_PRELOAD, ''))
    .replace(/<html lang="[a-z]+">/, `<html lang="${LANG}">`)
    .replace('</head>', `    ${head}\n    ${PRERENDER_STYLE}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);

const writeShell = async (route, content) => {
  const target = route === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, decodeURIComponent(route).replace(/^\/+|\/+$/g, ''), 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
};

const breadcrumb = (canonicalPath, leaf) =>
  canonicalPath === '/' ? null : buildBreadcrumbSchema(LANG, crumbsForPath(LANG, canonicalPath, leaf));

let count = 0;

// ── Static routes ──────────────────────────────────────────────────────────
const bookLinks = books.map(book => `<li><a href="${esc(getBookPath(book))}">${esc(book.title)}</a>${book.author ? ` — ${esc(book.author)}` : ''}</li>`).join('');
const newsLinks = news.map(item => `<li><a href="${esc(getNewsPath(item))}">${esc(item.title)}</a> <time datetime="${esc(item.date)}">${esc(item.date)}</time></li>`).join('');

for (const route of [...Object.keys(ROUTE_SEO), '/shop']) {
  const meta = resolveRouteMeta(route, LANG, settings);
  const listSchema = meta.path === '/catalog'
    ? buildItemListSchema(books.map(book => ({ path: getBookPath(book), name: book.title })), meta.title)
    : meta.path === '/media'
      ? buildItemListSchema(news.map(item => ({ path: getNewsPath(item), name: item.title })), meta.title)
      : null;
  const list = meta.path === '/' || meta.path === '/catalog'
    ? `<ul>${bookLinks}</ul>`
    : meta.path === '/media' ? `<ul>${newsLinks}</ul>` : '';
  const head = headFor({ meta, canonicalPath: meta.path, schemas: [organization, website, breadcrumb(meta.path), listSchema] });
  const body = bodyFor(`<h1>${esc(meta.title)}</h1><p>${esc(meta.description)}</p>${list}`);
  await writeShell(route, renderPage({ html: baseHtml, head, body, home: meta.path === '/' }));
  count++;
}

// ── Books (main URL + every alias, aliases canonicalise to the main URL) ──
for (const book of books) {
  if (!book?.id) continue;
  const meta = resolveBookMeta(book, settings);
  const isbn = (book.variants || []).find(variant => variant.isbn)?.isbn;
  const head = headFor({
    meta,
    canonicalPath: meta.path,
    schemas: [organization, breadcrumb(meta.path, book.title), buildBookSchema(book, settings)],
    extraMeta: [
      book.author ? `<meta property="book:author" content="${esc(book.author)}" />` : '',
      isbn ? `<meta property="book:isbn" content="${esc(isbn)}" />` : '',
      book.releaseDate ? `<meta property="book:release_date" content="${esc(book.releaseDate)}" />` : '',
    ],
  });
  const cover = book.coverUrl ? `<img src="${esc(absoluteUrl(book.coverUrl))}" alt="${esc(meta.imageAlt)}" width="240" />` : '';
  const about = (book.story?.about || []).map(part => `<p>${esc(plainText(part))}</p>`).join('');
  const body = bodyFor(`<article><h1>${esc(book.title)}</h1>${book.author ? `<p>${esc(book.author)}</p>` : ''}${cover}${paragraphs(book.description)}${about}<p><a href="/catalog">← Каталог</a></p></article>`);
  const html = renderPage({ html: baseHtml, head, body });
  for (const route of new Set([book.id, ...(book.aliases || [])])) {
    await writeShell(`/product/${route}`, html);
    count++;
  }
}

// ── News / events ──────────────────────────────────────────────────────────
for (const item of news) {
  if (!item?.id) continue;
  const meta = resolveNewsMeta(item, settings);
  const blocksText = (item.blocks || []).map(block => block.text || '').join('\n');
  const head = headFor({
    meta,
    canonicalPath: meta.path,
    schemas: [organization, breadcrumb(meta.path, item.title), ...buildNewsSchema(item, settings, LANG)],
    extraMeta: [`<meta property="article:published_time" content="${esc(item.publishAt || item.date)}" />`],
  });
  const image = item.imageUrl ? `<img src="${esc(absoluteUrl(item.imageUrl))}" alt="${esc(meta.imageAlt)}" />` : '';
  const body = bodyFor(`<article><h1>${esc(item.title)}</h1><time datetime="${esc(item.date)}">${esc(item.date)}</time>${image}${paragraphs(item.preview)}${paragraphs(item.body || blocksText)}<p><a href="/media">← Мероприятия</a></p></article>`);
  await writeShell(getNewsPath(item), renderPage({ html: baseHtml, head, body }));
  count++;
}

// ── 404: same chrome, never indexed ───────────────────────────────────────
const notFound = path.join(distDir, '404.html');
if (existsSync(notFound)) {
  const html = await readFile(notFound, 'utf8');
  if (!html.includes('noindex')) {
    await writeFile(notFound, html.replace('<head>', '<head>\n    <meta name="robots" content="noindex" />'));
  }
}

console.log(`[prerender] wrote ${count} SEO shells (${books.length} books, ${news.length} events) — ${clip(settings.siteName, 40)}`);
