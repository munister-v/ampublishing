import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../AppContext';
import { SeoSettings } from '../types';
import { findBookByRouteId } from '../utils/bookRoutes';
import { getSeoSettings } from '../services/seoSettings';
import {
  SITE_URL,
  LANGS,
  OG_LOCALES,
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
} from '../seo/core.mjs';

// Everything here mirrors scripts/prerender-seo.mjs, which writes the same
// tags into the static HTML at build time. This component keeps them right
// after client-side navigation and when the visitor switches language.

const upsert = (selector: string, attr: 'content' | 'href', value: string, create: () => HTMLElement) => {
  let element = document.head.querySelector<HTMLElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute(attr, value);
};

const setMeta = (key: 'name' | 'property', id: string, content: string) => {
  const selector = `meta[${key}="${id}"]`;
  if (!content) {
    document.head.querySelector(selector)?.remove();
    return;
  }
  upsert(selector, 'content', content, () => {
    const meta = document.createElement('meta');
    meta.setAttribute(key, id);
    return meta;
  });
};

const setLink = (rel: string, href: string, hreflang?: string) => {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  upsert(selector, 'href', href, () => {
    const link = document.createElement('link');
    link.setAttribute('rel', rel);
    if (hreflang) link.setAttribute('hreflang', hreflang);
    return link;
  });
};

const setJsonLd = (id: string, value: unknown) => {
  let script = document.head.querySelector<HTMLScriptElement>(`script#${id}`);
  if (!value) {
    script?.remove();
    return;
  }
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
  const { books, news, language, siteSettings } = useApp();
  const [settings, setSettings] = useState<SeoSettings>(() => mergeSeoSettings(null) as SeoSettings);

  useEffect(() => {
    getSeoSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    const pathname = location.pathname.replace(/\/+$/, '') || '/';
    if (pathname.startsWith('/admin') || pathname === '/login' || pathname.startsWith('/radio/admin')) {
      setMeta('name', 'robots', 'noindex,nofollow');
      return;
    }

    const productMatch = pathname.match(/^\/product\/([^/]+)/);
    const newsMatch = pathname.match(/^\/news\/([^/]+)/);
    const book = productMatch ? findBookByRouteId(books, productMatch[1]) : undefined;
    const newsItem = newsMatch ? news.find(item => item.id === decodeURIComponent(newsMatch[1])) : undefined;

    const meta = book
      ? resolveBookMeta(book, settings)
      : newsItem
        ? resolveNewsMeta(newsItem, settings)
        : resolveRouteMeta(pathname, language, settings);

    const params = new URLSearchParams(location.search);
    const langParam = params.get('lang');
    const onlyLangParam = [...params.keys()].every(key => key === 'lang');
    // Filtered catalog views (?search=, ?genre=…) are thin duplicates; keep them out of the index.
    const robots = location.search && !onlyLangParam ? 'noindex,follow' : meta.robots;
    const canonicalPath = meta.path === '/' ? '/' : meta.path;
    const canonical = `${SITE_URL}${canonicalPath}${langParam && LANGS.includes(langParam) ? `?lang=${langParam}` : ''}`;
    const image = absoluteUrl(meta.image, settings.defaultImage);

    document.documentElement.lang = language;
    document.title = meta.title;
    setMeta('name', 'description', meta.description);
    setMeta('name', 'robots', robots);
    setMeta('name', 'googlebot', robots);
    setMeta('name', 'keywords', settings.keywords);
    setMeta('name', 'author', book?.author || settings.siteName);

    setLink('canonical', canonical);
    setLink('alternate', `${SITE_URL}${canonicalPath}`, 'x-default');
    LANGS.forEach(lang => setLink('alternate', `${SITE_URL}${canonicalPath}?lang=${lang}`, lang));

    setMeta('property', 'og:type', meta.type === 'book' ? 'book' : meta.type === 'article' ? 'article' : 'website');
    setMeta('property', 'og:site_name', settings.siteName);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', ('imageAlt' in meta && meta.imageAlt) || meta.title);
    setMeta('property', 'og:locale', OG_LOCALES[language]);
    setMeta('property', 'book:author', book?.author || '');
    setMeta('property', 'book:isbn', book?.variants?.find(variant => variant.isbn)?.isbn || '');
    setMeta('property', 'book:release_date', book?.releaseDate || '');
    setMeta('property', 'article:published_time', newsItem ? (newsItem.publishAt || newsItem.date) : '');

    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:site', settings.twitterHandle);
    setMeta('name', 'twitter:title', meta.title);
    setMeta('name', 'twitter:description', meta.description);
    setMeta('name', 'twitter:image', image);

    setMeta('name', 'google-site-verification', settings.verification.google);
    setMeta('name', 'msvalidate.01', settings.verification.bing);
    setMeta('name', 'yandex-verification', settings.verification.yandex);
    setMeta('name', 'p:domain_verify', settings.verification.pinterest);
    setMeta('name', 'facebook-domain-verification', settings.verification.facebookDomain);

    setJsonLd('seo-org-jsonld', buildOrganizationSchema(settings, siteSettings));
    setJsonLd('seo-website-jsonld', buildWebsiteSchema(settings, language));
    const leaf = book?.title || newsItem?.title;
    setJsonLd('seo-breadcrumb-jsonld', canonicalPath === '/' ? null : buildBreadcrumbSchema(language, crumbsForPath(language, canonicalPath, leaf)));
    setJsonLd('seo-book-jsonld', book ? buildBookSchema(book, settings) : null);
    setJsonLd('seo-news-jsonld', newsItem ? buildNewsSchema(newsItem, settings, language) : null);
    setJsonLd(
      'seo-list-jsonld',
      canonicalPath === '/catalog' && books.length
        ? buildItemListSchema(books.map(item => ({ path: getBookPath(item), name: item.title })), meta.title)
        : canonicalPath === '/media' && news.length
          ? buildItemListSchema(news.map(item => ({ path: getNewsPath(item), name: item.title })), meta.title)
          : null,
    );
  }, [books, news, language, siteSettings, settings, location.pathname, location.search]);

  return null;
};
