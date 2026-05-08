import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../services/api';
import { autoTranslateBookFromRu, autoTranslateNewsFromRu, autoTranslateValue } from '../services/autoTranslate';
import { translations } from '../translations';
import { Book, Language, LocalizedCatalogData, NewsItem, OrderStatus, TranslationOverrides } from '../types';
import {
  BookOpen,
  FileText,
  Gavel,
  Globe,
  LogOut,
  Newspaper,
  RefreshCw,
  Save,
  ShoppingBag,
  Trash2,
  Plus,
  Loader2,
  CheckCircle,
  Upload,
  Download,
  ImagePlus,
  Menu,
  X,
} from 'lucide-react';

type AdminTab = 'copy' | 'books' | 'news' | 'orders';
type FieldType = 'text' | 'textarea' | 'json';

type ContentField = {
  key: string;
  label: string;
  type: FieldType;
};

type ContentGroup = {
  id: string;
  label: string;
  icon: React.ReactNode;
  fields: ContentField[];
};

type AdminDraftState = {
  copyDraftsByLanguage: Partial<Record<Language, Record<string, string>>>;
  selectedBookIdByLanguage: Partial<Record<Language, string>>;
  selectedNewsIdByLanguage: Partial<Record<Language, string>>;
  bookDraftByLanguage: Partial<Record<Language, Book>>;
  newsDraftByLanguage: Partial<Record<Language, NewsItem>>;
  bookJsonDraftsByLanguage: Partial<Record<Language, { variants: string; themes: string; reviews: string }>>;
};

const ADMIN_DRAFTS_KEY = 'am-admin-drafts-v2';

const contentGroups: ContentGroup[] = [
  {
    id: 'home',
    label: 'Homepage',
    icon: <Globe size={16} />,
    fields: [
      { key: 'home.hero_title_1', label: 'Hero title', type: 'text' },
      { key: 'home.hero_title_2', label: 'Hero title line 2', type: 'text' },
      { key: 'home.hero_subtitle', label: 'Hero subtitle', type: 'textarea' },
      { key: 'home.hero_cta', label: 'Hero CTA', type: 'text' },
      { key: 'home.hero_image', label: 'Hero image URL', type: 'text' },
      { key: 'home.feature_image', label: 'Feature image URL', type: 'text' },
      { key: 'home.feature_kicker', label: 'Feature kicker', type: 'text' },
      { key: 'home.feature_title', label: 'Feature title', type: 'text' },
      { key: 'home.global_reach', label: 'Global reach title', type: 'text' },
      { key: 'home.global_desc', label: 'Global reach description', type: 'textarea' },
      { key: 'home.stats_countries', label: 'Countries label', type: 'text' },
      { key: 'home.stats_countries_value', label: 'Countries value', type: 'text' },
      { key: 'home.stats_delivery', label: 'Delivery label', type: 'text' },
      { key: 'home.stats_delivery_value', label: 'Delivery value', type: 'text' },
      { key: 'product.payment_info_title', label: 'Product payment title', type: 'text' },
      { key: 'product.payment_info_text', label: 'Product payment text', type: 'textarea' },
      { key: 'checkout.payment_note', label: 'Checkout payment note', type: 'textarea' },
      { key: 'checkout.payment_timeline', label: 'Checkout payment timeline', type: 'text' },
      { key: 'checkout.invoice_steps_title', label: 'Invoice steps title', type: 'text' },
      { key: 'checkout.invoice_step_1', label: 'Invoice step 1', type: 'text' },
      { key: 'checkout.invoice_step_2', label: 'Invoice step 2', type: 'text' },
      { key: 'checkout.invoice_step_3', label: 'Invoice step 3', type: 'text' },
    ],
  },
  {
    id: 'authors-about-media',
    label: 'Static Pages',
    icon: <FileText size={16} />,
    fields: [
      { key: 'static.authors.title', label: 'Authors title', type: 'text' },
      { key: 'static.authors.subtitle', label: 'Authors subtitle', type: 'textarea' },
      { key: 'static.authors.p1', label: 'Authors text 1', type: 'textarea' },
      { key: 'static.authors.p2', label: 'Authors text 2', type: 'textarea' },
      { key: 'static.about.title', label: 'About title', type: 'text' },
      { key: 'static.about.subtitle', label: 'About subtitle', type: 'textarea' },
      { key: 'static.about.p1', label: 'About text 1', type: 'textarea' },
      { key: 'static.about.p2', label: 'About text 2', type: 'textarea' },
      { key: 'static.media.title', label: 'Media title', type: 'text' },
      { key: 'static.media.subtitle', label: 'Media subtitle', type: 'textarea' },
      { key: 'static.media.kit_desc', label: 'Press kit text', type: 'textarea' },
      { key: 'static.media.review_desc', label: 'Review text', type: 'textarea' },
      { key: 'static.media.interview_desc', label: 'Interview text', type: 'textarea' },
      { key: 'footer.desc', label: 'Footer description', type: 'textarea' },
    ],
  },
  {
    id: 'legal',
    label: 'Legal',
    icon: <Gavel size={16} />,
    fields: [
      { key: 'static.impressum.text', label: 'Impressum text', type: 'textarea' },
      { key: 'static.privacy.intro', label: 'Privacy intro', type: 'textarea' },
      { key: 'static.privacy.sections', label: 'Privacy sections JSON', type: 'json' },
      { key: 'static.terms.intro', label: 'Terms intro', type: 'textarea' },
      { key: 'static.terms.text', label: 'Terms text', type: 'textarea' },
      { key: 'static.terms.sections', label: 'Terms sections JSON', type: 'json' },
    ],
  },
];

