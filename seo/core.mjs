// Shared SEO core — used by the React <SEO /> component at runtime AND by
// scripts/prerender-seo.mjs at build time, so the HTML a crawler downloads
// and the DOM Google renders carry exactly the same titles, descriptions and
// structured data. Plain ESM (no TS) so Node can import it without a build.

export const SITE_URL = 'https://ampublishing.org';
export const LANGS = ['ru', 'en', 'de'];
export const OG_LOCALES = { ru: 'ru_RU', en: 'en_US', de: 'de_DE' };

export const DEFAULT_SEO_SETTINGS = {
  siteName: 'AM Publishing Berlin',
  titleTemplate: '%s | AM Publishing Berlin',
  defaultImage: '/images/home-hero.webp',
  keywords:
    'AM Publishing Berlin, independent publisher, literary publisher, contemporary prose, psychological fiction, Russian literature, books from Berlin, русские книги Берлин, издательство Берлин',
  twitterHandle: '',
  organization: {
    legalName: 'AM Publishing Berlin',
    foundingDate: '',
    city: 'Berlin',
    country: 'DE',
  },
  verification: {
    google: '',
    bing: '',
    yandex: '',
    pinterest: '',
    facebookDomain: '',
  },
  pages: {},
};

/**
 * Built-in per-route texts. `seo.json → pages[path][lang]` overrides any of
 * them from the admin; empty override fields fall back to these.
 */
