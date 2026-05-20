
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, BookVariant, CartItem, Region, Language, NewsItem, Order, OrderStatus, TranslationOverrides } from './types';
import { REGIONS } from './constants';
import { translations } from './translations';
import { api } from './services/api';
import { contentStore } from './services/contentStore';
import { ToastMessage } from './components/Toast';

// --- Context Definition ---
interface AppContextType {
  books: Book[];
  news: NewsItem[];
  genres: string[];
  authors: string[];
  isLoadingData: boolean; 
  isBackendLive: boolean;
  
  // Auth
  isAdmin: boolean;
  login: (token: string) => void;
  logout: () => void;

  // Store Management (Admin)
  orders: Order[];
  refreshOrders: () => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  updateInventory: (bookId: string, stock: number) => Promise<void>;
  reloadContent: () => Promise<void>;

  cart: CartItem[];
  addToCart: (book: Book, variant: BookVariant, qty?: number) => void;
  removeFromCart: (variantId: string) => void;
  updateQuantity: (variantId: string, delta: number) => void;
  clearCart: () => void;
  
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  region: Region;
  setRegionById: (id: string) => void;
  
  // Age Gate
  checkAgeGate: (book: Book, onSuccess: () => void) => void;
  showAgeModal: boolean;
  handleAgeConfirm: () => void;
  handleAgeDeny: () => void;

  recentlyViewed: Book[];
  addRecentlyViewed: (book: Book) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => any;
  
  searchHistory: string[];
  addSearchHistory: (term: string) => void;
  clearSearchHistory: () => void;
  
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  removeToast: (id: string) => void;

  // Region Modal
  showRegionModal: boolean;
  setShowRegionModal: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  // --- DATA STATE ---
  const [books, setBooks] = useState<Book[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isBackendLive, setIsBackendLive] = useState(true);

  // --- ADMIN STATE ---
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [translationOverrides, setTranslationOverrides] = useState<TranslationOverrides>({ ru: {}, en: {}, de: {} });