const createBookTemplate = (language: Language): Book => ({
  id: `book-${Date.now()}`,
  title: '',
  author: '',
  price: 0,
  coverUrl: '',
  badges: ['new'],
  type: 'publisher',
  isPreorder: false,
  stock: 0,
  description: '',
  details: {
    pages: 0,
    year: new Date().getFullYear(),
    publisher: '',
    weight: '',
    dimensions: '',
  },
  genre: [],
  series: '',
  ageRating: '16+',
  variants: [],
  releaseDate: new Date().toISOString().slice(0, 10),
  story: {
    quote: '',
    quoteSource: '',
    about: [],
    excerpt: [],
    authorBio: [],
    themes: [],
    reviews: [],
    orderNote: '',
    featureImageUrl: '',
    detailPageUrl: '',
  },
});

const createNewsTemplate = (): NewsItem => ({
  id: `news-${Date.now()}`,
  date: new Date().toISOString().slice(0, 10),
  title: '',
  preview: '',
});

const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);

const serializeFieldValue = (value: any, type: FieldType) => {
  if (typeof value === 'undefined') return '';
  if (type === 'json') return JSON.stringify(value, null, 2);
  if (Array.isArray(value)) return value.join('\n\n');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2);
  return String(value);
};

const parseJsonField = (value: string) => JSON.parse(value);

const parseParagraphs = (value: string) =>
  value
    .split(/\n{2,}/)
    .map(item => item.trim())
    .filter(Boolean);

const cloneBook = (book: Book) => JSON.parse(JSON.stringify(book)) as Book;

const getAdminDraftState = (): AdminDraftState => {
  if (typeof window === 'undefined') {
    return {
      copyDraftsByLanguage: {},
      selectedBookIdByLanguage: {},
      selectedNewsIdByLanguage: {},
      bookDraftByLanguage: {},
      newsDraftByLanguage: {},
      bookJsonDraftsByLanguage: {},
    };
  }

  try {
    const raw = localStorage.getItem(ADMIN_DRAFTS_KEY);
    if (!raw) {
      return {
        copyDraftsByLanguage: {},
        selectedBookIdByLanguage: {},
        selectedNewsIdByLanguage: {},
        bookDraftByLanguage: {},
        newsDraftByLanguage: {},
        bookJsonDraftsByLanguage: {},
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      copyDraftsByLanguage: {},
      selectedBookIdByLanguage: {},
      selectedNewsIdByLanguage: {},
      bookDraftByLanguage: {},
      newsDraftByLanguage: {},
      bookJsonDraftsByLanguage: {},
    };
  }
};

const saveAdminDraftState = (nextState: AdminDraftState) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_DRAFTS_KEY, JSON.stringify(nextState));
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });

const optimizeImageFile = async (file: File) => {
  const source = await readFileAsDataUrl(file);

  if (!file.type.startsWith('image/')) {
    return source;
  }

  const img = new Image();
  img.src = source;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image load failed'));
  });

  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/webp', 0.84);
};

