
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Filter, X, ChevronDown, ChevronUp, RefreshCw, Check, LayoutGrid, List } from 'lucide-react';
import { useApp } from '../AppContext';
import { SortOption, Format } from '../types';

// Helper for Accordion Items
const FilterAccordion: React.FC<{ title: string; children: React.ReactNode; isOpen?: boolean }> = ({ title, children, isOpen = true }) => {
  return (
    <details className="group border-b border-primary/20" open={isOpen}>
      <summary className="flex justify-between items-center py-4 cursor-pointer list-none outline-none group-focus:text-accent">
        <span className="font-bold uppercase text-xs tracking-widest">{title}</span>
        <span className="transition-transform group-open:rotate-180">
           <ChevronDown size={14} />
        </span>
      </summary>
      <div className="pb-6 animate-fade-in">
        {children}
      </div>
    </details>
  );
};

const ProductSkeleton = () => (
    <div className="border-r border-b border-primary h-full">
        <div className="h-[300px] bg-gray-200 animate-pulse"></div>
        <div className="p-5 space-y-4">
            <div className="h-6 bg-gray-200 w-3/4 animate-pulse"></div>
            <div className="h-4 bg-gray-200 w-1/2 animate-pulse"></div>
            <div className="h-8 bg-gray-200 w-full mt-4 animate-pulse"></div>
        </div>
    </div>
);

