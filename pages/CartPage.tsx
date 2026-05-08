
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ConfirmRemoveModal } from '../components/Modals';
import { Trash2 } from 'lucide-react';

export const CartPage: React.FC = () => {
  const { cart, removeFromCart, updateQuantity, region, t } = useApp();
  const [itemToRemove, setItemToRemove] = useState<{id: string, name: string} | null>(null);

  const total = cart.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);

  return (
    <div className="bg-[#F4F4F0] min-h-screen pt-[60px] md:pt-[80px]">
      <div className="border-b border-primary p-6 md:p-12 bg-white">
        <h1 className="text-6xl md:text-9xl font-serif uppercase leading-none text-primary break-words">
           {t('cart.title')} <span className="text-3xl align-top text-gray-400">({cart.length})</span>
        </h1>
      </div>

      {cart.length === 0 ? (
        <div className="p-20 text-center">
           <p className="font-mono text-xl mb-8 uppercase text-gray-500">{t('cart.empty_desc')}</p>
           <Link to="/shop" className="bg-primary text-white px-8 py-3 uppercase font-bold text-xs hover:bg-accent transition-colors">
              {t('cart.go_to_catalog')}
           </Link>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row min-h-[60vh]">
           
           {/* TABLE */}
           <div className="flex-1 border-b lg:border-b-0 lg:border-r border-primary bg-white">
              {/* Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-primary font-mono text-xs uppercase tracking-widest text-gray-500">
                 <div className="col-span-6">Item Description</div>
                 <div className="col-span-2 text-center">Unit Price</div>
                 <div className="col-span-2 text-center">Qty</div>
                 <div className="col-span-2 text-right">Total</div>
              </div>

              {cart.map(item => (
                 <div key={item.variantId} className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 border-b border-primary items-center hover:bg-gray-50">
                    <div className="col-span-6 flex gap-6">
                       <Link to={`/product/${item.bookId}`} className="block w-20 h-28 flex-shrink-0 border border-primary overflow-hidden">
                          <img src={item.coverUrl} className="w-full h-full object-cover grayscale hover:scale-110 transition-transform duration-700" />
                       </Link>
                       <div>
                          <h3 className="font-serif text-2xl leading-none mb-2">{item.title}</h3>
                          <p className="font-mono text-xs text-gray-500 uppercase mb-1">{item.author}</p>
                          <div className="flex gap-2 mt-2">
                             <span className="bg-primary text-white px-2 py-0.5 text-[10px] uppercase">{item.variant.format}</span>
                             <span className="border border-primary px-2 py-0.5 text-[10px] uppercase">{item.variant.language}</span>
                          </div>
                          <span className="block mt-2 text-[9px] font-mono text-gray-400">SKU: {item.variantId}</span>
                       </div>
                    </div>
                    
                    <div className="col-span-2 text-center font-mono text-sm hidden md:block">
                       {item.variant.price.toFixed(2)}
                    </div>

                    <div className="col-span-2 flex justify-center items-center">
                       <div className="flex border border-primary bg-white h-8 w-fit">
                          <button onClick={() => item.quantity > 1 ? updateQuantity(item.variantId, -1) : setItemToRemove({id: item.variantId, name: item.title})} className="px-3 hover:bg-primary hover:text-white transition-colors">-</button>
                          <span className="px-3 flex items-center border-x border-primary font-mono min-w-[30px] justify-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.variantId, 1)} className="px-3 hover:bg-primary hover:text-white transition-colors">+</button>
                       </div>
                    </div>

                    <div className="col-span-2 text-right font-bold font-mono text-lg">
                       {(item.variant.price * item.quantity).toFixed(2)} {region.currency}
                    </div>
                 </div>
              ))}
           </div>

           {/* TOTALS SIDEBAR */}
           <div className="w-full lg:w-[400px] bg-[#E8EDF2] p-8 lg:p-12 flex flex-col justify-between sticky top-[80px] h-fit">
              <div>
                 <h2 className="text-3xl font-serif mb-8">{t('cart.summary')}</h2>
                 <div className="space-y-4 font-mono text-sm uppercase">
                    <div className="flex justify-between border-b border-primary/20 pb-2">
                       <span>{t('cart.summary')}</span>
                       <span>{total.toFixed(2)} {region.currency}</span>
                    </div>
                    <div className="flex justify-between border-b border-primary/20 pb-2">
                       <span>{t('cart.delivery')}</span>
                       <span>Calc. next step</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold pt-4">
                       <span>{t('cart.total')}</span>
                       <span>{total.toFixed(2)} {region.currency}</span>
                    </div>
                 </div>
              </div>
              
              <Link to="/checkout" className="block w-full text-center bg-primary text-white py-6 mt-12 uppercase font-bold tracking-[0.2em] text-sm hover:bg-accent transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none border border-primary">
                 {t('cart.checkout')}
              </Link>
           </div>
        </div>
      )}

      <ConfirmRemoveModal 
        isOpen={!!itemToRemove} 
        onClose={() => setItemToRemove(null)}
        onConfirm={() => {
           if(itemToRemove) removeFromCart(itemToRemove.id);
           setItemToRemove(null);
        }}
        itemName={itemToRemove?.name || ''}
      />
    </div>
  );
};