export const ROUTE_SEO = {
  '/': {
    fullTitle: true,
    changefreq: 'weekly', priority: '1.0',
    ru: { title: 'AM Publishing Berlin — независимое литературное издательство', description: 'AM Publishing Berlin — независимое издательство современной литературной прозы из Берлина. Психологическая проза, русскоязычные книги, доставка по всему миру.' },
    en: { title: 'AM Publishing Berlin | Independent Literary Publisher', description: 'AM Publishing Berlin is an independent publisher of contemporary literary prose, psychological fiction, and Russian-language books with worldwide delivery.' },
    de: { title: 'AM Publishing Berlin | Unabhängiger Literaturverlag', description: 'AM Publishing Berlin ist ein unabhängiger Verlag für zeitgenössische literarische Prosa, psychologische Romane und russischsprachige Bücher – mit weltweitem Versand.' },
  },
  '/catalog': {
    changefreq: 'weekly', priority: '0.9',
    ru: { title: 'Каталог книг', description: 'Все книги AM Publishing Berlin: современная литературная проза, психологические романы, новинки и предзаказы с доставкой по Европе и миру.' },
    en: { title: 'Book Catalog', description: 'Browse AM Publishing books: literary prose, psychological fiction, new releases and pre-orders with delivery across Europe and worldwide.' },
    de: { title: 'Bücherkatalog', description: 'Alle Bücher von AM Publishing Berlin: literarische Prosa, psychologische Romane, Neuerscheinungen und Vorbestellungen mit Versand in Europa und weltweit.' },
  },
  '/our-authors': {
    changefreq: 'monthly', priority: '0.8',
    ru: { title: 'Наши авторы', description: 'Авторы AM Publishing Berlin: современные литературные голоса, психологическая проза и автофикшн на русском языке.' },
    en: { title: 'Our Authors', description: 'Meet the authors of AM Publishing Berlin: contemporary literary voices, psychological prose, autofiction and modern Russian-language literature.' },
    de: { title: 'Unsere Autorinnen und Autoren', description: 'Die Autorinnen und Autoren von AM Publishing Berlin: zeitgenössische literarische Stimmen, psychologische Prosa und moderne russischsprachige Literatur.' },
  },
  '/authors': {
    changefreq: 'monthly', priority: '0.8',
    ru: { title: 'Авторам — как издать книгу', description: 'Как издать книгу в AM Publishing Berlin: что мы публикуем, как подать рукопись и как проходит работа с редакцией.' },
    en: { title: 'For Authors — Submit a Manuscript', description: 'How to publish with AM Publishing Berlin: what we publish, how to submit a manuscript, and how editorial work is organised.' },
    de: { title: 'Für Autoren — Manuskript einreichen', description: 'So veröffentlichen Sie bei AM Publishing Berlin: was wir verlegen, wie Sie ein Manuskript einreichen und wie das Lektorat arbeitet.' },
  },
  '/about': {
    changefreq: 'monthly', priority: '0.7',
    ru: { title: 'О издательстве', description: 'AM Publishing Berlin — независимое издательство: редакционная работа, внимание к тексту и красивые книги как объект.' },
    en: { title: 'About Us', description: 'AM Publishing Berlin is an independent literary publisher focused on contemporary prose, editorial care and beautiful book objects.' },
    de: { title: 'Über uns', description: 'AM Publishing Berlin ist ein unabhängiger Literaturverlag mit Fokus auf zeitgenössische Prosa, sorgfältiges Lektorat und schöne Buchobjekte.' },
  },
  '/media': {
    changefreq: 'weekly', priority: '0.7',
    ru: { title: 'Мероприятия издательства', description: 'Презентации, чтения, встречи с авторами и новости AM Publishing Berlin.' },
    en: { title: 'Events & News', description: 'Book launches, readings, author meetings and news from AM Publishing Berlin.' },
    de: { title: 'Veranstaltungen & News', description: 'Buchpremieren, Lesungen, Autorengespräche und Neuigkeiten von AM Publishing Berlin.' },
  },
  '/radio': {
    changefreq: 'weekly', priority: '0.6',
    ru: { title: 'Радио AM Publishing', description: 'Радио AM Publishing: прямые эфиры, подкасты и разговоры о литературе, авторах и книгах.' },
    en: { title: 'AM Publishing Radio', description: 'AM Publishing Radio: live broadcasts, podcasts and conversations about literature, authors and books.' },
    de: { title: 'AM Publishing Radio', description: 'AM Publishing Radio: Live-Sendungen, Podcasts und Gespräche über Literatur, Autoren und Bücher.' },
  },
  '/services': {
    changefreq: 'monthly', priority: '0.7',
    ru: { title: 'Издательские услуги', description: 'Редактура, корректура, вёрстка, дизайн обложки и выпуск книги под ключ в AM Publishing Berlin.' },
    en: { title: 'Publishing Services', description: 'Editing, proofreading, typesetting, cover design and end-to-end book production from AM Publishing Berlin.' },
    de: { title: 'Verlagsdienstleistungen', description: 'Lektorat, Korrektorat, Satz, Umschlaggestaltung und Buchproduktion aus einer Hand bei AM Publishing Berlin.' },
  },
  '/services/order': {
    changefreq: 'monthly', priority: '0.5',
    ru: { title: 'Заявка на издательские услуги', description: 'Отправьте рукопись или запрос — редакция AM Publishing Berlin оценит проект и предложит условия.' },
    en: { title: 'Request Publishing Services', description: 'Send a manuscript or a request — the AM Publishing Berlin team will review your project and send an estimate.' },
    de: { title: 'Verlagsleistungen anfragen', description: 'Senden Sie Ihr Manuskript oder Ihre Anfrage — AM Publishing Berlin prüft Ihr Projekt und erstellt ein Angebot.' },
  },
  '/tracking': {
    robots: 'noindex,follow', sitemap: false,
    ru: { title: 'Отслеживание посылки', description: 'Отследить посылку AM Publishing Berlin (DHL).' },
    en: { title: 'Track Your Parcel', description: 'Track a parcel sent by AM Publishing Berlin via DHL.' },
    de: { title: 'Sendungsverfolgung', description: 'Verfolgen Sie ein Paket von AM Publishing Berlin (DHL).' },
  },
  '/privacy': {
    robots: 'noindex,follow', sitemap: false,
    ru: { title: 'Политика конфиденциальности', description: 'Политика конфиденциальности и защита данных AM Publishing Berlin.' },
    en: { title: 'Privacy Policy', description: 'Privacy policy and data protection information for AM Publishing Berlin.' },
    de: { title: 'Datenschutzerklärung', description: 'Datenschutzerklärung von AM Publishing Berlin.' },
  },
  '/terms': {
    robots: 'noindex,follow', sitemap: false,
    ru: { title: 'Условия', description: 'Условия использования и продажи AM Publishing Berlin.' },
    en: { title: 'Terms', description: 'Terms and conditions for AM Publishing Berlin.' },
    de: { title: 'AGB', description: 'Allgemeine Geschäftsbedingungen von AM Publishing Berlin.' },
  },
  '/impressum': {
    robots: 'noindex,follow', sitemap: false,
    ru: { title: 'Impressum', description: 'Юридическая информация AM Publishing Berlin.' },
    en: { title: 'Impressum', description: 'Legal notice for AM Publishing Berlin.' },
    de: { title: 'Impressum', description: 'Impressum von AM Publishing Berlin.' },
  },
};

export const ROUTE_ALIASES = { '/shop': '/catalog' };

