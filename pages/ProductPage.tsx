
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Minus, Plus, ArrowLeft, AlertCircle, ArrowUpRight } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { BookVariant, Format } from '../types';
import { formatLabel } from '../utils/formatLabel';

export const ProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { addToCart, region, t, addRecentlyViewed, books, language } = useApp();
  const book = books.find(b => b.id === id);
  const [qty, setQty] = useState(1);
  const relatedBooks = book ? books.filter(b => b.genre[0] === book.genre[0] && b.id !== book.id).slice(0, 4) : [];
  
  // Variant Logic
  const [selectedFormat, setSelectedFormat] = useState<Format | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [currentVariant, setCurrentVariant] = useState<BookVariant | null>(null);

  useEffect(() => {
    if (book) {
      addRecentlyViewed(book);
      // Default selection
      if (book.variants.length > 0) {
        const defaultVar = book.variants[0];
        setSelectedFormat(defaultVar.format);
        setSelectedLanguage(defaultVar.language);
        setCurrentVariant(defaultVar);
      }
    }
  }, [book, id]);

  useEffect(() => {
    if (book && selectedFormat && selectedLanguage) {
      const v = book.variants.find(v => v.format === selectedFormat && v.language === selectedLanguage);
      setCurrentVariant(v || null);
    }
  }, [selectedFormat, selectedLanguage, book]);

  if (!book) return <div className="pt-32 text-center font-mono uppercase">{t('product.not_found')}</div>;

  const availableFormats = Array.from(new Set(book.variants.map(v => v.format))) as Format[];
  
  // Get languages available for the currently selected format
  const availableLanguages = selectedFormat 
    ? Array.from(new Set(book.variants.filter(v => v.format === selectedFormat).map(v => v.language)))
    : [];

  const handleFormatChange = (newFormat: Format) => {
    setSelectedFormat(newFormat);
    // Smart language selection: try to keep current language, else pick first available
    const newLangs = Array.from(new Set(book.variants.filter(v => v.format === newFormat).map(v => v.language)));
    if (selectedLanguage && newLangs.includes(selectedLanguage)) {
        // Keep current
    } else if (newLangs.length > 0) {
        setSelectedLanguage(newLangs[0]);
    } else {
        setSelectedLanguage(null);
    }
  };

  const handleAddToCart = () => {
    if (currentVariant && currentVariant.stock > 0) {
      addToCart(book, currentVariant, qty);
    }
  };

  return (
    <div className="bg-[#F4F4F0] min-h-screen pt-[60px] md:pt-[80px]">
      
      {/* HEADER NAV */}
      <div className="border-b border-primary px-4 py-2 flex justify-between items-center bg-white sticky top-[60px] md:top-[80px] z-20">
         <Link to="/catalog" className="flex items-center gap-2 text-[10px] uppercase font-bold hover:text-accent">
            <ArrowLeft size={12} /> {t('cart.back_to_catalog')}
         </Link>
         {/* Fix: Display variant ISBN or fallback */}
         <span className="font-mono text-[10px]">{currentVariant ? currentVariant.isbn : (book.variants[0]?.isbn || '')}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 border-b border-primary">
         
         {/* LEFT: IMAGE (Sticky) */}
         <div className="lg:border-r border-primary bg-[#E8EDF2] relative h-[60vh] lg:h-[calc(100vh-120px)] sticky top-[120px] lg:top-[120px] flex items-center justify-center p-8 lg:p-20 overflow-hidden">
             <div className="relative w-full h-full shadow-[20px_20px_0px_0px_rgba(4,15,30,0.1)] border border-primary bg-white animate-fade-in">
                <img 
                  src={book.coverUrl} 
                  alt={book.title}
                  className="w-full h-full object-cover grayscale contrast-110"
                />
             </div>
             {/* Badge */}
             <div className="absolute top-8 left-8 bg-primary text-white px-3 py-1 font-mono text-xs">
                FIG. {book.id}
             </div>
         </div>

         {/* RIGHT: INFO (Scrollable) */}
         <div className="bg-white flex flex-col min-h-[calc(100vh-120px)] border-t lg:border-t-0 border-primary">
            
            <div className="p-8 md:p-16 flex-1">
               <div className="mb-12">
                  <span className="block text-accent font-mono text-xs mb-4 uppercase tracking-widest">{book.genre[0]}</span>
                  <h1 className="text-6xl md:text-8xl font-serif leading-[0.85] text-primary mb-6 -ml-1">
                    {book.title}
                  </h1>
                  <p className="text-xl md:text-2xl font-serif italic text-gray-500 border-l-2 border-accent pl-6">
                    {t('product.by_author')} {book.author}
                  </p>
               </div>

               <div className="grid grid-cols-2 border-y border-primary">
                  <div className="border-r border-primary p-6">
                     <span className="block text-[10px] uppercase text-gray-400 mb-2">{t('product.details.year')}</span>
                     <span className="font-mono text-lg">{book.details.year}</span>
                  </div>
                  <div className="p-6">
                     <span className="block text-[10px] uppercase text-gray-400 mb-2">{t('product.details.pages')}</span>
                     <span className="font-mono text-lg">{book.details.pages}</span>
                  </div>
               </div>
               
               {/* VARIANTS SELECTOR */}
               <div className="py-8 border-b border-primary">
                  <div className="mb-6">
                    <span className="block text-[10px] uppercase text-gray-400 mb-3 tracking-widest">{t('product.format')}</span>
                    <div className="flex flex-wrap gap-3">
                      {availableFormats.map(f => (
                        <button
                          key={f}
                          onClick={() => handleFormatChange(f)}
                          className={`px-4 py-2 border font-mono text-xs uppercase transition-all ${selectedFormat === f ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary hover:bg-gray-100'}`}
                        >
                          {formatLabel(f, language)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedFormat && (
                    <div className="mb-4">
                      <span className="block text-[10px] uppercase text-gray-400 mb-3 tracking-widest">{t('product.language')}</span>
                      <div className="flex flex-wrap gap-3">
                        {availableLanguages.map(l => (
                          <button
                            key={l}
                            onClick={() => setSelectedLanguage(l)}
                            className={`px-4 py-2 border font-mono text-xs uppercase transition-all ${selectedLanguage === l ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary hover:bg-gray-100'}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {book.story?.detailPageUrl ? (
                    <div className="mt-6">
                      <a
                        href={book.story.detailPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 border border-primary px-5 py-3 text-xs uppercase tracking-[0.2em] font-bold hover:bg-primary hover:text-white transition-colors"
                      >
                        {t('product.read_full_story')}
                        <ArrowUpRight size={14} />
                      </a>
                      <p className="mt-3 text-sm text-gray-500">
                        {t('product.full_story_note')}
                      </p>
                    </div>
                  ) : null}

                  {!currentVariant && selectedFormat && (
                     <p className="text-red-500 text-xs font-mono flex items-center gap-2 mt-4"><AlertCircle size={12}/> {t('product.variant_unavailable')}</p>
                  )}
               </div>

               <div className="py-12">
                  <p className="text-lg leading-relaxed font-light text-justify">
                     {book.description}
                  </p>
               </div>

               {book.story?.quote && (
                  <div className="border-l-4 border-accent pl-6 py-2 mb-12">
                     <p className="text-3xl md:text-5xl font-serif leading-[1.05] italic text-primary">
                        {book.story.quote}
                     </p>
                     {book.story.quoteSource && (
                        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500">
                           {book.story.quoteSource}
                        </p>
                     )}
                  </div>
               )}

               {book.story?.featureImageUrl ? (
                  <section className="border-t border-primary py-10">
                     <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] border border-primary overflow-hidden">
                        <div className="bg-[#E8EDF2] min-h-[360px]">
                           <img
                              src={book.story.featureImageUrl}
                              alt={book.title}
                              className="w-full h-full object-cover"
                           />
                        </div>
                        <div className="p-8 md:p-10 bg-[#F4F4F0]">
                           <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
                              {t('product.materiality')}
                           </p>
                           <h2 className="text-4xl md:text-5xl font-serif leading-[0.92] mb-6">
                              {t('product.book_as_object')}
                           </h2>
                           <p className="text-lg leading-relaxed text-gray-700">
                              {book.story.orderNote}
                           </p>
                        </div>
                     </div>
                  </section>
               ) : null}

               <section className="border-t border-primary py-10">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent mb-4">
                     {t('product.payment_info_title')}
                  </p>
                  <div className="border border-primary bg-[#F4F4F0] p-6 md:p-8">
                     <p className="text-lg leading-relaxed text-gray-700">
                        {t('product.payment_info_text')}
                     </p>
                  </div>
               </section>
            </div>

            {/* ACTION FOOTER */}
            {/* Added 'pb-safe-b' to respect Safe Area on iOS */}
            <div className="border-t border-primary bg-[#F4F4F0] p-6 md:p-8 sticky bottom-0 z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
               <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-baseline">
                     <span className="font-mono text-xs uppercase">{t('cart.total')}</span>
                     <span className="text-4xl font-serif">
                       {currentVariant ? currentVariant.price.toFixed(2) : book.price.toFixed(2)} {region.currency}
                     </span>
                  </div>
                  
                  <div className="flex border border-primary bg-white h-14 md:h-14">
                     <button onClick={() => setQty(Math.max(1, qty-1))} className="w-14 border-r border-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors">
                        <Minus size={16} />
                     </button>
                     <div className="flex-1 flex items-center justify-center font-mono text-lg border-r border-primary">
                        {qty}
                     </div>
                     <button onClick={() => setQty(qty+1)} className="w-14 border-r border-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors">
                        <Plus size={16} />
                     </button>
                     <button 
                        onClick={handleAddToCart}
                        className="flex-[2] bg-primary text-white hover:bg-accent transition-colors uppercase font-bold text-sm tracking-widest disabled:bg-gray-300 disabled:cursor-not-allowed"
                        disabled={!currentVariant || currentVariant.stock === 0}
                     >
                        {!currentVariant 
                           ? t('product.select_variant') 
                           : currentVariant.stock > 0 
                             ? t('product.add_to_cart') 
                             : t('product.out_of_stock')
                        }
                     </button>
                  </div>
               </div>
            </div>

         </div>
      </div>

      {relatedBooks.length > 0 ? (
        <div className="border-t border-primary">
           <div className="p-4 border-b border-primary bg-accent text-primary">
              <h3 className="font-mono text-xs uppercase tracking-widest">{t('product.you_may_like')}</h3>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 border-b border-primary">
              {relatedBooks.map(rb => (
                 <ProductCard key={rb.id} book={rb} />
              ))}
           </div>
        </div>
      ) : null}
    </div>
  );
};
