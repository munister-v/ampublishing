import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../services/api';
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
    if (!database) return;
    const currentBook = database[selectedLanguage].books.find(book => book.id === selectedBookId) || database[selectedLanguage].books[0] || null;
    setBookDraft(currentBook ? cloneBook(currentBook) : null);
  }, [database, selectedLanguage, selectedBookId]);

  useEffect(() => {
    if (!database) return;
    const currentNews = database[selectedLanguage].news.find(item => item.id === selectedNewsId) || database[selectedLanguage].news[0] || null;
    setNewsDraft(currentNews ? { ...currentNews } : null);
  }, [database, selectedLanguage, selectedNewsId]);

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
    setCopyDrafts(nextDrafts);
  }, [copyValues]);

  const handleSaveTranslationField = async (field: ContentField) => {
    const rawValue = copyDrafts[field.key] ?? '';
    try {
      const parsedValue = field.type === 'json' ? parseJsonField(rawValue) : rawValue;
      setSavingKey(field.key);
      const nextOverrides = await api.setTranslationValue(selectedLanguage, field.key, parsedValue);
      setOverrides(nextOverrides);
      await reloadContent();
      showToast(`${field.label} saved`);
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
      setSavingKey(`book:${bookDraft.id}`);
      await api.upsertBook(selectedLanguage, {
        ...bookDraft,
        genre: bookDraft.genre.filter(Boolean),
        variants: bookDraft.variants || [],
      });
      await reloadContent();
      await loadAdminData();
      showToast(`Book ${bookDraft.title || bookDraft.id} saved`);
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
      setSelectedBookId('');
      await reloadContent();
      await loadAdminData();
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
      await reloadContent();
      await loadAdminData();
      showToast(`News ${newsDraft.title || newsDraft.id} saved`);
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
      setSelectedNewsId('');
      await reloadContent();
      await loadAdminData();
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

  const books = database?.[selectedLanguage].books || [];
  const news = database?.[selectedLanguage].news || [];

  return (
    <div className="min-h-screen bg-[#F4F4F0] pt-[80px] flex flex-col md:flex-row text-primary">
      <aside className="w-full md:w-72 bg-primary text-white flex-shrink-0 md:min-h-[calc(100vh-80px)]">
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
          <div className="bg-white/5 border border-white/10 p-4">
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

      <main className="flex-1 p-6 md:p-10 overflow-y-auto h-[calc(100vh-80px)]">
        {!database ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" />
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
                            className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary"
                          >
                            {savingKey === field.key ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      </div>
                      {field.type === 'text' ? (
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
                          className="w-full border border-gray-300 px-4 py-3 bg-white outline-none focus:border-primary font-mono text-sm"
                        />
                      )}
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
                  <div className="flex justify-between items-center">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <input value={bookDraft.id} onChange={e => setBookDraft(prev => prev ? { ...prev, id: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="ID" />
                    <input value={bookDraft.releaseDate} onChange={e => setBookDraft(prev => prev ? { ...prev, releaseDate: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Release date" />
                    <input value={bookDraft.title} onChange={e => setBookDraft(prev => prev ? { ...prev, title: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Title" />
                    <input value={bookDraft.author} onChange={e => setBookDraft(prev => prev ? { ...prev, author: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Author" />
                    <input value={bookDraft.coverUrl} onChange={e => setBookDraft(prev => prev ? { ...prev, coverUrl: e.target.value } : prev)} className="border border-gray-300 px-4 py-3 md:col-span-2" placeholder="Cover URL" />
                    <input type="number" value={bookDraft.price} onChange={e => setBookDraft(prev => prev ? { ...prev, price: Number(e.target.value) } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Price" />
                    <input type="number" value={bookDraft.stock} onChange={e => setBookDraft(prev => prev ? { ...prev, stock: Number(e.target.value) } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Stock" />
                    <input value={bookDraft.series || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, series: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Series" />
                    <input value={bookDraft.details.publisher || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, publisher: e.target.value } } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Publisher" />
                    <input value={bookDraft.genre.join(', ')} onChange={e => setBookDraft(prev => prev ? { ...prev, genre: e.target.value.split(',').map(item => item.trim()).filter(Boolean) } : prev)} className="border border-gray-300 px-4 py-3 md:col-span-2" placeholder="Genres, comma separated" />
                    <input value={bookDraft.badges.join(', ')} onChange={e => setBookDraft(prev => prev ? { ...prev, badges: e.target.value.split(',').map(item => item.trim()).filter(Boolean) as Book['badges'] } : prev)} className="border border-gray-300 px-4 py-3 md:col-span-2" placeholder="Badges, comma separated" />
                  </div>

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
                    <input value={bookDraft.story?.featureImageUrl || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, featureImageUrl: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="Feature image URL" />
                    <textarea value={(bookDraft.story?.about || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, about: parseParagraphs(e.target.value) } } : prev)} rows={6} className="w-full border border-gray-300 px-4 py-3" placeholder="About paragraphs, separated by empty line" />
                    <textarea value={(bookDraft.story?.excerpt || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, excerpt: parseParagraphs(e.target.value) } } : prev)} rows={6} className="w-full border border-gray-300 px-4 py-3" placeholder="Excerpt paragraphs, separated by empty line" />
                    <textarea value={(bookDraft.story?.authorBio || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, authorBio: parseParagraphs(e.target.value) } } : prev)} rows={5} className="w-full border border-gray-300 px-4 py-3" placeholder="Author bio paragraphs, separated by empty line" />
                    <textarea value={bookDraft.story?.orderNote || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, orderNote: e.target.value } } : prev)} rows={3} className="w-full border border-gray-300 px-4 py-3" placeholder="Order note" />
                    <textarea value={JSON.stringify(bookDraft.variants, null, 2)} onChange={e => setBookDraft(prev => prev ? { ...prev, variants: parseJsonField(e.target.value) } : prev)} rows={8} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="Variants JSON" />
                    <textarea value={JSON.stringify(bookDraft.story?.themes || [], null, 2)} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, themes: parseJsonField(e.target.value) } } : prev)} rows={8} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="Themes JSON" />
                    <textarea value={JSON.stringify(bookDraft.story?.reviews || [], null, 2)} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, reviews: parseJsonField(e.target.value) } } : prev)} rows={8} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="Reviews JSON" />
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
                  <div className="flex justify-between items-center">
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
