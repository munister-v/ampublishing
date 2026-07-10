import { Book, PurchaseLink } from '../types';

const SHOPIFY_MARKERS = ['shopify', 'myshopify'];

export const isShopifyPurchaseLink = (link?: Partial<PurchaseLink> | null): link is PurchaseLink => {
  if (!link) return false;
  const haystack = `${link.id || ''} ${link.label || ''} ${link.url || ''}`.toLowerCase();
  return SHOPIFY_MARKERS.some(marker => haystack.includes(marker));
};

export const getShopifyPurchaseLink = (book?: Pick<Book, 'purchaseLinks'> | null): PurchaseLink | null => {
  const links = Array.isArray(book?.purchaseLinks) ? book.purchaseLinks : [];
  return links.find(link => isShopifyPurchaseLink(link) && Boolean(link.url?.trim())) || null;
};

export const getActivePurchaseLinks = (book?: Pick<Book, 'purchaseLinks'> | null): PurchaseLink[] => {
  return (Array.isArray(book?.purchaseLinks) ? book.purchaseLinks : []).filter(link => Boolean(link?.url?.trim()));
};
