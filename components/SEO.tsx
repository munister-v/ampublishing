import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Book } from '../types';

const SITE_URL = 'https://ampublishing.org';
const SITE_NAME = 'AM Publishing Berlin';
const DEFAULT_IMAGE = `${SITE_URL}/images/home-hero.webp`;
const DEFAULT_DESCRIPTION =
  'AM Publishing Berlin is an independent publisher of contemporary literary prose, psychological fiction, and Russian-language books with worldwide delivery.';

type SeoConfig = {
  title: string;
  description: string;
  image?: string;
  type?: string;
  robots?: string;
};

const routeSeo: Record<string, SeoConfig> = {
  '/': {
    title: 'AM Publishing Berlin | Independent Literary Publisher',
    description: DEFAULT_DESCRIPTION,
  },
  '/catalog': {
    title: 'Book Catalog | AM Publishing Berlin',
    description:
      'Browse AM Publishing books, literary prose, psychological fiction, hardcover editions, special editions, and digital excerpts.',
  },
  '/shop': {
    title: 'Book Shop | AM Publishing Berlin',
    description:
      'Order AM Publishing books online. Hardcover, special editions, and digital excerpts with international delivery.',
  },
  '/our-authors': {
    title: 'Authors | AM Publishing Berlin',
    description:
      'Meet the authors of AM Publishing Berlin: contemporary literary voices, psychological prose, autofiction, and modern Russian-language literature.',
  },
  '/authors': {
    title: 'For Authors | Submit a Manuscript to AM Publishing',
    description:
      'Information for writers who want to publish literary prose, autofiction, psychological fiction, or author projects with AM Publishing Berlin.',
  },
  '/about': {
    title: 'About AM Publishing Berlin',
    description:
      'Learn about AM Publishing Berlin, an independent literary publisher focused on contemporary prose, editorial care, and beautiful book objects.',
  },
  '/media': {
    title: 'Media & Journal | AM Publishing Berlin',
    description:
      'News, journal notes, literary announcements, and updates from AM Publishing Berlin.',
  },
  '/radio': {
    title: 'AM Publishing Radio | Literature, Authors, Books',
    description:
      'AM Publishing Radio: live broadcasts, podcasts, conversations about literature, authors, publishing, and books.',
  },
  '/services': {
    title: 'Publishing Services | AM Publishing Berlin',
    description:
      'Editorial, publishing, book design, and author project services from AM Publishing Berlin.',
  },
  '/services/order': {
    title: 'Request Publishing Services | AM Publishing Berlin',
    description:
      'Send a publishing or manuscript request to AM Publishing Berlin for editorial review and project estimation.',
  },
  '/privacy': {
    title: 'Privacy Policy | AM Publishing Berlin',
    description: 'Privacy policy and data protection information for AM Publishing Berlin.',
    robots: 'noindex,follow',
  },
  '/terms': {
    title: 'Terms | AM Publishing Berlin',
    description: 'Terms and conditions for AM Publishing Berlin.',
    robots: 'noindex,follow',
  },
  '/impressum': {
    title: 'Impressum | AM Publishing Berlin',
    description: 'Legal notice and publishing information for AM Publishing Berlin.',
    robots: 'noindex,follow',
  },
};

const absoluteUrl = (path: string) => {
  if (!path) return DEFAULT_IMAGE;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

const upsertMeta = (selector: string, attr: 'content' | 'href', value: string, create: () => HTMLMetaElement | HTMLLinkElement) => {
  let element = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute(attr, value);
};

const setMetaName = (name: string, content: string) => {
  upsertMeta(`meta[name="${name}"]`, 'content', content, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    return meta;
  });
};

const setMetaProperty = (property: string, content: string) => {
  upsertMeta(`meta[property="${property}"]`, 'content', content, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    return meta;
  });
};