export const BREADCRUMB_LABELS = {
  ru: { catalog: 'Каталог', product: 'Каталог', authors: 'Авторам', 'our-authors': 'Авторы', about: 'О нас', media: 'Мероприятия', news: 'Мероприятия', radio: 'Радио', services: 'Услуги', order: 'Заявка', home: 'Главная' },
  en: { catalog: 'Catalog', product: 'Catalog', authors: 'For Authors', 'our-authors': 'Authors', about: 'About', media: 'Events', news: 'Events', radio: 'Radio', services: 'Services', order: 'Request', home: 'Home' },
  de: { catalog: 'Katalog', product: 'Katalog', authors: 'Für Autoren', 'our-authors': 'Autoren', about: 'Über uns', media: 'Veranstaltungen', news: 'Veranstaltungen', radio: 'Radio', services: 'Leistungen', order: 'Anfrage', home: 'Start' },
};

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

export const mergeSeoSettings = incoming => {
  const base = JSON.parse(JSON.stringify(DEFAULT_SEO_SETTINGS));
  if (!isObject(incoming)) return base;
  return {
    ...base,
    ...incoming,
    organization: { ...base.organization, ...(incoming.organization || {}) },
    verification: { ...base.verification, ...(incoming.verification || {}) },
    pages: isObject(incoming.pages) ? incoming.pages : {},
  };
};

// Admin uploads are sometimes stored as raw.githubusercontent links — the same
// files are served from our own domain, which is what crawlers should index.
const RAW_REPO_PREFIX = /^https:\/\/raw\.githubusercontent\.com\/munister-v\/ampublishing\/main\/public\//;

export const absoluteUrl = (path, fallback = DEFAULT_SEO_SETTINGS.defaultImage) => {
  const value = String(path || fallback || '').replace(RAW_REPO_PREFIX, '/');
  if (!value) return SITE_URL;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('data:')) return absoluteUrl(fallback);
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`;
};

/** Strip the light markdown used by <Prose> and collapse whitespace. */
export const plainText = value =>
  String(value || '')
    .replace(/^\s*(#{1,6}|>|[-–—•])\s+/gm, '')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Cut to ~maxLength on a word boundary — the length Google shows in SERP. */
export const clip = (value, maxLength = 160) => {
  const text = plainText(value);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, '')}…`;
};

export const formatTitle = (settings, title, full = false) => {
  if (!title) return settings.siteName;
  if (full || title.includes(settings.siteName)) return title;
  const template = settings.titleTemplate || '%s';
  return template.includes('%s') ? template.replace('%s', title) : `${title} ${template}`;
};

export const canonicalRoute = pathname => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return ROUTE_ALIASES[clean] || clean;
};

export const getNewsPath = item => `/news/${encodeURIComponent(item.id)}`;
export const getBookPath = book => `/product/${encodeURIComponent(book.id)}`;

export const isPublicNews = (item, now = Date.now()) =>
  Boolean(item) && !item.draft && (!item.publishAt || Date.parse(item.publishAt) <= now);

const pick = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';

/** Meta for a static route (not a book / news page). */
export const resolveRouteMeta = (pathname, lang, settings) => {
  const path = canonicalRoute(pathname);
  const builtIn = ROUTE_SEO[path];
  const override = settings.pages?.[path] || {};
  const localeOverride = override[lang] || {};
  const base = builtIn?.[lang] || builtIn?.en || ROUTE_SEO['/'][lang];
  const title = pick(localeOverride.title, base.title);
  return {
    path,
    known: Boolean(builtIn),
    title: formatTitle(settings, title, Boolean(builtIn?.fullTitle) && !localeOverride.title),
    description: clip(pick(localeOverride.description, base.description), 160),
    image: pick(override.image, settings.defaultImage),
    // Unknown paths are the 404 page (or a book/event that hasn't loaded yet).
    robots: override.noindex || !builtIn ? 'noindex,follow' : builtIn.robots || 'index,follow,max-image-preview:large',
    type: 'website',
  };
};

export const resolveBookMeta = (book, settings) => {
  const seo = book.seo || {};
  const byline = book.author ? `${book.title} — ${book.author}` : book.title;
  return {
    path: getBookPath(book),
    title: formatTitle(settings, pick(seo.title, byline)),
    description: clip(pick(seo.description, book.description, book.story?.about?.join?.(' ')), 160),
    image: pick(seo.image, book.coverUrl, settings.defaultImage),
    imageAlt: pick(book.coverAlt, `${book.title}${book.author ? ` — ${book.author}` : ''}`),
    robots: seo.noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large',
    type: 'book',
  };
};