const ImageField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const dataUrl = await optimizeImageFile(file);
      onChange(dataUrl);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 px-4 py-3 bg-white outline-none focus:border-primary"
        placeholder="Image URL or uploaded image data"
      />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-xs uppercase tracking-[0.18em] cursor-pointer hover:bg-gray-50">
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {isUploading ? 'Optimizing...' : 'Upload image'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
        {value ? <span className="text-xs text-gray-400 break-all">Uploaded from PC, optimized automatically and stored in admin content state</span> : null}
      </div>
      {value ? (
        <div className="border border-gray-200 bg-[#F8F8F5] p-3">
          <img src={value} alt={label} className="max-h-48 w-auto object-contain" />
        </div>
      ) : null}
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const { logout, orders, refreshOrders, updateOrderStatus, reloadContent, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('copy');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('ru');
  const [database, setDatabase] = useState<Record<Language, LocalizedCatalogData> | null>(null);
  const [overrides, setOverrides] = useState<TranslationOverrides>({ ru: {}, en: {}, de: {} });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [bookDraft, setBookDraft] = useState<Book | null>(null);
  const [selectedNewsId, setSelectedNewsId] = useState<string>('');
  const [newsDraft, setNewsDraft] = useState<NewsItem | null>(null);
  const [copyDrafts, setCopyDrafts] = useState<Record<string, string>>({});
  const [bookJsonDrafts, setBookJsonDrafts] = useState({ variants: '[]', themes: '[]', reviews: '[]' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string>('');
  const [lastPublishedAt, setLastPublishedAt] = useState<string>('');

  const loadAdminData = async () => {
    setIsRefreshing(true);
    try {
      const [db, translationState] = await Promise.all([
        api.getContentDatabase(),
        api.getTranslationOverrides(),
      ]);
      setDatabase(db);
      setOverrides(translationState);
      if (!selectedBookId && db[selectedLanguage].books[0]) {
        setSelectedBookId(db[selectedLanguage].books[0].id);
      }
      if (!selectedNewsId && db[selectedLanguage].news[0]) {
        setSelectedNewsId(db[selectedLanguage].news[0].id);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (!database) return;
    const currentBook = database[selectedLanguage].books.find(book => book.id === selectedBookId) || database[selectedLanguage].books[0] || null;
    setBookDraft(currentBook ? cloneBook(currentBook) : null);
  }, [database, selectedLanguage, selectedBookId]);

  useEffect(() => {
    if (!bookDraft) return;
    setBookJsonDrafts({
      variants: JSON.stringify(bookDraft.variants || [], null, 2),
      themes: JSON.stringify(bookDraft.story?.themes || [], null, 2),
      reviews: JSON.stringify(bookDraft.story?.reviews || [], null, 2),
    });
  }, [bookDraft]);

  useEffect(() => {
    if (!database) return;
    const currentNews = database[selectedLanguage].news.find(item => item.id === selectedNewsId) || database[selectedLanguage].news[0] || null;
    setNewsDraft(currentNews ? { ...currentNews } : null);
  }, [database, selectedLanguage, selectedNewsId]);

  useEffect(() => {
    const draftState = getAdminDraftState();
    if (draftState.selectedBookIdByLanguage?.[selectedLanguage]) {
      setSelectedBookId(draftState.selectedBookIdByLanguage[selectedLanguage] || '');
    }
    if (draftState.selectedNewsIdByLanguage?.[selectedLanguage]) {
      setSelectedNewsId(draftState.selectedNewsIdByLanguage[selectedLanguage] || '');
    }
    if (draftState.copyDraftsByLanguage?.[selectedLanguage]) {
      setCopyDrafts(draftState.copyDraftsByLanguage[selectedLanguage] || {});
    }
    if (draftState.bookDraftByLanguage?.[selectedLanguage]) {
      setBookDraft(cloneBook(draftState.bookDraftByLanguage[selectedLanguage] as Book));
    }
    if (draftState.newsDraftByLanguage?.[selectedLanguage]) {
      setNewsDraft({ ...(draftState.newsDraftByLanguage[selectedLanguage] as NewsItem) });
    }
    if (draftState.bookJsonDraftsByLanguage?.[selectedLanguage]) {
      setBookJsonDrafts(draftState.bookJsonDraftsByLanguage[selectedLanguage] || { variants: '[]', themes: '[]', reviews: '[]' });
    }
  }, [selectedLanguage]);

  const copyValues = useMemo(() => {
    const defaults = translations[selectedLanguage];
    const languageOverrides = overrides[selectedLanguage] || {};
    return contentGroups.reduce<Record<string, any>>((acc, group) => {
      group.fields.forEach(field => {
        acc[field.key] = typeof languageOverrides[field.key] !== 'undefined' ? languageOverrides[field.key] : getNestedValue(defaults, field.key);
      });
      return acc;
    }, {});
  }, [selectedLanguage, overrides]);

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    contentGroups.forEach(group => {
      group.fields.forEach(field => {
        nextDrafts[field.key] = serializeFieldValue(copyValues[field.key], field.type);
      });
    });
    setCopyDrafts(prev => (Object.keys(prev).length === 0 ? nextDrafts : prev));
  }, [copyValues]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const previous = getAdminDraftState();
      saveAdminDraftState({
        ...previous,
        copyDraftsByLanguage: { ...(previous.copyDraftsByLanguage || {}), [selectedLanguage]: copyDrafts },
        selectedBookIdByLanguage: { ...(previous.selectedBookIdByLanguage || {}), [selectedLanguage]: selectedBookId },
        selectedNewsIdByLanguage: { ...(previous.selectedNewsIdByLanguage || {}), [selectedLanguage]: selectedNewsId },
        bookDraftByLanguage: bookDraft ? { ...(previous.bookDraftByLanguage || {}), [selectedLanguage]: bookDraft } : previous.bookDraftByLanguage || {},
        newsDraftByLanguage: newsDraft ? { ...(previous.newsDraftByLanguage || {}), [selectedLanguage]: newsDraft } : previous.newsDraftByLanguage || {},
        bookJsonDraftsByLanguage: { ...(previous.bookJsonDraftsByLanguage || {}), [selectedLanguage]: bookJsonDrafts },
      });
      setLastDraftSavedAt(new Date().toLocaleTimeString());
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [selectedLanguage, copyDrafts, selectedBookId, selectedNewsId, bookDraft, newsDraft, bookJsonDrafts]);

  const copyJsonErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    contentGroups.forEach(group => {
      group.fields.forEach(field => {
        if (field.type !== 'json') return;
        try {
          parseJsonField(copyDrafts[field.key] || '');
        } catch {
          errors[field.key] = 'Invalid JSON';
        }
      });
    });
    return errors;
  }, [copyDrafts]);

  const bookJsonErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    try { parseJsonField(bookJsonDrafts.variants); } catch { errors.variants = 'Invalid variants JSON'; }
    try { parseJsonField(bookJsonDrafts.themes); } catch { errors.themes = 'Invalid themes JSON'; }
    try { parseJsonField(bookJsonDrafts.reviews); } catch { errors.reviews = 'Invalid reviews JSON'; }
    return errors;
  }, [bookJsonDrafts]);

  const bookRequiredErrors = useMemo(() => {
    if (!bookDraft) return [];
    const issues: string[] = [];
    if (!bookDraft.title.trim()) issues.push('Title missing');
    if (!bookDraft.author.trim()) issues.push('Author missing');
    if (!bookDraft.coverUrl.trim()) issues.push('Cover image missing');
    return issues;
  }, [bookDraft]);

  const newsRequiredErrors = useMemo(() => {
    if (!newsDraft) return [];
    const issues: string[] = [];
    if (!newsDraft.title.trim()) issues.push('News title missing');
    if (!newsDraft.preview.trim()) issues.push('News preview missing');
    return issues;
  }, [newsDraft]);

  const handleSaveTranslationField = async (field: ContentField) => {
    const rawValue = copyDrafts[field.key] ?? '';
    try {
      const parsedValue = field.type === 'json' ? parseJsonField(rawValue) : rawValue;
      setSavingKey(field.key);
      let nextOverrides = await api.setTranslationValue(selectedLanguage, field.key, parsedValue);
      if (selectedLanguage === 'ru') {
        nextOverrides = await api.setTranslationValue('en', field.key, autoTranslateValue(parsedValue, 'en'));
        nextOverrides = await api.setTranslationValue('de', field.key, autoTranslateValue(parsedValue, 'de'));
      }
      setOverrides(nextOverrides);
      await reloadContent();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast(selectedLanguage === 'ru' ? `${field.label} saved and synced to EN/DE` : `${field.label} saved`);
    } catch {
      showToast(`Could not save ${field.label}`, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleResetTranslationField = async (field: ContentField) => {
    try {
      setSavingKey(`${field.key}:reset`);
      const nextOverrides = await api.resetTranslationValue(selectedLanguage, field.key);
      setOverrides(nextOverrides);
      await reloadContent();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast(`${field.label} reset`);
    } catch {
      showToast(`Could not reset ${field.label}`, 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveBook = async () => {
    if (!bookDraft) return;
    try {
      const parsedVariants = parseJsonField(bookJsonDrafts.variants);
      const parsedThemes = parseJsonField(bookJsonDrafts.themes);
      const parsedReviews = parseJsonField(bookJsonDrafts.reviews);
      const nextBook = {
        ...bookDraft,
        genre: bookDraft.genre.filter(Boolean),
        variants: parsedVariants || [],
        story: {
          ...bookDraft.story!,
          themes: parsedThemes || [],
          reviews: parsedReviews || [],
        },
      };
      setSavingKey(`book:${bookDraft.id}`);
      await api.upsertBook(selectedLanguage, nextBook);
      if (selectedLanguage === 'ru') {
        await api.upsertBook('en', autoTranslateBookFromRu(nextBook, 'en'));
        await api.upsertBook('de', autoTranslateBookFromRu(nextBook, 'de'));
      }
      await reloadContent();
      await loadAdminData();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast(selectedLanguage === 'ru' ? `Book ${bookDraft.title || bookDraft.id} saved and synced to EN/DE` : `Book ${bookDraft.title || bookDraft.id} saved`);
    } catch {
      showToast('Could not save book', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteBook = async () => {
    if (!bookDraft) return;
    try {
      setSavingKey(`book:delete:${bookDraft.id}`);
      await api.deleteBook(selectedLanguage, bookDraft.id);
      if (selectedLanguage === 'ru') {
        await api.deleteBook('en', bookDraft.id);
        await api.deleteBook('de', bookDraft.id);
      }
      setSelectedBookId('');
      await reloadContent();
      await loadAdminData();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast('Book removed');
    } catch {
      showToast('Could not remove book', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveNews = async () => {
    if (!newsDraft) return;
    try {
      setSavingKey(`news:${newsDraft.id}`);
      await api.upsertNewsItem(selectedLanguage, newsDraft);
      if (selectedLanguage === 'ru') {
        await api.upsertNewsItem('en', autoTranslateNewsFromRu(newsDraft, 'en'));
        await api.upsertNewsItem('de', autoTranslateNewsFromRu(newsDraft, 'de'));
      }
      await reloadContent();
      await loadAdminData();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast(selectedLanguage === 'ru' ? `News ${newsDraft.title || newsDraft.id} saved and synced to EN/DE` : `News ${newsDraft.title || newsDraft.id} saved`);
    } catch {
      showToast('Could not save news', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleDeleteNews = async () => {
    if (!newsDraft) return;
    try {
      setSavingKey(`news:delete:${newsDraft.id}`);
      await api.deleteNewsItem(selectedLanguage, newsDraft.id);
      if (selectedLanguage === 'ru') {
        await api.deleteNewsItem('en', newsDraft.id);
        await api.deleteNewsItem('de', newsDraft.id);
      }
      setSelectedNewsId('');
      await reloadContent();
      await loadAdminData();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast('News removed');
    } catch {
      showToast('Could not remove news', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setSavingKey(`order:${orderId}`);
    await updateOrderStatus(orderId, status);
    setSavingKey(null);
  };

  const handleExport = async () => {
    try {
      const payload = await api.exportContentBundle();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ampublishing-admin-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Backup exported');
    } catch {
      showToast('Could not export backup', 'error');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await api.importContentBundle(parsed);
      await reloadContent();
      await loadAdminData();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast('Backup imported');
    } catch {
      showToast('Could not import backup', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const books = database?.[selectedLanguage].books || [];
  const news = database?.[selectedLanguage].news || [];

  return (
    <div className="min-h-screen bg-[#F4F4F0] pt-[80px] flex flex-col md:flex-row text-primary">
      <div className="md:hidden sticky top-[80px] z-30 bg-primary text-white border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="font-serif text-2xl">AM Admin</h2>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/60">Content Management</p>
          </div>
          <button onClick={() => setSidebarOpen(prev => !prev)} className="p-2 border border-white/20">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <aside className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-72 bg-primary text-white flex-shrink-0 md:min-h-[calc(100vh-80px)]`}>
        <div className="p-8 border-b border-white/10">
          <h2 className="font-serif text-3xl">AM Admin</h2>
          <p className="text-[10px] font-mono opacity-60 uppercase tracking-[0.24em] mt-2">Content Management</p>
        </div>

        <nav className="p-6 space-y-3">
          {[
            { id: 'copy', label: 'Site Copy', icon: <FileText size={16} /> },
            { id: 'books', label: 'Books', icon: <BookOpen size={16} /> },
            { id: 'news', label: 'News', icon: <Newspaper size={16} /> },
            { id: 'orders', label: 'Orders', icon: <ShoppingBag size={16} /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as AdminTab)}
              className={`w-full flex items-center gap-4 px-4 py-4 text-xs uppercase font-bold tracking-widest transition-all ${
                activeTab === item.id ? 'bg-accent text-primary translate-x-2 shadow-lg' : 'hover:bg-white/10 text-gray-300'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="px-6 pb-6">
          <div className="bg-white/5 border border-white/10 p-4 mb-4">
            <p className="text-[10px] uppercase font-mono tracking-[0.22em] text-white/50 mb-3">Language</p>
            <div className="grid grid-cols-3 gap-2">
              {(['ru', 'en', 'de'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`py-2 text-[10px] uppercase tracking-[0.2em] border ${
                    selectedLanguage === lang ? 'bg-accent text-primary border-accent' : 'border-white/20 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-white/55">
              When you save in `RU`, the admin now auto-generates `EN` and `DE` versions for copy, books, and news.
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 p-4">
            <p className="text-[10px] uppercase font-mono tracking-[0.22em] text-white/50 mb-3">Backup</p>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={handleExport} className="flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-widest border border-white/15 hover:bg-white/10">
                <Download size={14} />
                Export content
              </button>
              <label className="flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-widest border border-white/15 hover:bg-white/10 cursor-pointer">
                <Upload size={14} />
                Import backup
                <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 mt-auto border-t border-white/10 flex gap-3">
          <button
            onClick={loadAdminData}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-widest border border-white/15 hover:bg-white/10"
          >
            {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Reload
          </button>
          <button
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-widest border border-red-500/40 text-red-200 hover:bg-red-900/20"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto min-h-[calc(100vh-80px)] md:h-[calc(100vh-80px)]">
        {!database ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : null}

        {database ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-primary/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Content status</p>
              <p className="mt-2 font-serif text-2xl">{database ? 'Loaded' : 'Loading'}</p>
            </div>
            <div className="bg-white border border-primary/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Validation</p>
              <p className="mt-2 font-serif text-2xl">{Object.keys(copyJsonErrors).length || Object.keys(bookJsonErrors).length || bookRequiredErrors.length || newsRequiredErrors.length ? 'Needs attention' : 'OK'}</p>
            </div>
            <div className="bg-white border border-primary/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Draft autosave</p>
              <p className="mt-2 font-serif text-2xl">{lastDraftSavedAt || 'Waiting'}</p>
            </div>
            <div className="bg-white border border-primary/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Last publish</p>
              <p className="mt-2 font-serif text-2xl">{lastPublishedAt || 'Not yet'}</p>
            </div>
          </div>
        ) : null}

        {database && activeTab === 'copy' ? (
          <div className="space-y-8">
            {contentGroups.map(group => (
              <section key={group.id} className="bg-white border border-primary/10 shadow-sm">
                <div className="p-6 border-b border-primary/10 flex items-center gap-3">
                  {group.icon}
                  <h3 className="text-2xl font-serif">{group.label}</h3>
                </div>
                <div className="p-6 grid grid-cols-1 gap-6">
                  {group.fields.map(field => (
                    <div key={field.key} className="border border-gray-100 p-5 bg-[#F8F8F5]">
                      <div className="flex justify-between items-center mb-3 gap-4">
                        <div>
                          <p className="font-bold text-sm">{field.label}</p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400">{field.key}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleResetTranslationField(field)}
                            className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-100"
                          >
                            Reset
                          </button>
                          <button
                            onClick={() => handleSaveTranslationField(field)}
                            disabled={!!copyJsonErrors[field.key]}
                            className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary"
                          >
                            {savingKey === field.key ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      </div>
                      {field.key === 'home.hero_image' || field.key === 'home.feature_image' ? (
                        <ImageField
                          label={field.label}
                          value={copyDrafts[field.key] || ''}
                          onChange={value => setCopyDrafts(prev => ({ ...prev, [field.key]: value }))}
                        />
                      ) : field.type === 'text' ? (
                        <input
                          value={copyDrafts[field.key] || ''}
                          onChange={e => setCopyDrafts(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full border border-gray-300 px-4 py-3 bg-white outline-none focus:border-primary"
                        />
                      ) : (
                        <textarea
                          value={copyDrafts[field.key] || ''}
                          onChange={e => setCopyDrafts(prev => ({ ...prev, [field.key]: e.target.value }))}
                          rows={field.type === 'json' ? 12 : 5}
                          className={`w-full border px-4 py-3 bg-white outline-none focus:border-primary font-mono text-sm ${copyJsonErrors[field.key] ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`}
                        />
                      )}
                      {copyJsonErrors[field.key] ? <p className="mt-2 text-xs text-red-500 font-mono">{copyJsonErrors[field.key]}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {database && activeTab === 'books' ? (
          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-8">
            <section className="bg-white border border-primary/10">
              <div className="p-6 border-b border-primary/10 flex items-center justify-between">
                <h3 className="text-2xl font-serif">Books</h3>
                <button
                  onClick={() => {
                    const next = createBookTemplate(selectedLanguage);
                    setSelectedBookId(next.id);
                    setBookDraft(next);
                  }}
                  className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {books.map(book => (
                  <button
                    key={book.id}
                    onClick={() => setSelectedBookId(book.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 ${selectedBookId === book.id ? 'bg-[#F4F4F0]' : ''}`}
                  >
                    <p className="font-serif text-xl leading-none mb-2">{book.title || book.id}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400">{book.author}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white border border-primary/10 p-6">
              {bookDraft ? (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <h3 className="text-3xl font-serif">Book Editor</h3>
                    <div className="flex gap-2">
                      <button onClick={handleDeleteBook} className="px-4 py-3 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-xs uppercase tracking-widest">
                        <Trash2 size={14} />
                        Delete
                      </button>
                      <button onClick={handleSaveBook} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                        {savingKey === `book:${bookDraft.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save
                      </button>
                    </div>
                  </div>
                  {bookRequiredErrors.length || Object.keys(bookJsonErrors).length ? (
                    <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {[...bookRequiredErrors, ...Object.values(bookJsonErrors)].map(item => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <input value={bookDraft.id} onChange={e => setBookDraft(prev => prev ? { ...prev, id: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="ID" />
                    <input value={bookDraft.releaseDate} onChange={e => setBookDraft(prev => prev ? { ...prev, releaseDate: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Release date" />
                    <input value={bookDraft.title} onChange={e => setBookDraft(prev => prev ? { ...prev, title: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Title" />
                    <input value={bookDraft.author} onChange={e => setBookDraft(prev => prev ? { ...prev, author: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Author" />
                    <input type="number" value={bookDraft.price} onChange={e => setBookDraft(prev => prev ? { ...prev, price: Number(e.target.value) } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Price" />
                    <input type="number" value={bookDraft.stock} onChange={e => setBookDraft(prev => prev ? { ...prev, stock: Number(e.target.value) } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Stock" />
                    <input value={bookDraft.series || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, series: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Series" />
                    <input value={bookDraft.details.publisher || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, publisher: e.target.value } } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Publisher" />
                    <input value={bookDraft.genre.join(', ')} onChange={e => setBookDraft(prev => prev ? { ...prev, genre: e.target.value.split(',').map(item => item.trim()).filter(Boolean) } : prev)} className="border border-gray-300 px-4 py-3 md:col-span-2" placeholder="Genres, comma separated" />
                    <input value={bookDraft.badges.join(', ')} onChange={e => setBookDraft(prev => prev ? { ...prev, badges: e.target.value.split(',').map(item => item.trim()).filter(Boolean) as Book['badges'] } : prev)} className="border border-gray-300 px-4 py-3 md:col-span-2" placeholder="Badges, comma separated" />
                  </div>

                  <ImageField
                    label="Cover image"
                    value={bookDraft.coverUrl}
                    onChange={value => setBookDraft(prev => prev ? { ...prev, coverUrl: value } : prev)}
                  />

                  <textarea value={bookDraft.description} onChange={e => setBookDraft(prev => prev ? { ...prev, description: e.target.value } : prev)} rows={4} className="w-full border border-gray-300 px-4 py-3" placeholder="Description" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <input type="number" value={bookDraft.details.pages} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, pages: Number(e.target.value) } } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Pages" />
                    <input type="number" value={bookDraft.details.year} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, year: Number(e.target.value) } } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Year" />
                    <input value={bookDraft.details.weight || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, weight: e.target.value } } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Weight" />
                    <input value={bookDraft.details.dimensions || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, dimensions: e.target.value } } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Dimensions" />
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-serif text-2xl">Story Page</h4>
                    <input value={bookDraft.story?.quote || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, quote: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="Quote" />
                    <input value={bookDraft.story?.quoteSource || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, quoteSource: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="Quote source" />
                    <input value={bookDraft.story?.detailPageUrl || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, detailPageUrl: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="External detail page URL" />
                    <ImageField
                      label="Story feature image"
                      value={bookDraft.story?.featureImageUrl || ''}
                      onChange={value => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, featureImageUrl: value } } : prev)}
                    />
                    <textarea value={(bookDraft.story?.about || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, about: parseParagraphs(e.target.value) } } : prev)} rows={6} className="w-full border border-gray-300 px-4 py-3" placeholder="About paragraphs, separated by empty line" />
                    <textarea value={(bookDraft.story?.excerpt || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, excerpt: parseParagraphs(e.target.value) } } : prev)} rows={6} className="w-full border border-gray-300 px-4 py-3" placeholder="Excerpt paragraphs, separated by empty line" />
                    <textarea value={(bookDraft.story?.authorBio || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, authorBio: parseParagraphs(e.target.value) } } : prev)} rows={5} className="w-full border border-gray-300 px-4 py-3" placeholder="Author bio paragraphs, separated by empty line" />
                    <textarea value={bookDraft.story?.orderNote || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, orderNote: e.target.value } } : prev)} rows={3} className="w-full border border-gray-300 px-4 py-3" placeholder="Order note" />
                    <textarea value={bookJsonDrafts.variants} onChange={e => setBookJsonDrafts(prev => ({ ...prev, variants: e.target.value }))} rows={8} className={`w-full border px-4 py-3 font-mono text-sm ${bookJsonErrors.variants ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`} placeholder="Variants JSON" />
                    <textarea value={bookJsonDrafts.themes} onChange={e => setBookJsonDrafts(prev => ({ ...prev, themes: e.target.value }))} rows={8} className={`w-full border px-4 py-3 font-mono text-sm ${bookJsonErrors.themes ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`} placeholder="Themes JSON" />
                    <textarea value={bookJsonDrafts.reviews} onChange={e => setBookJsonDrafts(prev => ({ ...prev, reviews: e.target.value }))} rows={8} className={`w-full border px-4 py-3 font-mono text-sm ${bookJsonErrors.reviews ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`} placeholder="Reviews JSON" />
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">Select a book or create a new one.</div>
              )}
            </section>
          </div>
        ) : null}

        {database && activeTab === 'news' ? (
          <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-8">
            <section className="bg-white border border-primary/10">
              <div className="p-6 border-b border-primary/10 flex items-center justify-between">
                <h3 className="text-2xl font-serif">News</h3>
                <button
                  onClick={() => {
                    const next = createNewsTemplate();
                    setSelectedNewsId(next.id);
                    setNewsDraft(next);
                  }}
                  className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {news.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedNewsId(item.id)}
                    className={`w-full text-left p-4 hover:bg-gray-50 ${selectedNewsId === item.id ? 'bg-[#F4F4F0]' : ''}`}
                  >
                    <p className="font-serif text-xl leading-none mb-2">{item.title || item.id}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400">{item.date}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white border border-primary/10 p-6">
              {newsDraft ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <h3 className="text-3xl font-serif">News Editor</h3>
                    <div className="flex gap-2">
                      <button onClick={handleDeleteNews} className="px-4 py-3 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-xs uppercase tracking-widest">
                        <Trash2 size={14} />
                        Delete
                      </button>
                      <button onClick={handleSaveNews} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                        {savingKey === `news:${newsDraft.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save
                      </button>
                    </div>
                  </div>
                  {newsRequiredErrors.length ? (
                    <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {newsRequiredErrors.map(item => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  ) : null}
                  <input value={newsDraft.id} onChange={e => setNewsDraft(prev => prev ? { ...prev, id: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="ID" />
                  <input value={newsDraft.date} onChange={e => setNewsDraft(prev => prev ? { ...prev, date: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="Date" />
                  <input value={newsDraft.title} onChange={e => setNewsDraft(prev => prev ? { ...prev, title: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="Title" />
                  <textarea value={newsDraft.preview} onChange={e => setNewsDraft(prev => prev ? { ...prev, preview: e.target.value } : prev)} rows={5} className="w-full border border-gray-300 px-4 py-3" placeholder="Preview" />
                </div>
              ) : (
                <div className="text-gray-400">Select a news item or create a new one.</div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === 'orders' ? (
          <section className="bg-white border border-primary/10 overflow-hidden">
            <div className="p-6 border-b border-primary/10 flex items-center justify-between">
              <h3 className="text-3xl font-serif">Orders</h3>
              <button onClick={refreshOrders} className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F4F4F0]">
                  <tr className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    <th className="p-4">Order</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="border-t border-gray-100 align-top">
                      <td className="p-4">
                        <div className="font-bold">{order.id}</div>
                        <div className="text-xs text-gray-400">{new Date(order.date).toLocaleString()}</div>
                      </td>
                      <td className="p-4">
                        <div>{order.customer.name}</div>
                        <div className="text-xs text-gray-400">{order.customer.email}</div>
                        <div className="text-xs text-gray-400">{order.customer.location}</div>
                      </td>
                      <td className="p-4 text-sm">
                        {order.items.map(item => (
                          <div key={item.variantId}>{item.quantity}x {item.bookTitle}</div>
                        ))}
                      </td>
                      <td className="p-4 font-bold">{order.total.toFixed(2)} {order.currency}</td>
                      <td className="p-4">
                        <span className="inline-flex px-3 py-1 text-[10px] uppercase tracking-[0.18em] bg-[#F4F4F0] border border-gray-200">
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <select
                            value={order.status}
                            onChange={e => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            className="border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          {savingKey === `order:${order.id}` ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} className="text-green-600" />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};
