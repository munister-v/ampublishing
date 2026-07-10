
import React from 'react';
import { Link } from 'react-router-dom';
import { Book } from '../types';
import { useApp } from '../AppContext';
import { ShoppingBag, ArrowUpRight, AlertCircle } from 'lucide-react';
import { FadeImage } from './FadeImage';
import { analytics } from '../services/analytics';
import { formatLabel } from '../utils/formatLabel';
import { getShopifyPurchaseLink } from '../utils/purchaseLinks';

interface ProductCardProps {
  book: Book;
  featured?: boolean;
  viewMode?: 'grid' | 'list';
}

export const ProductCard: React.FC<ProductCardProps> = ({ book, viewMode = 'grid' }) => {
  const { region, t, addToCart, language } = useApp();

  // Helper to determine main variant info
  const mainVariant = book.variants[0];
  const isLowStock = book.stock > 0 && book.stock < 5;
  const isSoldOut = book.stock === 0 && !book.isPreorder;
  const isPurchasable = book.price > 0;
  const shopifyLink = getShopifyPurchaseLink(book);
  const actionLabel = shopifyLink ? t('product.buy_on_shopify') : (book.isPreorder ? t('product.make_preorder') : t('product.add_to_cart'));

  // Handler for Quick Add
  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    
    if (mainVariant && book.stock > 0) {
      if (shopifyLink) {
        analytics.addToCart(book, mainVariant, 1);
        window.location.assign(shopifyLink.url);
        return;
      }
      addToCart(book, mainVariant, 1);
      analytics.addToCart(book, mainVariant, 1);
    }
  };

  const handleCardClick = () => {
    analytics.viewItem(book);
  };

  if (viewMode === 'list') {
    return (
      <Link 
        to={`/product/${book.id}`}
        onClick={handleCardClick}
        className="group relative block w-full bg-white border-b border-primary hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-stretch min-h-[180px]">
           {/* Image */}
           <div className="w-[120px] md:w-[150px] flex-shrink-0 border-r border-primary relative overflow-hidden bg-[#F4F4F0]">
              <FadeImage 
                 src={book.coverUrl} 
                 alt={book.title}
                 className={`w-full h-full object-cover transition-all duration-[1000ms] ${isSoldOut ? 'opacity-50 grayscale' : 'grayscale group-hover:grayscale-0'}`}
              />
              {book.isPreorder && (
                <span className="absolute top-2 left-2 bg-accent text-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest">
                  {t('common.preorder_badge')}
                </span>
              )}
           </div>

           {/* Content */}
           <div className="flex-1 p-6 flex flex-col justify-between">
              <div>
                 <div className="flex justify-between items-start mb-2">
                    <div>
                       <h3 className="text-2xl font-serif text-primary group-hover:text-accent transition-colors">{book.title}</h3>
                       <p className="font-mono text-xs text-gray-500 uppercase tracking-wider">{book.author}</p>
                    </div>
                    <span className={`font-mono font-bold ${isPurchasable ? 'text-xl' : 'text-xs uppercase tracking-wider text-gray-500 whitespace-nowrap'}`}>
                       {isPurchasable ? `${book.price.toFixed(2)} ${region.currency}` : t('product.price_on_request')}
                    </span>
                 </div>
                 <p className="text-sm text-gray-600 line-clamp-2 max-w-2xl font-light leading-relaxed mt-2">
                    {book.description}
                 </p>
              </div>

              <div className="flex justify-between items-end mt-4">
                 <div className="flex gap-4 text-[10px] uppercase text-gray-400 font-mono">
                    <span>{mainVariant ? formatLabel(mainVariant.format, language) : ''}</span>
                    <span className="hidden sm:inline">|</span>
                    <span className="hidden sm:inline">{mainVariant?.isbn}</span>
                    <span className="hidden sm:inline">|</span>
                    <span className="hidden sm:inline">{book.details.year}</span>
                 </div>
                 
                 {!isSoldOut && isPurchasable && (
                    <button
                      onClick={handleQuickAdd}
                      className="flex items-center gap-2 text-xs uppercase font-bold tracking-widest text-primary hover:text-accent transition-colors"
                    >
                       <span>{actionLabel}</span>
                       <ArrowUpRight size={14} />
                    </button>
                 )}
                 {!isSoldOut && !isPurchasable && (
                    <span className="flex items-center gap-2 text-xs uppercase font-bold tracking-widest text-primary">
                       <span>{t('product.open_card')}</span>
                       <ArrowUpRight size={14} />
                    </span>
                 )}
                 {isSoldOut && (
                    <span className="text-xs uppercase font-bold text-gray-400">{t('common.sold_out')}</span>
                 )}
              </div>
           </div>
        </div>
      </Link>
    );
  }

  // DEFAULT GRID VIEW
  return (
    <Link 
      to={`/product/${book.id}`} 
      onClick={handleCardClick}
      className="group relative block h-full w-full bg-white border-r border-b border-primary transition-all duration-300 hover:z-20 hover:shadow-[8px_8px_0px_0px_#040F1E] hover:-translate-y-1 hover:-translate-x-1"
    >
      <div className="flex flex-col h-full">
        
        {/* --- TECHNICAL HEADER (Meta Data) --- */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-primary bg-white text-[9px] font-mono uppercase tracking-wider text-gray-500">
           <div className="flex gap-3">
              <span className="text-primary font-bold">{mainVariant?.isbn || 'N/A'}</span>
              <span className="hidden sm:inline text-primary/20">|</span>
              <span className="hidden sm:inline">{book.details.year}</span>
           </div>
           <div className="flex gap-2">
             <span className={`${book.variants.length > 1 ? 'text-accent' : ''}`}>
                {mainVariant ? formatLabel(mainVariant.format, language) : '—'}
             </span>
           </div>
        </div>

        {/* --- IMAGE AREA --- */}
        <div className="relative w-full aspect-[3/4] border-b border-primary overflow-hidden bg-[#F4F4F0] perspective-1000">
           {/* Badges (Absolute) */}
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

           {/* Main Image */}
           <div className="w-full h-full transform transition-transform duration-700 group-hover:scale-105">
             <FadeImage 
               src={book.coverUrl} 
               alt={book.title}
               className={`w-full h-full object-cover transition-all duration-[1000ms] ease-out-quart ${isSoldOut ? 'opacity-50 grayscale' : 'grayscale group-hover:grayscale-0'}`}
             />
           </div>

           {/* Sold Out Overlay - Updated to be straight/brutalist */}
           {isSoldOut && (
               <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[2px] z-10 pointer-events-none">
                 <div className="bg-primary text-white px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] border-2 border-white shadow-lg">
                    {t('common.sold_out')}
                 </div>
               </div>
           )}

           {/* INTERACTION OVERLAY (Quick Add) */}
           {!isSoldOut && isPurchasable && (
             <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out-quart z-20">
                <button
                  onClick={handleQuickAdd}
                  className="w-full bg-primary text-white py-4 flex items-center justify-center gap-2 text-xs uppercase font-bold tracking-widest hover:bg-accent transition-colors border-t border-white/20"
                >
                   <ShoppingBag size={14} />
                   <span>{actionLabel}</span>
                </button>
             </div>
           )}
           {!isSoldOut && !isPurchasable && (
             <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out-quart z-20">
                <span className="w-full bg-primary text-white py-4 flex items-center justify-center gap-2 text-xs uppercase font-bold tracking-widest border-t border-white/20">
                   <ArrowUpRight size={14} />
                   <span>{t('product.open_card')}</span>
                </span>
             </div>
           )}
        </div>

        {/* --- CONTENT BODY --- */}
        <div className="p-5 flex flex-col flex-1 justify-between gap-4 bg-white relative">
           
           <div>
             <h3 className="text-2xl font-serif leading-[1.0] mb-2 group-hover:text-accent transition-colors duration-300 line-clamp-2 min-h-[2em]">
                {book.title}
             </h3>
             <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-400 mb-4 truncate">
                {t('product.by_author')} <span className="text-primary font-bold">{book.author}</span>
             </p>
             
             {/* Genres Tags - Fade in on hover to keep clean look normally */}
             <div className="flex flex-wrap gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute top-[-1.5rem] right-2 bg-white px-2 border border-primary">
                {book.genre.slice(0, 1).map(g => (
                   <span key={g} className="text-[9px] uppercase font-bold tracking-wider text-primary">
                      {g}
                   </span>
                ))}
             </div>
           </div>

           {/* --- FOOTER: PRICE & STOCK --- */}
           <div className="pt-4 border-t border-gray-100 flex items-end justify-between">
              <div>
                 {isPurchasable && book.oldPrice ? (
                    <span className="block text-xs text-gray-400 line-through decoration-red-500 decoration-1 mb-0.5">
                       {book.oldPrice.toFixed(2)} {region.currency}
                    </span>
                 ) : null}
                 <span className={`block leading-none ${isPurchasable ? 'font-serif text-xl font-medium' : 'font-mono text-xs uppercase tracking-wider text-gray-500'}`}>
                    {isPurchasable ? `${book.price.toFixed(2)} ${region.currency}` : t('product.price_on_request')}
                 </span>
              </div>

              {/* Action / Status Indicator */}
              <div className="flex flex-col items-end">
                 {isLowStock ? (
                    <div className="flex items-center gap-1 text-[9px] uppercase font-bold text-red-500 tracking-wider animate-pulse mb-1">
                       <AlertCircle size={10} /> <span>{t('common.last_stock', { count: book.stock })}</span>
                    </div>
                 ) : (
                    <div className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center group-hover:bg-primary group-hover:border-primary transition-all duration-300">
                        <ArrowUpRight className="text-gray-300 group-hover:text-white transition-colors" size={14} />
                    </div>
                 )}
              </div>
           </div>
        </div>

      </div>
    </Link>
  );
};