export const resolveNewsMeta = (item, settings) => {
  const seo = item.seo || {};
  const blockText = (item.blocks || []).map(block => block.text || '').join(' ');
  return {
    path: getNewsPath(item),
    title: formatTitle(settings, pick(seo.title, item.title)),
    description: clip(pick(seo.description, item.preview, item.body, blockText), 160),
    image: pick(seo.image, item.imageUrl, settings.defaultImage),
    imageAlt: pick(item.imageAlt, item.title),
    robots: seo.noindex || !isPublicNews(item) ? 'noindex,follow' : 'index,follow,max-image-preview:large',
    type: 'article',
  };
};

// ─── schema.org builders ──────────────────────────────────────────────────

const compact = value => {
  if (Array.isArray(value)) return value.map(compact).filter(item => item !== undefined);
  if (!isObject(value)) return value === '' || value === null || Number.isNaN(value) ? undefined : value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    const next = compact(item);
    if (next !== undefined && !(Array.isArray(next) && next.length === 0)) out[key] = next;
  }
  return out;
};

export const buildOrganizationSchema = (settings, site) => {
  const social = site?.social || {};
  const sameAs = [social.telegramUrl, social.instagramUrl, social.facebookUrl, social.youtubeUrl, social.twitterUrl]
    .filter(url => typeof url === 'string' && /^https?:\/\//.test(url))
    .map(url => url.split('?')[0]);
  return compact({
    '@context': 'https://schema.org',
    '@type': ['Organization', 'BookStore'],
    '@id': `${SITE_URL}/#organization`,
    name: settings.siteName,
    legalName: settings.organization.legalName,
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: `${SITE_URL}/icons/icon-512.png` },
    image: absoluteUrl(settings.defaultImage),
    email: site?.contacts?.email,
    telephone: site?.contacts?.phone,
    foundingDate: settings.organization.foundingDate,
    address: {
      '@type': 'PostalAddress',
      addressLocality: settings.organization.city,
      addressCountry: settings.organization.country,
    },
    sameAs,
  });
};

export const buildWebsiteSchema = (settings, lang) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: settings.siteName,
  url: SITE_URL,
  inLanguage: lang,
  publisher: { '@id': `${SITE_URL}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/catalog?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

export const buildBreadcrumbSchema = (lang, crumbs) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [{ name: BREADCRUMB_LABELS[lang]?.home || 'Home', path: '/' }, ...crumbs].map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: `${SITE_URL}${crumb.path === '/' ? '/' : crumb.path}`,
  })),
});

/** Crumbs for a path; the last crumb gets `leafName` when given (book / news title). */
export const crumbsForPath = (lang, path, leafName) => {
  const labels = BREADCRUMB_LABELS[lang] || BREADCRUMB_LABELS.en;
  if (path.startsWith('/product/')) return [{ name: labels.catalog, path: '/catalog' }, { name: leafName || '', path }];
  if (path.startsWith('/news/')) return [{ name: labels.media, path: '/media' }, { name: leafName || '', path }];
  const parts = path.split('/').filter(Boolean);
  let current = '';
  return parts.map((part, index) => {
    current += `/${part}`;
    return { name: index === parts.length - 1 && leafName ? leafName : labels[part] || part, path: current };
  });
};

const LANGUAGE_CODES = { russian: 'ru', русский: 'ru', english: 'en', английский: 'en', german: 'de', deutsch: 'de', немецкий: 'de' };
const toLanguageCode = value => {
  const key = String(value || '').trim().toLowerCase();
  return LANGUAGE_CODES[key] || (key.length === 2 ? key : 'ru');
};

const BOOK_FORMATS = {
  hardcover: 'https://schema.org/Hardcover',
  special_edition: 'https://schema.org/Hardcover',
  paperback: 'https://schema.org/Paperback',
  digital: 'https://schema.org/EBook',
};

export const buildBookSchema = (book, settings) => {
  const path = getBookPath(book);
  const variants = Array.isArray(book.variants) ? book.variants : [];
  const shopLink = (book.purchaseLinks || []).find(link => /^https?:\/\//.test(link.url || ''))?.url;
  const reviews = (book.story?.reviews || []).filter(review => review && review.quote);
  const price = Number(book.price) > 0 ? Number(book.price).toFixed(2) : undefined;
  // Google's Product rich result rejects a Product without offers or reviews,
  // so only claim Product when we can back it up.
  const isProduct = Boolean(price) || reviews.length > 0;
  return compact({
    '@context': 'https://schema.org',
    '@type': isProduct ? ['Book', 'Product'] : 'Book',
    '@id': `${SITE_URL}${path}#book`,
    name: book.title,
    url: `${SITE_URL}${path}`,
    author: book.author ? { '@type': 'Person', name: book.author } : undefined,
    publisher: { '@type': 'Organization', name: book.details?.publisher || settings.siteName, '@id': `${SITE_URL}/#organization` },
    image: absoluteUrl(book.coverUrl, settings.defaultImage),
    description: clip(book.description, 500),
    inLanguage: toLanguageCode(variants[0]?.language),
    isbn: variants.find(variant => variant.isbn)?.isbn,
    datePublished: book.releaseDate,
    numberOfPages: Number(book.details?.pages) || undefined,
    genre: book.genre,
    bookFormat: BOOK_FORMATS[variants[0]?.format] || 'https://schema.org/Paperback',
    typicalAgeRange: book.ageRating,
    brand: isProduct ? { '@type': 'Brand', name: settings.siteName } : undefined,
    sku: isProduct ? book.id : undefined,
    workExample: variants.filter(variant => variant.isbn).map(variant => ({
      '@type': 'Book',
      isbn: variant.isbn,
      bookFormat: BOOK_FORMATS[variant.format] || 'https://schema.org/Paperback',
      inLanguage: toLanguageCode(variant.language),
    })),
    offers: price
      ? {
          '@type': 'Offer',
          price,
          priceCurrency: 'EUR',
          availability: book.isPreorder ? 'https://schema.org/PreOrder' : book.stock > 0 || shopLink ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: shopLink || `${SITE_URL}${path}`,
          seller: { '@id': `${SITE_URL}/#organization` },
        }
      : undefined,
    review: reviews.slice(0, 5).map(review => ({
      '@type': 'Review',
      reviewBody: clip(review.quote, 400),
      author: { '@type': 'Person', name: review.author || 'Reader' },
    })),
  });
};

