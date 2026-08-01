import type { ShopifyIntegration } from '../types';
import { normalizeShopifyDomain } from '../utils/shopify';

/**
 * Storefront API: живые цена и наличие из Shopify.
 * Shopify отдаёт этот эндпоинт с CORS, поэтому статическому сайту
 * бэкенд не нужен — достаточно публичного Storefront access token.
 * Если токен не задан, всё работает как раньше: цены из каталога сайта.
 */

const API_VERSION = '2024-10';
const CACHE_TTL = 5 * 60 * 1000;

export type VariantState = {
  variantId: string;
  price: number | null;
  currency: string;
  available: boolean | null;
  title?: string;
  productTitle?: string;
};

type CacheEntry = { ts: number; data: Record<string, VariantState> };

const cache = new Map<string, CacheEntry>();

const gid = (variantId: string) => `gid://shopify/ProductVariant/${variantId.replace(/\D/g, '')}`;

export const isStorefrontConfigured = (shopify?: ShopifyIntegration | null): boolean =>
  Boolean(shopify?.enabled && normalizeShopifyDomain(shopify.domain) && shopify.storefrontToken.trim());

/** Запрашивает состояние вариантов пачкой; пустой ответ = Shopify недоступен. */
export const fetchVariantStates = async (
  shopify: ShopifyIntegration,
  variantIds: string[],
): Promise<Record<string, VariantState>> => {
  const host = normalizeShopifyDomain(shopify.domain);
  const ids = Array.from(new Set(variantIds.map(id => id.replace(/\D/g, '')).filter(Boolean)));
  if (!isStorefrontConfigured(shopify) || !ids.length) return {};

  const cacheKey = `${host}|${ids.join(',')}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const query = `
    query variants($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          title
          availableForSale
          price { amount currencyCode }
          product { title }
        }
      }
    }
  `;

  const res = await fetch(`https://${host}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': shopify.storefrontToken.trim(),
    },
    body: JSON.stringify({ query, variables: { ids: ids.map(gid) } }),
  });

  if (!res.ok) throw new Error(`Shopify Storefront ответил ${res.status}`);
  const payload = await res.json();
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message || 'Storefront API вернул ошибку');

  const data: Record<string, VariantState> = {};
  for (const node of payload.data?.nodes || []) {
    if (!node?.id) continue;
    const variantId = String(node.id).split('/').pop() as string;
    data[variantId] = {
      variantId,
      price: node.price ? Number(node.price.amount) : null,
      currency: node.price?.currencyCode || 'EUR',
      available: typeof node.availableForSale === 'boolean' ? node.availableForSale : null,
      title: node.title,
      productTitle: node.product?.title,
    };
  }

  cache.set(cacheKey, { ts: Date.now(), data });
  return data;
};

/** Проверка соединения для админки: возвращает название магазина. */
export const pingStorefront = async (shopify: ShopifyIntegration): Promise<string> => {
  const host = normalizeShopifyDomain(shopify.domain);
  if (!host) throw new Error('Не указан домен магазина');
  if (!shopify.storefrontToken.trim()) throw new Error('Не указан Storefront access token');

  const res = await fetch(`https://${host}/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': shopify.storefrontToken.trim(),
    },
    body: JSON.stringify({ query: '{ shop { name currencyCode } }' }),
  });

  if (!res.ok) throw new Error(`Shopify ответил ${res.status}`);
  const payload = await res.json();
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message || 'Storefront API вернул ошибку');
  const shop = payload.data?.shop;
  if (!shop?.name) throw new Error('Ответ без данных магазина — проверьте токен');
  return `${shop.name} (${shop.currencyCode})`;
};

export const clearStorefrontCache = () => cache.clear();
