
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Trash2, ArrowRight } from 'lucide-react';
import { useApp } from '../AppContext';
import { ConfirmRemoveModal } from './Modals';
import { formatLabel } from '../utils/formatLabel';
import { setDocumentScrollLock } from '../utils/scrollLock';

export const CartDrawer: React.FC = () => {
  const { cart, cartOpen, setCartOpen, removeFromCart, updateQuantity, region, t, books, language } = useApp();
  const [itemToRemove, setItemToRemove] = useState<{id: string, name: string} | null>(null);

  const total = cart.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);

  useEffect(() => {
    setDocumentScrollLock(cartOpen);
    return () => setDocumentScrollLock(false);
  }, [cartOpen]);
  
  if (!cartOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end font-mono">
        {/* Backdrop Fade - use opacity only */}
        <div 
          className="absolute inset-0 bg-primary/40 backdrop-blur-sm animate-fade-in gpu-accelerated"
          onClick={() => setCartOpen(false)}
        ></div>

        {/* Drawer Slide - strictly transform */}
        <div className="relative w-full max-w-md bg-[#F4F4F0] border-l border-primary shadow-2xl h-dvh flex flex-col animate-slide-in-right gpu-accelerated">
          
          <div className="p-6 border-b border-primary flex items-center justify-between bg-white">
            <h2 className="text-xl uppercase tracking-widest font-bold">{t('cart.your_order')}</h2>
            <button onClick={() => setCartOpen(false)} aria-label="Close cart" className="hover:rotate-90 transition-transform duration-700 ease-out-quart">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto scroll-panel p-6 space-y-6">
            {cart.length === 0 ? (
              <div className="text-center py-20 opacity-50 uppercase animate-fade-up">
                [ {t('cart.empty')} ]
              </div>
            ) : (
              cart.map((item, i) => {
                 // Lookup current book data for localized title
                 const currentBook = books.find(b => b.id === item.bookId);
                 // Fallback to item snapshot if book not found (unlikely)
                 const displayTitle = currentBook ? currentBook.title : item.title;

                 return (
                  <div 
                    key={item.variantId} 
                    className="border border-primary bg-white p-4 shadow-[4px_4px_0px_0px_rgba(4,15,30,1)] animate-fade-up gpu-accelerated"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-20 border border-primary flex-shrink-0 overflow-hidden">
                        <img src={item.coverUrl} alt={displayTitle} className="w-full h-full object-cover grayscale" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-serif text-lg leading-none max-w-[150px]">{displayTitle}</h4>
                          <span className="text-xs font-bold">{(item.variant.price * item.quantity).toFixed(2)}</span>
                        </div>
                        <div className="text-[10px] uppercase text-gray-500 mb-2">
                          {formatLabel(item.variant.format, language)} / {item.variant.language}
                        </div>
                        
                        <div className="flex justify-between items-end mt-4">
                          <div className="flex border border-primary min-h-11">
                              <button onClick={() => item.quantity > 1 ? updateQuantity(item.variantId, -1) : setItemToRemove({id: item.variantId, name: displayTitle})} className="px-3 hover:bg-primary hover:text-white transition-colors pressable">-</button>
                              <span className="px-3 flex items-center bg-gray-100">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.variantId, 1)} className="px-3 hover:bg-primary hover:text-white transition-colors pressable">+</button>
                          </div>
                          <button onClick={() => setItemToRemove({id: item.variantId, name: displayTitle})} className="text-xs uppercase underline hover:text-red-600 transition-colors">{t('cart.delete')}</button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-[9px] uppercase tracking-widest text-gray-400">
                      {t('cart.item_no')} {i+1} / ISBN {item.variant.isbn}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {cart.length > 0 && (
            <div className="p-6 bg-white border-t border-primary animate-fade-up delay-200">
              <div className="space-y-2 mb-6 text-sm uppercase">
                 <div className="flex justify-between border-b border-dashed border-gray-300 pb-2">
                    <span>{t('cart.summary')}</span>
                    <span>{total.toFixed(2)} {region.currency}</span>
                 </div>
                 <div className="flex justify-between font-bold text-lg pt-2">
                    <span>{t('cart.total')}</span>
                    <span>{total.toFixed(2)} {region.currency}</span>
                 </div>
              </div>
              
              <Link 
                  to="/cart"
                  onClick={() => setCartOpen(false)}
                  className="block w-full bg-primary text-white py-4 uppercase tracking-[0.2em] text-xs font-bold text-center hover:bg-accent hover:text-primary transition-colors border border-primary duration-300 hover:shadow-lg"
                >
                  {t('cart.checkout')}
              </Link>
            </div>
          )}
        </div>
      </div>

      <ConfirmRemoveModal 
        isOpen={!!itemToRemove} 
        onClose={() => setItemToRemove(null)}
        onConfirm={() => {
          if(itemToRemove) removeFromCart(itemToRemove.id);
          setItemToRemove(null);
        }}
        itemName={itemToRemove?.name || ''}
      />
    </>
  );
};