export const buildNewsSchema = (item, settings, lang) => {
  const path = getNewsPath(item);
  const article = compact({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${SITE_URL}${path}#article`,
    headline: clip(item.title, 110),
    description: clip(item.preview || item.body, 300),
    image: absoluteUrl(item.imageUrl, settings.defaultImage),
    datePublished: item.publishAt || item.date,
    dateModified: item.publishAt || item.date,
    inLanguage: lang,
    articleSection: item.category,
    mainEntityOfPage: `${SITE_URL}${path}`,
    author: { '@type': 'Organization', name: settings.siteName, url: SITE_URL },
    publisher: { '@id': `${SITE_URL}/#organization` },
  });
  if (!item.eventStart) return [article];
  const event = compact({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: item.title,
    description: clip(item.preview || item.body, 300),
    image: absoluteUrl(item.imageUrl, settings.defaultImage),
    startDate: item.eventStart,
    endDate: item.eventEnd,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: item.eventLocation ? 'https://schema.org/OfflineEventAttendanceMode' : 'https://schema.org/OnlineEventAttendanceMode',
    location: item.eventLocation
      ? { '@type': 'Place', name: item.eventLocation, address: item.eventAddress || item.eventLocation }
      : { '@type': 'VirtualLocation', url: item.eventUrl || `${SITE_URL}${path}` },
    organizer: { '@type': 'Organization', name: settings.siteName, url: SITE_URL },
    url: `${SITE_URL}${path}`,
  });
  return [article, event];
};

export const buildItemListSchema = (items, name) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `${SITE_URL}${item.path}`,
    name: item.name,
  })),
});

// ─── audit (used by the admin SEO centre) ─────────────────────────────────

/** Returns a list of human-readable issues for a resolved meta object. */
export const auditMeta = (meta, { hasImage = true } = {}) => {
  const issues = [];
  const bareTitle = meta.title || '';
  if (!bareTitle) issues.push({ level: 'error', code: 'title-missing' });
  else if (bareTitle.length > 65) issues.push({ level: 'warn', code: 'title-long', value: bareTitle.length });
  else if (bareTitle.length < 25) issues.push({ level: 'warn', code: 'title-short', value: bareTitle.length });
  const description = meta.description || '';
  if (!description) issues.push({ level: 'error', code: 'description-missing' });
  else if (description.length < 70) issues.push({ level: 'warn', code: 'description-short', value: description.length });
  if (!hasImage) issues.push({ level: 'warn', code: 'image-missing' });
  if (meta.robots?.startsWith('noindex')) issues.push({ level: 'info', code: 'noindex' });
  return issues;
};