  // --- CART STATE ---
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('am-cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [cartOpen, setCartOpen] = useState(false);

  // --- USER PREFS ---
  const [region, setRegion] = useState<Region>(REGIONS[0]);
  const [language, setLanguageState] = useState<Language>('ru');
  const [recentlyViewed, setRecentlyViewed] = useState<Book[]>(() => {
    try {
      const saved = localStorage.getItem('am-recent');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
      try {
        const saved = localStorage.getItem('search-history');
        return saved ? JSON.parse(saved) : [];
      } catch (e) { return []; }
  });

  // --- UI STATE ---
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [pendingAgeAction, setPendingAgeAction] = useState<(() => void) | null>(null);
  const [isAgeVerified, setIsAgeVerified] = useState(false);

  // --- ACTIONS (Hoisted) ---
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  // --- INITIAL LOAD ---
  const reloadContent = async () => {
      let booksData: Book[] = [];
      let newsData: NewsItem[] = [];
      let metaData: { genres: string[]; authors: string[]; series: string[] } = { genres: [], authors: [], series: [] };
      let overrides: TranslationOverrides = { ru: {}, en: {}, de: {} };

      setIsLoadingData(true);
      setIsBackendLive(true);

      try {
        [booksData, newsData, metaData, overrides] = await Promise.all([
          api.getBooks(language),
          api.getNews(language),
          api.getMetadata(language),
          api.getTranslationOverrides()
        ]);
        setBooks(booksData);
        setNews(newsData);
        setGenres(metaData.genres);
        setAuthors(metaData.authors);
        setTranslationOverrides(overrides);
      } catch (e) {
        showToast("Could not load content", "error");
        setBooks([]);
      } finally {
        setIsLoadingData(false);
      }
  };

  useEffect(() => {
    let mounted = true;
    const guardedReload = async () => {
      if (!mounted) return;
      await reloadContent();
    };
    guardedReload();

    // Check Auth Token (GitHub PAT)
    if (contentStore.isAuthenticated()) {
        setIsAdmin(true);
        // Load orders quietly if admin
        api.getOrders().then(data => mounted && setOrders(data)).catch(() => {});
    }

    return () => { mounted = false; };
  }, [language]);

  // Persistence
  useEffect(() => { localStorage.setItem('am-cart', JSON.stringify(cart)); }, [cart]);
  useEffect(() => { localStorage.setItem('am-recent', JSON.stringify(recentlyViewed)); }, [recentlyViewed]);

  // Init logic
  useEffect(() => {
    const savedRegion = localStorage.getItem('region-id');
    if (savedRegion) {
      const r = REGIONS.find(x => x.id === savedRegion);
      if (r) setRegion(r);
    } else {
      // DISABLED REGION MODAL POPUP - SILENT DEFAULT
      // setShowRegionModal(true); 
      setRegion(REGIONS[0]); // Default to first (usually World or DE)
      localStorage.setItem('region-id', REGIONS[0].id);
    }

    const savedAge = localStorage.getItem('age-verified');
    if (savedAge === 'true') setIsAgeVerified(true);

    const savedLang = localStorage.getItem('app-language') as Language;
    if (savedLang && ['ru', 'en', 'de'].includes(savedLang)) {
      setLanguageState(savedLang);
    } else {
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === 'ru' || browserLang === 'de') setLanguageState(browserLang as Language);
      else setLanguageState('en');
    }
  }, []);

  // --- ACTIONS ---

  const login = (_token: string) => {
      // PAT has already been stored by api.login() / contentStore.setPAT().
      setIsAdmin(true);
      refreshOrders(); // Load admin data
      showToast("Welcome back, Administrator");
      navigate('/admin');
  };

  const logout = () => {
      api.logout();
      setIsAdmin(false);
      setOrders([]);
      showToast("Logged out successfully");
      navigate('/login');
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const setRegionById = (id: string) => {
    const r = REGIONS.find(x => x.id === id);
    if (r) {
      setRegion(r);
      localStorage.setItem('region-id', id);
    }
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    const overrideValue = translationOverrides[language]?.[key];
    if (typeof overrideValue !== 'undefined') {
      if (typeof overrideValue === 'string' && params) {
        return overrideValue.replace(/{(\w+)}/g, (_, match) => String(params[match] || `{${match}}`));
      }
      return overrideValue;
    }

    const keys = key.split('.');
    let value: any = translations[language];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) value = value[k];
      else return key; 
    }
    if (typeof value === 'string' && params) {
        return value.replace(/{(\w+)}/g, (_, match) => String(params[match] || `{${match}}`));
    }
    return value;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const checkAgeGate = (book: Book, onSuccess: () => void) => {
    if (book.badges.includes('18+') && !isAgeVerified) {
      setPendingAgeAction(() => onSuccess);
      setShowAgeModal(true);
    } else {
      onSuccess();
    }
  };

  const handleAgeConfirm = () => {
    setIsAgeVerified(true);
    localStorage.setItem('age-verified', 'true');
    setShowAgeModal(false);
    if (pendingAgeAction) {
      pendingAgeAction();
      setPendingAgeAction(null);
    }
  };

  const handleAgeDeny = () => {
    setShowAgeModal(false);
    setPendingAgeAction(null);
    navigate('/');
  };

  const addToCart = (book: Book, variant: BookVariant, qty: number = 1) => {
    const currentItem = cart.find(i => i.variantId === variant.id);
    const currentQty = currentItem ? currentItem.quantity : 0;
    
    if (currentQty + qty > variant.stock) {
        showToast(`Sorry, only ${variant.stock} left in stock.`, 'error');
        return;
    }

    checkAgeGate(book, () => {
      setCart(prev => {
        const existing = prev.find(item => item.variantId === variant.id);
        if (existing) {
          return prev.map(item => 
            item.variantId === variant.id ? { ...item, quantity: item.quantity + qty } : item
          );
        }
        return [...prev, { 
          bookId: book.id,
          variantId: variant.id,
          title: book.title,
          author: book.author,
          coverUrl: book.coverUrl,
          variant: variant,
          quantity: qty 
        }];
      });
      showToast(`${book.title} added to cart`);
    });
  };

  const removeFromCart = (variantId: string) => {
    setCart(prev => prev.filter(item => item.variantId !== variantId));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('am-cart');
  };

  const updateQuantity = (variantId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const limit = item.variant.stock;
        const newQ = Math.max(1, Math.min(limit, item.quantity + delta));
        if (item.quantity + delta > limit) showToast(`Max stock reached`, 'error');
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  };

  const addRecentlyViewed = (book: Book) => {
    setRecentlyViewed(prev => {
      const filtered = prev.filter(b => b.id !== book.id);
      return [book, ...filtered].slice(0, 4);
    });
  };

  const addSearchHistory = (term: string) => {
    setSearchHistory(prev => {
      const newHist = [term, ...prev.filter(t => t !== term)].slice(0, 5);
      localStorage.setItem('search-history', JSON.stringify(newHist));
      return newHist;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('search-history');
  };

  // --- ADMIN FUNCTIONS (API INTEGRATED) ---
  
  const refreshOrders = async () => {
      try {
          const data = await api.getOrders();
          setOrders(data);
      } catch (e) {
          showToast("Failed to fetch orders", 'error');
      }
  };

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
      try {
          // Optimistic update
          setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
          await api.updateOrderStatus(id, status);
          showToast(`Order ${id} updated`);
      } catch (e) {
          // Revert on fail
          refreshOrders();
          showToast("Failed to update status", 'error');
      }
  };

  const updateInventory = async (bookId: string, stock: number) => {
      try {
          // Optimistic update
          setBooks(prev => prev.map(b => {
              if (b.id === bookId) {
                  return { ...b, stock, variants: b.variants.map(v => ({ ...v, stock })) };
              }
              return b;
          }));
          
          await api.updateInventory(bookId, stock);
          showToast(`Stock updated for item ${bookId}`);
      } catch (e) {
          // Revert (reload data)
          const data = await api.getBooks(language);
          setBooks(data);
          showToast("Failed to update stock", 'error');
      }
  };

  return (
    <AppContext.Provider value={{ 
      books, news, genres, authors, isLoadingData, isBackendLive,
      isAdmin, login, logout,
      orders, refreshOrders, updateOrderStatus, updateInventory, reloadContent,
      cart, addToCart, removeFromCart, updateQuantity, clearCart,
      cartOpen, setCartOpen, 
      region, setRegionById,
      checkAgeGate, showAgeModal, handleAgeConfirm, handleAgeDeny,
      recentlyViewed, addRecentlyViewed,
      language, setLanguage, t,
      searchHistory, addSearchHistory, clearSearchHistory,
      toasts, showToast, removeToast,
      showRegionModal, setShowRegionModal
    }}>
      {children}
    </AppContext.Provider>
  );
};