const setLink = (rel: string, href: string, extra?: Record<string, string>) => {
  const selector = extra?.hreflang
    ? `link[rel="${rel}"][hreflang="${extra.hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  upsertMeta(selector, 'href', href, () => {
    const link = document.createElement('link');
    link.setAttribute('rel', rel);
    if (extra) Object.entries(extra).forEach(([key, value]) => link.setAttribute(key, value));
    return link;
  });
};

const buildBreadcrumb = (pathname: string) => {
  const labels: Record<string, string> = {
    catalog: 'Catalog',
    shop: 'Shop',
    product: 'Product',
    authors: 'For Authors',
    'our-authors': 'Authors',
    about: 'About',
    media: 'Media',
    radio: 'Radio',
    services: 'Services',
  };
  const parts = pathname.split('/').filter(Boolean);
  const items = [{ name: 'Home', url: SITE_URL }];
  let current = '';
  parts.forEach(part => {
    current += `/${part}`;
    items.push({ name: labels[part] || part, url: `${SITE_URL}${current}` });
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
};

const buildOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/logo-dark.png`,
  image: DEFAULT_IMAGE,
  email: 'am.hybridpublishing@gmail.com',
  sameAs: ['https://t.me/ampublishingberlin', 'https://www.instagram.com/am.publishing'],
});

const buildWebsiteSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/catalog?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

const buildBookSchema = (book: Book) => ({
  '@context': 'https://schema.org',
  '@type': 'Book',
  name: book.title,
  author: {
    '@type': 'Person',
    name: book.author,
  },
  publisher: {
    '@type': 'Organization',
    name: book.details.publisher || SITE_NAME,
  },
  image: absoluteUrl(book.coverUrl),
  description: book.description,
  inLanguage: book.variants[0]?.language || 'Russian',
  isbn: book.variants[0]?.isbn,
  datePublished: book.releaseDate,
  numberOfPages: book.details.pages,
  offers: {
    '@type': 'Offer',
    price: book.price,
    priceCurrency: 'EUR',
    availability: book.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url: `${SITE_URL}/product/${book.id}`,
  },
});

const setJsonLd = (id: string, value: unknown) => {
  let script = document.head.querySelector<HTMLScriptElement>(`script#${id}`);
  if (!script) {
    script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(value);
};

export const SEO: React.FC = () => {
  const location = useLocation();
  const { books } = useApp();

  useEffect(() => {
    const pathname = location.pathname;
    const productMatch = pathname.match(/^\/product\/([^/]+)/);
    const product = productMatch ? books.find(book => book.id === decodeURIComponent(productMatch[1])) : undefined;
    const route = product
      ? {
          title: `${product.title} by ${product.author} | AM Publishing Berlin`,
          description: product.description,
          image: product.coverUrl,
          type: 'book',
        }
      : routeSeo[pathname] || routeSeo['/'];
    const hasIndexableQuery = location.search && !pathname.startsWith('/product/');
    const robots = hasIndexableQuery ? 'noindex,follow' : route.robots || 'index,follow,max-image-preview:large';
    const canonicalPath = pathname === '/shop' ? '/catalog' : pathname;
    const canonical = `${SITE_URL}${canonicalPath === '/' ? '/' : canonicalPath}`;
    const image = absoluteUrl(route.image || DEFAULT_IMAGE);

    document.title = route.title;
    setMetaName('description', route.description);
    setMetaName('robots', robots);
    setMetaName('googlebot', robots);
    setMetaName('author', SITE_NAME);
    setMetaName(
      'keywords',
      'AM Publishing Berlin, independent publisher, literary publisher, contemporary prose, psychological fiction, Russian literature, books from Berlin',
    );

    setLink('canonical', canonical);
    setLink('alternate', `${SITE_URL}/`, { hreflang: 'x-default' });

    setMetaProperty('og:type', route.type || 'website');
    setMetaProperty('og:site_name', SITE_NAME);
    setMetaProperty('og:url', canonical);
    setMetaProperty('og:title', route.title);
    setMetaProperty('og:description', route.description);
    setMetaProperty('og:image', image);
    setMetaProperty('og:image:alt', route.title);

    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', route.title);
    setMetaName('twitter:description', route.description);
    setMetaName('twitter:image', image);

    setJsonLd('seo-org-jsonld', buildOrganizationSchema());
    setJsonLd('seo-website-jsonld', buildWebsiteSchema());
    setJsonLd('seo-breadcrumb-jsonld', buildBreadcrumb(canonicalPath));
    if (product) {
      setJsonLd('seo-book-jsonld', buildBookSchema(product));
    } else {
      document.head.querySelector('script#seo-book-jsonld')?.remove();
    }
  }, [books, location.pathname, location.search]);

  return null;
};
