
import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ShoppingBag, Search, Menu, X, ArrowRight, Clock, Trash2 } from 'lucide-react';
import { useApp } from '../AppContext';

export const BrandLogo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="20" y="20" width="60" height="60" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M20 20 L80 80" stroke="currentColor" strokeWidth="1"/>
    <path d="M80 20 L20 80" stroke="currentColor" strokeWidth="1"/>
    <circle cx="50" cy="50" r="15" fill="currentColor"/>
  </svg>
);

export const Header: React.FC = () => {
  const { cart, setCartOpen, language, setLanguage, t, searchHistory, addSearchHistory, clearSearchHistory } = useApp();
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
      <header className="fixed top-0 left-0 w-full z-40 bg-[#F4F4F0] border-b border-primary text-primary h-[60px] md:h-[80px]">
        <div className="w-full h-full flex items-stretch">
          
          {/* Logo */}
          <Link to="/" className="w-[80px] md:w-[200px] border-r border-primary flex items-center justify-center md:justify-start md:px-6 group relative overflow-hidden">
             <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-out-quart"></div>
             <div className="flex items-center gap-3 relative z-10 group-hover:text-white transition-colors duration-500">
                <BrandLogo className="w-6 h-6 transition-transform duration-700 ease-out-quart group-hover:rotate-90" />
                <span className="hidden md:block font-bold text-xs uppercase tracking-[0.2em] transition-transform duration-700 ease-out-quart group-hover:translate-x-1">AM Pub.</span>
             </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex flex-1 items-stretch">
            {['catalog', 'our_authors', 'authors', 'about', 'media'].map((path) => (
              <NavLink 
                key={path}
                to={path === 'our_authors' ? '/our-authors' : `/${path}`} 
                className={({ isActive }) => 
                  `flex-1 flex items-center justify-center text-[10px] uppercase tracking-[0.25em] font-bold border-r border-primary relative group overflow-hidden ${isActive ? 'text-white' : 'text-primary'}`
                }
              >
                {/* Active State Background */}
                <div className={({ isActive }: any) => `absolute inset-0 bg-primary transition-transform duration-0 ${isActive ? 'translate-y-0' : 'translate-y-full'}`}></div>
                
                {/* Hover Animation Background */}
                <div className="absolute inset-0 bg-primary translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out-quart"></div>
                
                <span className="relative z-10 group-hover:text-white transition-colors duration-500">
                  {t(`nav.${path}`)}
                </span>
                
                {/* Active Indicator override */}
                <NavLink to={path === 'our_authors' ? '/our-authors' : `/${path}`} className={({isActive}) => isActive ? "absolute inset-0 bg-primary -z-0" : "hidden"}></NavLink>
              </NavLink>
            ))}
          </nav>

          <div className="flex-1 lg:hidden border-r border-primary"></div>

          {/* Tools Grid */}
          <div className="flex items-stretch">
             <button 
              onClick={() => setSearchOpen(!searchOpen)}
              className={`w-[60px] md:w-[80px] border-r border-primary flex items-center justify-center transition-colors duration-500 relative group overflow-hidden ${searchOpen ? 'text-white' : ''}`}
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
              className="w-[70px] md:w-[100px] flex items-center justify-center relative group overflow-hidden border-primary border-l md:border-l-0"
            >
              <div className="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out-quart"></div>
              <div className="relative z-10 flex items-center group-hover:text-white transition-colors duration-500">
                 <span className="font-mono text-sm mr-2">({cartCount})</span>
                 <ShoppingBag size={18} strokeWidth={1} />
              </div>
            </button>

             <button 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden w-[60px] border-l border-primary flex items-center justify-center bg-primary text-white"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Advanced Search Overlay */}
      {searchOpen && (
        <div className="fixed top-[60px] md:top-[80px] left-0 w-full bg-primary text-white z-30 border-b border-white/20 animate-slide-down origin-top gpu-accelerated shadow-2xl">
          <div className="container mx-auto grid grid-cols-1 md:grid-cols-12 min-h-[400px]">
            
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
           <div className="h-[60px] border-b border-white/20 flex justify-end items-center px-4">
             <button onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-xs uppercase tracking-widest">
                {t('common.close')} <X size={20} />
             </button>
           </div>
           <nav className="flex-1 flex flex-col p-6 overflow-y-auto">
              {['catalog', 'our_authors', 'authors', 'about', 'media'].map((path, i) => (
                <Link 
                  key={path}
                  to={path === 'our_authors' ? '/our-authors' : `/${path}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-5xl font-serif py-6 border-b border-white/10 hover:pl-6 transition-all duration-700 ease-out-quart flex justify-between items-center group animate-fade-up gpu-accelerated"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {t(`nav.${path}`)}
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
