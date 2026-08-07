import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, AlertCircle } from 'lucide-react';
import { Book } from '../types';
import { useApp } from '../AppContext';
import { FadeImage } from './FadeImage';
import { analytics } from '../services/analytics';
import { formatLabel } from '../utils/formatLabel';
import { getShopifyPurchaseLink } from '../utils/purchaseLinks';
import { getBookPath } from '../utils/bookRoutes';
import { getPrimaryBookVariant } from '../utils/bookVariants';

interface ProductCardProps {
  book: Book;
  featured?: boolean;
  viewMode?: 'grid' | 'list';
}

export const ProductCard: React.FC<ProductCardProps> = ({ book, viewMode = 'grid' }) => {
  const { region, t, language, checkAgeGate } = useApp();
  const mainVariant = getPrimaryBookVariant(book, language);
  const shopifyLink = getShopifyPurchaseLink(book);
  const canBuyInShop = Boolean(shopifyLink);
  const isSoldOut = !canBuyInShop && book.stock === 0 && !book.isPreorder;
  const isLowStock = !canBuyInShop && book.stock > 0 && book.stock < 5;
  const hasLocalPrice = book.price > 0;
  const actionLabel = book.isPreorder ? t('product.preorder_in_shop') : t('product.buy_in_shop');

  const handleCardClick = () => analytics.viewItem(book);

  const handleShopClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!shopifyLink) return;
    analytics.shopifyBuyClick(book.id, shopifyLink.url, viewMode === 'list' ? 'catalog_list' : 'catalog_grid');

    if (book.badges.includes('18+')) {
      event.preventDefault();
      checkAgeGate(book, () => window.location.assign(shopifyLink.url));
    }
  };

  const priceLabel = hasLocalPrice
    ? `${book.price.toFixed(2)} ${region.currency}`
    : canBuyInShop
      ? t('product.price_in_shop')
      : t('product.price_on_request');

  if (viewMode === 'list') {
    return (
      <article className="group relative w-full bg-white border-b border-primary hover:bg-gray-50 transition-colors">
        <Link
          to={getBookPath(book)}
          onClick={handleCardClick}
          className="flex items-stretch min-h-[180px] pressable focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
        >
          <div className="w-[120px] md:w-[150px] flex-shrink-0 border-r border-primary relative overflow-hidden bg-[#F4F4F0]">
            <FadeImage
              src={book.coverUrl}
              alt={book.title}
              className={`w-full h-full object-cover transition-all duration-[700ms] ${isSoldOut ? 'opacity-50 saturate-50' : 'saturate-100 group-hover:saturate-110'}`}
            />
            {book.isPreorder && (
              <span className="absolute top-2 left-2 bg-accent text-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest">
                {t('common.preorder_badge')}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1 p-5 md:p-6 flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-2">
                <div className="min-w-0">
                  <h3 className="text-2xl font-serif text-primary group-hover:text-accent transition-colors">{book.title}</h3>
                  <p className="font-mono text-xs text-gray-500 uppercase tracking-wider">{book.author}</p>
                </div>
                <span className={`shrink-0 ${hasLocalPrice ? 'font-serif text-xl' : 'font-mono text-[10px] uppercase tracking-wider text-primary/60'}`}>
                  {priceLabel}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 max-w-2xl font-light leading-relaxed mt-2">
                {book.description}
              </p>
            </div>

            <div className="flex gap-4 text-[10px] uppercase text-gray-400 font-mono mt-4">
              {mainVariant && <span>{formatLabel(mainVariant.format, language)}</span>}
              {mainVariant?.isbn && <span className="hidden sm:inline">| {mainVariant.isbn}</span>}
              <span className="hidden sm:inline">{mainVariant ? '| ' : ''}{book.details.year}</span>
            </div>
          </div>
        </Link>

        {shopifyLink && (
          <a
            href={shopifyLink.url}
            onClick={handleShopClick}
            aria-label={`${actionLabel}: ${book.title}`}
            className="min-h-[52px] w-full px-5 py-3 bg-primary text-white hover:bg-accent hover:text-primary transition-colors duration-300 flex items-center justify-center gap-2 text-xs uppercase font-bold tracking-[0.16em] border-t border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
          >
            {actionLabel}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        )}
      </article>
    );
  }

  return (
    <article className="group relative h-full w-full bg-white border-r border-b border-primary transition-all duration-300 hover:z-20 md:desktop-lift flex flex-col">
      <Link
        to={getBookPath(book)}
        onClick={handleCardClick}
        className="flex flex-col flex-1 pressable focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
      >
        <div className="flex justify-between items-center px-4 py-3 border-b border-primary bg-white text-[9px] font-mono uppercase tracking-wider text-gray-500">
          <div className="flex gap-3">
            {mainVariant?.isbn && <span className="text-primary font-bold">{mainVariant.isbn}</span>}
            {mainVariant?.isbn && <span className="hidden sm:inline text-primary/20">|</span>}
            <span className={mainVariant?.isbn ? 'hidden sm:inline' : ''}>{book.details.year}</span>
          </div>
          <span className={(book.variants || []).length > 1 ? 'text-accent' : ''}>
            {formatLabel(mainVariant.format, language)}
          </span>
        </div>

        <div className="relative w-full aspect-[3/4] border-b border-primary overflow-hidden bg-[#F4F4F0] perspective-1000">
          <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 items-start pointer-events-none">
            {book.isPreorder && (
              <span className="bg-accent text-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm">
                {t('common.preorder_badge')}
              </span>
            )}
            {book.badges.includes('new') && (
              <span className="bg-primary text-white px-2 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm">
                {t('common.badge_new')}
              </span>
            )}
            {book.badges.includes('bestseller') && (
              <span className="bg-white text-primary border border-primary px-2 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm">
                {t('common.badge_hit')}
              </span>
            )}
          </div>

          <div className="w-full h-full transform transition-transform duration-700 group-hover:scale-105">
            <FadeImage
              src={book.coverUrl}
              alt={book.title}
              className={`w-full h-full object-cover transition-all duration-[700ms] ease-out-quart ${isSoldOut ? 'opacity-50 saturate-50' : 'saturate-100 group-hover:saturate-110'}`}
            />
          </div>

          {isSoldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px] z-10 pointer-events-none">
              <div className="bg-primary text-white px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] border-2 border-white shadow-lg">
                {t('common.sold_out')}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col flex-1 justify-between gap-4 bg-white relative">
          <div>
            <h3 className="text-2xl font-serif leading-[1.0] mb-2 group-hover:text-accent transition-colors duration-300 line-clamp-2 min-h-[2em]">
              {book.title}
            </h3>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 mb-4 truncate">
              {t('product.by_author')} <span className="text-primary font-bold">{book.author}</span>
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-end justify-between gap-4">
            <div>
              {hasLocalPrice && book.oldPrice ? (
                <span className="block text-xs text-gray-400 line-through decoration-red-500 decoration-1 mb-0.5">
                  {book.oldPrice.toFixed(2)} {region.currency}
                </span>
              ) : null}
              <span className={`block leading-none ${hasLocalPrice ? 'font-serif text-xl font-medium' : 'font-mono text-[10px] uppercase tracking-wider text-primary/60'}`}>
                {priceLabel}
              </span>
            </div>

            {isLowStock ? (
              <div className="flex items-center gap-1 text-[9px] uppercase font-bold text-red-600 tracking-wider mb-1">
                <AlertCircle size={11} aria-hidden="true" />
                <span>{t('common.last_stock', { count: book.stock })}</span>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300" aria-hidden="true">
                <ArrowUpRight className="text-gray-500 group-hover:text-white transition-colors" size={15} />
              </div>
            )}
          </div>
        </div>
      </Link>

      {shopifyLink && (
        <a
          href={shopifyLink.url}
          onClick={handleShopClick}
          aria-label={`${actionLabel}: ${book.title}`}
          className="min-h-[52px] w-full px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary transition-colors duration-300 flex items-center justify-center gap-2 text-[11px] uppercase font-bold tracking-[0.14em] border-t border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent"
        >
          {actionLabel}
          <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      )}
    </article>
  );
};