export const CatalogPage: React.FC = () => {
  const { t, books, genres, authors, region } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFiltering, setIsFiltering] = useState(false);
  
  // Local state for Price Range Inputs (debounced effectively by Update button or Blur)
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');

  // --- QUERY PARAMS STATE ---
  const searchQuery = searchParams.get('search');
  const activeGenres = searchParams.getAll('genre');
  const activeAuthors = searchParams.getAll('author');
  const activeFormats = searchParams.getAll('format') as Format[];
  const activeSort = (searchParams.get('sort') as SortOption) || 'default';
  const showPreorders = searchParams.get('preorder') === 'true';
  const showInStock = searchParams.get('instock') === 'true';
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : null;
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : null;

  // Fake loading effect on filter change
  useEffect(() => {
      setIsFiltering(true);
      const timer = setTimeout(() => setIsFiltering(false), 400);
      return () => clearTimeout(timer);
  }, [searchParams]);

  // Sync inputs with URL
  useEffect(() => {
      setMinPriceInput(minPrice?.toString() || '');
      setMaxPriceInput(maxPrice?.toString() || '');
  }, [minPrice, maxPrice]);

  // --- FILTERING LOGIC ---
  let filteredBooks = books.filter(book => {
    // 1. Text Search
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = book.title.toLowerCase().includes(q);
        const matchesAuthor = book.author.toLowerCase().includes(q);
        const matchesISBN = book.variants.some(v => v.isbn.toLowerCase().includes(q));
        if (!matchesTitle && !matchesAuthor && !matchesISBN) return false;
    }
    
    // 2. Taxonomy
    if (activeGenres.length > 0 && !book.genre.some(g => activeGenres.includes(g))) return false;
    if (activeAuthors.length > 0 && !activeAuthors.includes(book.author)) return false;

    // 3. Formats
    if (activeFormats.length > 0) {
        const hasFormat = book.variants.some(v => activeFormats.includes(v.format));
        if (!hasFormat) return false;
    }

    // 4. Availability
    if (showPreorders && !book.isPreorder) return false;
    if (showInStock && book.stock <= 0) return false;

    // 5. Price Range
    if (minPrice !== null && book.price < minPrice) return false;
    if (maxPrice !== null && book.price > maxPrice) return false;

    return true;
  });

  // --- SORTING LOGIC ---
  filteredBooks = filteredBooks.sort((a, b) => {
      switch (activeSort) {
          case 'newest':
              return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
          case 'price_asc':
              return a.price - b.price;
          case 'price_desc':
              return b.price - a.price;
          case 'alpha_asc':
              return a.title.localeCompare(b.title);
          default:
              // Default: Promote 'new' and 'bestseller'
              const scoreA = (a.badges.includes('new') ? 2 : 0) + (a.badges.includes('bestseller') ? 1 : 0);
              const scoreB = (b.badges.includes('new') ? 2 : 0) + (b.badges.includes('bestseller') ? 1 : 0);
              return scoreB - scoreA;
      }
  });

  // --- PAGINATION MOCK ---
  const [displayLimit, setDisplayLimit] = useState(12);
  const visibleBooks = filteredBooks.slice(0, displayLimit);
  const handleLoadMore = () => setDisplayLimit(prev => prev + 12);

  // --- HANDLERS ---
  const updateParams = (key: string, value: string | null, mode: 'toggle' | 'set' = 'toggle') => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value === null) {
          newParams.delete(key);
          return newParams;
      }

      if (mode === 'set') {
          newParams.set(key, value);
      } else {
          const current = newParams.getAll(key);
          if (current.includes(value)) {
            newParams.delete(key);
            current.filter(c => c !== value).forEach(c => newParams.append(key, c));
          } else {
            newParams.append(key, value);
          }
      }
      return newParams;
    });
  };

  const applyPriceFilter = () => {
      setSearchParams(prev => {
          const p = new URLSearchParams(prev);
          if (minPriceInput) p.set('minPrice', minPriceInput); else p.delete('minPrice');
          if (maxPriceInput) p.set('maxPrice', maxPriceInput); else p.delete('maxPrice');
          return p;
      });
  };

  const clearAllFilters = () => {
      setSearchParams({});
      setDisplayLimit(12);
  };

  const sortOptions: SortOption[] = ['default', 'newest', 'price_asc', 'price_desc', 'alpha_asc'];
  const allFormats: Format[] = ['hardcover', 'paperback', 'digital', 'special_edition'];

  return (
    <div className="bg-[#F4F4F0] pt-[58px] md:pt-[76px]">
      
      {/* 1. CATALOG HEADER */}
      <div className="border-b border-primary p-6 md:p-12 bg-white flex flex-col md:flex-row justify-between items-end gap-6 relative z-20">
        <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400 block mb-2">{t('catalog.archive_label')}</span>
            <h1 className="text-5xl md:text-8xl font-serif uppercase leading-[0.9] text-primary break-words">
                {searchQuery ? t('catalog.title_search') : t('catalog.title_all')}
            </h1>
            <div className="flex items-center gap-4 mt-6">
               <span className="font-mono text-xs bg-primary text-white px-2 py-1">
                  {t('catalog.items_count', { count: filteredBooks.length })}
               </span>
               {(activeGenres.length > 0 || activeAuthors.length > 0 || minPrice || maxPrice) && (
                   <button onClick={clearAllFilters} className="text-xs uppercase underline text-red-500 hover:no-underline">
                      {t('catalog.filters.clear_all')}
                   </button>
               )}
            </div>
        </div>
        
        {/* Sort & View Tools (Desktop) */}
        <div className="flex gap-4 hidden md:flex">
            {/* View Toggle */}
            <div className="flex border border-primary bg-white">
                <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-3 transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-primary hover:bg-gray-100'}`}
                    title={t('catalog.view_grid')}
                >
                    <LayoutGrid size={16} />
                </button>
                <div className="w-[1px] bg-primary"></div>
                <button 
                    onClick={() => setViewMode('list')}
                    className={`p-3 transition-colors ${viewMode === 'list' ? 'bg-primary text-white' : 'text-primary hover:bg-gray-100'}`}
                    title={t('catalog.view_list')}
                >
                    <List size={16} />
                </button>
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => setSortOpen(!sortOpen)}
                    className="flex items-center gap-4 font-mono text-xs uppercase tracking-widest border border-primary px-6 py-3 hover:bg-primary hover:text-white transition-colors bg-white min-w-[220px] justify-between h-full"
                >
                    <span>{t('catalog.sort_by')}: <span className="font-bold ml-1">{t(`catalog.sort_options.${activeSort}`)}</span></span>
                    <ChevronDown size={14} className={`transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {sortOpen && (
                    <div className="absolute right-0 top-full mt-[-1px] w-full bg-white border border-primary shadow-xl z-20 animate-fade-in">
                        {sortOptions.map(opt => (
                            <button
                                key={opt}
                                onClick={() => {
                                    updateParams('sort', opt, 'set');
                                    setSortOpen(false);
                                }}
                                className={`block w-full text-left px-6 py-3 font-mono text-xs uppercase hover:bg-bg transition-colors ${activeSort === opt ? 'bg-primary text-white hover:bg-primary hover:text-white' : ''}`}
                            >
                                {t(`catalog.sort_options.${opt}`)}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row border-b border-primary md:min-h-[calc(100vh-80px)] relative">
        
        {/* 2. SIDEBAR FILTERS (Sticky) */}
        <aside className="hidden md:block w-[300px] xl:w-[360px] border-r border-primary bg-[#F4F4F0] flex-shrink-0 relative z-10">
           <div className="sticky top-[76px] h-[calc(100vh-76px)] overflow-y-auto custom-scrollbar p-8">
              
              {/* Removed Active Filters Block as requested */}

              {/* Price Range */}
              <FilterAccordion title={t('catalog.filters.price_range')}>
                 <div className="flex items-center gap-2 mb-4">
                    <input 
                       type="number" 
                       placeholder="Min"
                       value={minPriceInput}
                       onChange={e => setMinPriceInput(e.target.value)}
                       className="w-full bg-white border border-primary p-2 text-sm font-mono focus:bg-accent/10 outline-none"
                    />
                    <span className="text-gray-400">-</span>
                    <input 
                       type="number" 
                       placeholder="Max"
                       value={maxPriceInput}
                       onChange={e => setMaxPriceInput(e.target.value)}
                       className="w-full bg-white border border-primary p-2 text-sm font-mono focus:bg-accent/10 outline-none"
                    />
                 </div>
                 <button onClick={applyPriceFilter} className="w-full bg-primary text-white py-2 text-[10px] uppercase font-bold tracking-widest hover:bg-accent transition-colors">{t('catalog.filters.apply')}</button>
              </FilterAccordion>

              {/* Availability */}
              <FilterAccordion title={t('catalog.filters.availability')}>
                 <label className="flex items-center gap-3 cursor-pointer group mb-2">
                    <div className={`w-4 h-4 border border-primary flex items-center justify-center transition-colors ${showInStock ? 'bg-primary' : 'bg-white'}`}>
                        {showInStock && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-sm font-mono uppercase text-gray-600 group-hover:text-primary">{t('catalog.filters.in_stock')}</span>
                    <input type="checkbox" className="hidden" checked={showInStock} onChange={() => updateParams('instock', showInStock ? 'false' : 'true', 'set')} />
                 </label>
                 <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-4 h-4 border border-primary flex items-center justify-center transition-colors ${showPreorders ? 'bg-primary' : 'bg-white'}`}>
                        {showPreorders && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-sm font-mono uppercase text-gray-600 group-hover:text-primary">{t('nav.preorder')}</span>
                    <input type="checkbox" className="hidden" checked={showPreorders} onChange={() => updateParams('preorder', showPreorders ? 'false' : 'true', 'set')} />
                 </label>
              </FilterAccordion>

              {/* Format */}
              <FilterAccordion title={t('catalog.filters.format')}>
                 <div className="flex flex-col gap-2">
                    {allFormats.map(f => (
                       <label key={f} className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-4 h-4 border border-primary flex items-center justify-center transition-colors ${activeFormats.includes(f) ? 'bg-primary' : 'bg-transparent'}`}>
                             {activeFormats.includes(f) && <div className="w-2 h-2 bg-white rounded-none" />}
                          </div>
                          <span className={`text-sm font-mono uppercase ${activeFormats.includes(f) ? 'text-primary font-bold' : 'text-gray-500 group-hover:text-primary'}`}>{t(`catalog.formats.${f}`)}</span>
                          <input type="checkbox" className="hidden" checked={activeFormats.includes(f)} onChange={() => updateParams('format', f)} />
                       </label>
                    ))}
                 </div>
              </FilterAccordion>

              {/* Genres - REMOVED */}

              {/* Authors */}
              <FilterAccordion title={t('catalog.filters.authors')}>
                 <div className="flex flex-col gap-2">
                    {authors.map(a => (
                       <label key={a} className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-4 h-4 border border-primary flex items-center justify-center transition-colors ${activeAuthors.includes(a) ? 'bg-primary' : 'bg-transparent'}`}>
                             {activeAuthors.includes(a) && <div className="w-2 h-2 bg-white rounded-none" />}
                          </div>
                          <span className={`text-sm font-serif ${activeAuthors.includes(a) ? 'text-primary font-bold italic' : 'text-gray-500 group-hover:text-primary'}`}>{a}</span>
                          <input type="checkbox" className="hidden" checked={activeAuthors.includes(a)} onChange={() => updateParams('author', a)} />
                       </label>
                    ))}
                 </div>
              </FilterAccordion>

           </div>
        </aside>

        {/* Mobile Filter Button */}
        <div className="md:hidden border-b border-primary p-4 sticky top-[58px] bg-white z-30 flex justify-between items-center shadow-md">
            <span className="font-mono text-xs font-bold">{t('catalog.results_count', { count: filteredBooks.length })}</span>
            <button onClick={() => setMobileFiltersOpen(true)} className="flex items-center gap-2 text-xs uppercase font-bold border border-primary px-4 py-3 bg-primary text-white">
                {t('catalog.filters.title')} <Filter size={14}/>
            </button>
        </div>

        {/* 3. PRODUCT GRID / LIST */}
        <div className="flex-1 bg-white">
           {isFiltering ? (
               <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3' : 'flex flex-col'}`}>
                   {Array.from({length: 6}).map((_, i) => <ProductSkeleton key={i} />)}
               </div>
           ) : visibleBooks.length > 0 ? (
               <>
                   <div className={`${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3' : 'flex flex-col'}`}>
                      {visibleBooks.map(book => (
                         <ProductCard key={book.id} book={book} viewMode={viewMode} />
                      ))}
                   </div>
                   
                   {/* Load More / Pagination */}
                   {filteredBooks.length > visibleBooks.length && (
                       <div className="p-12 border-t border-primary flex justify-center bg-[#F4F4F0]">
                           <button 
                             onClick={handleLoadMore}
                             className="flex items-center gap-3 border border-primary px-8 py-4 uppercase font-bold text-xs tracking-[0.2em] hover:bg-primary hover:text-white transition-all group"
                           >
                              <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                              Load More ({filteredBooks.length - visibleBooks.length})
                           </button>
                       </div>
                   )}
               </>
           ) : (
               <div className="h-full flex flex-col items-center justify-center p-20 text-center font-mono uppercase text-gray-400">
                  <div className="w-20 h-20 border border-gray-200 flex items-center justify-center rounded-full mb-6">
                      <X size={32} className="opacity-50" />
                  </div>
                  <p className="mb-4">{t('catalog.filters.no_results')}</p>
                  <button onClick={clearAllFilters} className="text-xs underline hover:text-primary text-primary">
                      {t('catalog.filters.try_adjusting')}
                  </button>
               </div>
           )}
        </div>
      </div>

       {/* 4. MOBILE FILTERS OVERLAY */}
       {mobileFiltersOpen && (
         <div className="fixed inset-0 z-50 bg-[#F4F4F0] flex flex-col animate-fade-in">
            <div className="flex justify-between items-center p-6 border-b border-primary bg-white">
               <h2 className="text-3xl font-serif">{t('catalog.filters.title')}</h2>
               <button onClick={() => setMobileFiltersOpen(false)} className="p-2 border border-transparent hover:border-primary"><X size={24}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                {/* Mobile Sort */}
                <div>
                    <h3 className="font-bold mb-4 uppercase border-b border-primary/20 pb-2">{t('catalog.sort_by')}</h3>
                    <div className="flex flex-wrap gap-2">
                        {sortOptions.map(opt => (
                            <button
                                key={opt}
                                onClick={() => updateParams('sort', opt, 'set')}
                                className={`px-4 py-2 border text-xs font-mono uppercase ${activeSort === opt ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
                            >
                                {t(`catalog.sort_options.${opt}`)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Mobile Authors */}
                {authors.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-4 uppercase border-b border-primary/20 pb-2">{t('catalog.filters.authors')}</h3>
                    <div className="flex flex-col gap-3">
                      {authors.map(a => (
                        <label key={a} className="flex items-center gap-3 cursor-pointer group">
                          <div className={`w-5 h-5 border border-primary flex items-center justify-center flex-shrink-0 transition-colors ${activeAuthors.includes(a) ? 'bg-primary' : 'bg-transparent'}`}>
                            {activeAuthors.includes(a) && <div className="w-2.5 h-2.5 bg-white" />}
                          </div>
                          <span className={`text-sm font-serif ${activeAuthors.includes(a) ? 'text-primary font-bold italic' : 'text-gray-600'}`}>{a}</span>
                          <input type="checkbox" className="hidden" checked={activeAuthors.includes(a)} onChange={() => updateParams('author', a)} />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mobile Availability */}
                <div>
                  <h3 className="font-bold mb-4 uppercase border-b border-primary/20 pb-2">{t('catalog.filters.availability')}</h3>
                  <div className="flex flex-wrap gap-2">
                    {['instock', 'preorder'].map(opt => {
                      const paramKey = opt === 'instock' ? 'instock' : 'preorder';
                      const active = searchParams.get(paramKey) === 'true';
                      return (
                        <button key={opt} onClick={() => updateParams(paramKey, active ? null : 'true', 'set')}
                          className={`px-4 py-2 border text-xs font-mono uppercase ${active ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}>
                          {t(`catalog.filters.${opt}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
            </div>

            <div className="p-6 border-t border-primary bg-white">
               <button onClick={() => setMobileFiltersOpen(false)} className="w-full bg-primary text-white py-5 uppercase font-bold tracking-widest text-lg shadow-lg">
                   {t('catalog.filters.view_results', { count: filteredBooks.length })}
               </button>
            </div>
         </div>
      )}
    </div>
  );
};
