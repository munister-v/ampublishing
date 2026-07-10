
import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, Menu, X, ArrowRight, Clock, Trash2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { setDocumentScrollLock } from '../utils/scrollLock';

export const BrandLogo: React.FC<{ className?: string; white?: boolean }> = ({ className = "w-10 h-10", white }) => (
  <img
    src={white ? '/logo-white.svg' : '/logo-dark.svg'}
    alt="AM Publishing"
    className={className}
    draggable={false}
  />
);

export const Header: React.FC = () => {
  const { cart, setCartOpen, language, setLanguage, t, searchHistory, addSearchHistory, clearSearchHistory, siteSettings } = useApp();
  const headerNav = (siteSettings?.headerNav || []).filter(item => item.enabled !== false);
  const brandShort = siteSettings?.brand?.short || 'AM Pub.';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  useEffect(() => {
    const shouldLock = mobileMenuOpen || searchOpen;
    setDocumentScrollLock(shouldLock);
    return () => setDocumentScrollLock(false);
  }, [mobileMenuOpen, searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      addSearchHistory(searchQuery.trim());
      navigate(`/catalog?search=${encodeURIComponent(searchQuery)}`);
      setSearchOpen(false);
    }
  };

  const handleHistoryClick = (term: string) => {
    setSearchQuery(term);
    navigate(`/catalog?search=${encodeURIComponent(term)}`);
    setSearchOpen(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-40 bg-[#F4F4F0] border-b border-primary text-primary h-[58px] md:h-[76px]">
        <div className="w-full h-full flex items-stretch">
          
          {/* Logo */}
          <Link to="/" className="w-[118px] md:w-[190px] border-r border-primary flex items-center justify-center group relative overflow-hidden flex-shrink-0 px-3 pressable">
             <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-out-quart" />
             <div className="relative z-10 w-full h-9 md:h-12">
                <BrandLogo className="w-full h-full object-contain absolute inset-0 transition-opacity duration-500 group-hover:opacity-0" />
                <BrandLogo white className="w-full h-full object-contain absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
             </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex flex-1 items-stretch border-r border-primary">
            {headerNav.map((item) => (
              <React.Fragment key={item.id}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex-1 flex items-center justify-center text-[10px] uppercase tracking-[0.25em] font-bold relative group overflow-hidden ${
                      isActive ? 'text-white' : 'text-primary'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className={`absolute inset-0 bg-primary ${isActive ? 'translate-y-0' : 'translate-y-full'} transition-transform duration-300`} />
                      <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out-quart" />
                      <span className="relative z-10 group-hover:text-white transition-colors duration-500">
                        {t(item.labelKey)}
                      </span>
                    </>
                  )}
                </NavLink>
              </React.Fragment>
            ))}
          </nav>

          <div className="flex-1 lg:hidden border-r border-primary"></div>

          {/* Tools Grid */}
          <div className="flex items-stretch">
             <button 
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Toggle Search"
              className={`w-[56px] md:w-[76px] border-r border-primary flex items-center justify-center transition-colors duration-500 relative group overflow-hidden ${searchOpen ? 'text-white' : ''}`}
            >
              <div className={`absolute inset-0 bg-primary transition-transform duration-500 ease-out-quart ${searchOpen ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0'}`}></div>
              <div className="relative z-10 group-hover:text-white transition-colors duration-500">
                 {searchOpen ? <X size={18} strokeWidth={1} /> : <Search size={18} strokeWidth={1} />}
              </div>
            </button>

            <div className="hidden md:flex flex-col w-[60px] border-r border-primary text-[9px] font-mono">
              {(['en', 'de', 'ru'] as const).map(lang => (
                <button 
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`flex-1 flex items-center justify-center uppercase hover:bg-accent hover:text-white transition-colors duration-500 ${language === lang ? 'bg-primary text-white' : ''}`}
                >
                  {lang}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setCartOpen(true)} 
              aria-label="Open Cart"
              className="w-[64px] md:w-[94px] flex items-center justify-center relative group overflow-hidden border-primary border-l md:border-l-0"
            >
              <div className="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out-quart"></div>
              <div className="relative z-10 flex items-center group-hover:text-white transition-colors duration-500">
                 <span className="font-mono text-sm mr-2">({cartCount})</span>
                 <ShoppingBag size={18} strokeWidth={1} />
              </div>
            </button>

             <button 
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Menu"
              className="lg:hidden w-[56px] border-l border-primary flex items-center justify-center bg-primary text-white"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Advanced Search Overlay */}
      {searchOpen && (
        <div className="fixed top-[58px] md:top-[76px] left-0 w-full max-h-[calc(100dvh-var(--header-offset))] overflow-y-auto scroll-panel bg-primary text-white z-30 border-b border-white/20 animate-slide-down origin-top gpu-accelerated shadow-2xl">
          <div className="container mx-auto grid grid-cols-1 md:grid-cols-12 min-h-[320px] md:min-h-[400px]">
            
            {/* Input Area */}
            <div className="md:col-span-8 p-8 md:p-16 border-b md:border-b-0 md:border-r border-white/10">
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('nav.search')}
                    className="w-full bg-transparent text-5xl md:text-7xl font-serif uppercase text-white placeholder:text-white/20 outline-none pb-4 border-b border-white/30 focus:border-accent transition-colors"
                  />
                  <button type="submit" className="absolute right-0 bottom-6 text-accent hover:text-white transition-colors">
                     <ArrowRight size={48} />
                  </button>
                </div>
              </form>
              <div className="mt-12">
                 <p className="text-xs uppercase tracking-widest text-white/40 mb-4">{t('nav.recent_searches')}</p>
                 <div className="flex flex-wrap gap-3">
                    {searchHistory.length > 0 ? searchHistory.map((term, i) => (
                      <button 
                        key={i}
                        onClick={() => handleHistoryClick(term)}
                        className="flex items-center gap-2 px-4 py-2 border border-white/20 hover:bg-white hover:text-primary transition-colors text-sm font-mono"
                      >
                         <Clock size={12} /> {term}
                      </button>
                    )) : (
                      <span className="text-sm font-mono text-white/20 italic">{t('nav.empty_archive')}</span>
                    )}
                 </div>
                 {searchHistory.length > 0 && (
                   <button onClick={clearSearchHistory} className="mt-6 flex items-center gap-2 text-xs text-red-400 hover:text-red-300">
                      <Trash2 size={12} /> {t('nav.clear_history')}
                   </button>
                 )}
              </div>
            </div>

            {/* Quick Links / Featured */}
            <div className="md:col-span-4 p-8 md:p-12 bg-white/5">
               <h3 className="font-bold text-xs uppercase tracking-widest mb-8 text-accent">{t('nav.trending')}</h3>
               <ul className="space-y-4">
                  <li>
                    <Link to="/catalog?genre=Философия" onClick={() => setSearchOpen(false)} className="text-2xl font-serif hover:text-accent transition-all flex justify-between group">
                       <span>{t('nav.quick_links.philosophy')}</span> <span className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">01</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/catalog?genre=Искусство" onClick={() => setSearchOpen(false)} className="text-2xl font-serif hover:text-accent transition-all flex justify-between group">
                       <span>{t('nav.quick_links.art')}</span> <span className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">02</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/catalog?badges=new" onClick={() => setSearchOpen(false)} className="text-2xl font-serif hover:text-accent transition-all flex justify-between group">
                       <span>{t('nav.quick_links.new')}</span> <span className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">03</span>
                    </Link>
                  </li>
               </ul>
            </div>

          </div>
        </div>
      )}

      {/* Mobile Menu (Existing) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-primary text-white flex flex-col animate-fade-in gpu-accelerated">
           <div className="h-[58px] border-b border-white/20 flex justify-end items-center px-4">
             <button onClick={() => setMobileMenuOpen(false)} aria-label="Close Menu" className="flex items-center gap-2 text-xs uppercase tracking-widest">
                {t('common.close')} <X size={20} />
             </button>
           </div>
           <nav className="flex-1 min-h-0 flex flex-col p-5 overflow-y-auto scroll-panel pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {headerNav.map((item, i) => (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-3xl sm:text-4xl font-serif py-4 border-b border-white/10 hover:pl-6 transition-all duration-700 ease-out-quart flex justify-between items-center group animate-fade-up gpu-accelerated"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {t(item.labelKey)}
                  <span className="text-xs font-mono opacity-0 group-hover:opacity-100 text-accent transition-opacity duration-700">0{i+1}</span>
                </Link>
              ))}
              <div className="mt-auto grid grid-cols-3 gap-px bg-white/20 border border-white/20 animate-fade-up delay-500 gpu-accelerated">
                 {(['en', 'de', 'ru'] as const).map(lang => (
                    <button 
                      key={lang}
                      onClick={() => setLanguage(lang)} 
                      className={`py-4 uppercase font-bold text-xs transition-colors duration-500 ${language === lang ? 'bg-white text-primary' : 'bg-primary'}`}
                    >
                      {lang}
                    </button>
                 ))}
              </div>
           </nav>
        </div>
      )}
    </>
  );
};
