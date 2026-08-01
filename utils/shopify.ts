import type { Book, ShopifyIntegration, ShopifyProductLink } from '../types';

/** Приводит «shop.myshopify.com», «https://shop.myshopify.com/» и т.п. к голому хосту. */
export const normalizeShopifyDomain = (domain: string): string =>
  (domain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')
    .toLowerCase();

export const getShopifyLinkForBook = (
  shopify: ShopifyIntegration | null | undefined,
  bookId: string,
): ShopifyProductLink | null => {
  if (!shopify?.enabled) return null;
  const link = (shopify.products || []).find(entry => entry.bookId === bookId && entry.enabled !== false);
  return link && link.variantId.trim() ? link : null;
};

/**
 * Shopify cart permalink: сразу кладёт вариант в корзину магазина и ведёт на checkout.
 * https://<shop>/cart/<variantId>:<qty>
 */
export const buildShopifyCartUrl = (
  shopify: ShopifyIntegration,
  variantId: string,
  quantity = 1,
): string | null => {
  const host = normalizeShopifyDomain(shopify.domain);
  const variant = (variantId || '').replace(/\D/g, '');
  if (!host || !variant) return null;
  const params = new URLSearchParams();
  if (shopify.refTag) params.set('ref', shopify.refTag);
  const query = params.toString();
  return `https://${host}/cart/${variant}:${Math.max(1, quantity)}${query ? `?${query}` : ''}`;
};

/** Ссылка на карточку товара в Shopify (нужен handle). */
export const buildShopifyProductUrl = (shopify: ShopifyIntegration, handle?: string): string | null => {
  const host = normalizeShopifyDomain(shopify.domain);
  if (!host || !handle?.trim()) return null;
  return `https://${host}/products/${handle.trim()}`;
};

/** Мультитоварный permalink для всей корзины сайта. */
export const buildShopifyCartUrlForItems = (
  shopify: ShopifyIntegration,
  items: { variantId: string; quantity: number }[],
): string | null => {
  const host = normalizeShopifyDomain(shopify.domain);
  const parts = items
    .map(item => ({ id: (item.variantId || '').replace(/\D/g, ''), qty: Math.max(1, item.quantity) }))
    .filter(item => item.id)
    .map(item => `${item.id}:${item.qty}`);
  if (!host || !parts.length) return null;
  const params = new URLSearchParams();
  if (shopify.refTag) params.set('ref', shopify.refTag);
  const query = params.toString();
  return `https://${host}/cart/${parts.join(',')}${query ? `?${query}` : ''}`;
};

/** Сколько книг каталога уже привязано к товарам Shopify. */
export const shopifyCoverage = (shopify: ShopifyIntegration, books: Book[]) => {
  const linked = books.filter(book => Boolean(getShopifyLinkForBook(shopify, book.id))).length;
  return { linked, total: books.length };
};
