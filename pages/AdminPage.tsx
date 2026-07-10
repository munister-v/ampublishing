import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../services/api';
import {
  adminLogin as radioAdminLogin, adminClearChat, adminUnpinAll, adminPin,
  adminAnnounce, getAdminToken as getRadioAdminToken, clearAdminToken as clearRadioAdminToken,
  fetchPinnedMessages, fetchRadioMessages, deleteRadioMessage,
  type RadioMessage, type AnnouncePayload,
} from '../services/radioApi';
import { RadioConfigForm } from './RadioConfigForm';
import { contentStore, WriteLogEntry } from '../services/contentStore';
import { FeaturedAuthor, ShowcaseAuthor, getAuthorShowcaseContent, getFeaturedAuthorContent } from '../services/authorShowcase';
import { translations } from '../translations';
import { Book, BookReview, BookTheme, BookVariant, Format, Language, LocalizedCatalogData, NavLinkConfig, NewsItem, OrderStatus, PaymentSettings, PaymentStatus, SiteSettings, TranslationOverrides } from '../types';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Clock,
  Database,
  FileText,
  Gavel,
  GitBranch,
  Globe,
  Info,
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
  Layout,
  ArrowUp,
  ArrowDown,
  Wifi,
  WifiOff,
  Copy,
  ExternalLink,
  Clipboard,
  SortAsc,
} from 'lucide-react';

type AdminTab = 'copy' | 'books' | 'news' | 'authors' | 'about' | 'site' | 'payments' | 'orders' | 'status' | 'radio';
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
  copyDrafts?: Record<string, string>;
  selectedBookId?: string;
  selectedNewsId?: string;
  bookDraft?: Book;
  newsDraft?: NewsItem;
  bookJsonDrafts?: { variants: string; themes: string; reviews: string };
  language?: Language;
};

const ADMIN_DRAFTS_KEY = 'am-admin-drafts-v2';

const contentGroups: ContentGroup[] = [
  {
    id: 'home',
    label: 'Главная страница',
    icon: <Globe size={16} />,
    fields: [
      { key: 'home.hero_title_1', label: 'Заголовок hero', type: 'text' },
      { key: 'home.hero_title_2', label: 'Заголовок hero (строка 2)', type: 'text' },
      { key: 'home.hero_subtitle', label: 'Подзаголовок hero', type: 'textarea' },
      { key: 'home.hero_cta', label: 'Кнопка hero', type: 'text' },
      { key: 'home.hero_image', label: 'Фото hero', type: 'text' },
      { key: 'home.feature_image', label: 'Фото featured секции', type: 'text' },
      { key: 'home.feature_kicker', label: 'Кикер featured', type: 'text' },
      { key: 'home.feature_title', label: 'Заголовок featured', type: 'text' },
      { key: 'home.global_reach', label: 'Заголовок охвата', type: 'text' },
      { key: 'home.global_desc', label: 'Описание охвата', type: 'textarea' },
      { key: 'home.stats_countries', label: 'Подпись «Страны»', type: 'text' },
      { key: 'home.stats_countries_value', label: 'Значение «Страны»', type: 'text' },
      { key: 'home.stats_delivery', label: 'Подпись «Доставка»', type: 'text' },
      { key: 'home.stats_delivery_value', label: 'Значение «Доставка»', type: 'text' },
      { key: 'product.payment_info_title', label: 'Заголовок оплаты на странице товара', type: 'text' },
      { key: 'product.payment_info_text', label: 'Текст оплаты на странице товара', type: 'textarea' },
      { key: 'checkout.payment_note', label: 'Примечание об оплате (корзина)', type: 'textarea' },
      { key: 'checkout.payment_timeline', label: 'Срок подтверждения оплаты', type: 'text' },
      { key: 'checkout.invoice_steps_title', label: 'Заголовок шагов счёта', type: 'text' },
      { key: 'checkout.invoice_step_1', label: 'Шаг счёта 1', type: 'text' },
      { key: 'checkout.invoice_step_2', label: 'Шаг счёта 2', type: 'text' },
      { key: 'checkout.invoice_step_3', label: 'Шаг счёта 3', type: 'text' },
    ],
  },
  {
    id: 'authors-about-media',
    label: 'Статические страницы',
    icon: <FileText size={16} />,
    fields: [
      { key: 'static.authors.title', label: 'Заголовок «Авторам»', type: 'text' },
      { key: 'static.authors.subtitle', label: 'Подзаголовок «Авторам»', type: 'textarea' },
      { key: 'static.authors.p1', label: 'Текст «Авторам» 1', type: 'textarea' },
      { key: 'static.authors.p2', label: 'Текст «Авторам» 2', type: 'textarea' },
      { key: 'static.about.title', label: 'О нас — заголовок', type: 'text' },
      { key: 'static.about.subtitle', label: 'О нас — подзаголовок', type: 'textarea' },
      { key: 'static.about.mission', label: 'О нас — заголовок миссии', type: 'text' },
      { key: 'static.about.p1', label: 'О нас — текст 1', type: 'textarea' },
      { key: 'static.about.p2', label: 'О нас — текст 2', type: 'textarea' },
      { key: 'static.about.stat1', label: 'О нас — подпись стат. 1', type: 'text' },
      { key: 'static.about.stat2', label: 'О нас — подпись стат. 2', type: 'text' },
      { key: 'static.about.mission_image', label: 'О нас — фото', type: 'text' },
      { key: 'static.about.team', label: 'О нас — заголовок команды', type: 'text' },
      { key: 'static.about.role1', label: 'О нас — роль 1', type: 'text' },
      { key: 'static.about.role2', label: 'О нас — роль 2', type: 'text' },
      { key: 'static.about.role3', label: 'О нас — роль 3', type: 'text' },
      { key: 'nav.our_authors', label: 'Пункт меню «Наши авторы»', type: 'text' },
      { key: 'static.our_authors.title', label: 'Заголовок «Наши авторы»', type: 'text' },
      { key: 'static.our_authors.subtitle', label: 'Подзаголовок «Наши авторы»', type: 'textarea' },
      { key: 'static.our_authors.gallery_label', label: 'Подпись галереи', type: 'text' },
      { key: 'static.our_authors.gallery_title', label: 'Заголовок галереи', type: 'text' },
      { key: 'static.media.title', label: 'Заголовок «Мероприятия»', type: 'text' },
      { key: 'static.media.subtitle', label: 'Подзаголовок «Мероприятия»', type: 'textarea' },
      { key: 'footer.desc', label: 'Описание в футере', type: 'textarea' },
    ],
  },
  {
    id: 'legal',
    label: 'Юридические тексты',
    icon: <Gavel size={16} />,
    fields: [
      { key: 'static.impressum.text', label: 'Текст Impressum', type: 'textarea' },
      { key: 'static.privacy.intro', label: 'Вводная часть Политики', type: 'textarea' },
      { key: 'static.privacy.sections', label: 'Разделы Политики (JSON)', type: 'json' },
      { key: 'static.terms.intro', label: 'Вводная часть Условий', type: 'textarea' },
      { key: 'static.terms.text', label: 'Текст Условий', type: 'textarea' },
      { key: 'static.terms.sections', label: 'Разделы Условий (JSON)', type: 'json' },
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
  purchaseLinks: [
    { id: 'shopify', label: 'Shopify', url: '' },
    { id: 'mnogoknig', label: 'Mnogoknig', url: '' },
    { id: 'mostik', label: 'Mostik.de', url: '' },
  ],
});

const createNewsTemplate = (): NewsItem => ({
  id: `news-${Date.now()}`,
  date: new Date().toISOString().slice(0, 10),
  title: '',
  preview: '',
});

const createPaymentSettingsTemplate = (): PaymentSettings => ({
  recipientName: 'AM Publishing',
  visaPaymentUrl: '',
  mastercardPaymentUrl: '',
  cardholder: '',
  cardNumber: '',
  bankName: '',
  iban: '',
  mirCardholder: '',
  mirCardNumber: '',
  mirBankName: '',
  whatsappNumber: '',
  telegramUsername: '',
  contactEmail: 'am.hybridpublishing@gmail.com',
  paymentNote: 'После оплаты отправьте подтверждение перевода, чтобы мы могли вручную подтвердить заказ.',
  invoicePrefix: 'AM',
  webhookUrl: '',
  webhookLabel: 'Make / n8n / Telegram bridge',
  notifyOnOrderCreated: true,
  notifyOnPaymentConfirmed: true,
});

const getNestedValue = (obj: any, path: string) => path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);

const serializeFieldValue = (value: any, type: FieldType) => {
  if (typeof value === 'undefined') return '';
  if (type === 'json') return JSON.stringify(value, null, 2);
  if (Array.isArray(value)) return value.join('\n\n');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value, null, 2);
  return String(value);
};

const parseJsonField = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null; // empty = no value, not an error
  return JSON.parse(trimmed);
};

const parseParagraphs = (value: string) =>
  value
    .split(/\n{2,}/)
    .map(item => item.trim())
    .filter(Boolean);

const cloneBook = (book: Book) => JSON.parse(JSON.stringify(book)) as Book;

const TRANSLIT: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};
const slugify = (str: string) =>
  str.toLowerCase().split('').map(c => TRANSLIT[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `book-${Date.now()}`;

const getAdminDraftState = (): AdminDraftState => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ADMIN_DRAFTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
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

const LF: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({ label, hint, children, className }) => (
  <div className={className}>
    <label className="block text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">{label}</label>
    {children}
    {hint ? <p className="mt-1 text-[10px] text-gray-400">{hint}</p> : null}
  </div>
);

const exportOrdersCSV = (orders: any[]) => {
  const rows = [
    ['ID', 'Date', 'Customer', 'Email', 'Phone', 'Location', 'Address', 'Items', 'Total', 'Currency', 'Payment Method', 'Payment Status', 'Order Status', 'Reference'],
    ...orders.map(o => [
      o.id,
      new Date(o.date).toLocaleString(),
      o.customer.name,
      o.customer.email,
      o.customer.phone || '',
      o.customer.location || '',
      [o.customer.addressLine, o.customer.zip].filter(Boolean).join(' '),
      o.items.map((i: any) => `${i.quantity}x ${i.bookTitle}`).join('; '),
      o.total.toFixed(2),
      o.currency,
      o.paymentMethod || '',
      o.paymentStatus,
      o.status,
      o.paymentReference || '',
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const ImageField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  filenamePrefix?: string;
  hint?: string;
}> = ({ label, value, onChange, filenamePrefix = 'upload', hint }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle'|'optimizing'|'uploading'|'done'|'error'>('idle');
  const [imgMeta, setImgMeta] = useState<{ w: number; h: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!value || value.startsWith('data:')) { setImgMeta(null); return; }
    const img = new Image();
    img.onload = () => setImgMeta({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setImgMeta(null);
    img.src = value;
  }, [value]);

  const processFile = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadStatus('optimizing');
      const dataUrl = await optimizeImageFile(file);
      const filename = `${filenamePrefix}-${Date.now()}.webp`;
      try {
        setUploadStatus('uploading');
        const publicPath = await contentStore.uploadImage(filename, dataUrl);
        onChange(publicPath);
        setUploadStatus('done');
      } catch {
        onChange(dataUrl);
        setUploadStatus('error');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith('image/')) await processFile(file);
  };

  const handlePasteClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          await processFile(new File([blob], 'clipboard.png', { type: imageType }));
          break;
        }
      }
    } catch { /* clipboard API not available or denied */ }
  };

  const isBase64 = value.startsWith('data:');

  const statusLabel: Record<string, string> = {
    idle: 'Загрузить фото',
    optimizing: 'Оптимизация…',
    uploading: 'Загрузка на GitHub…',
    done: '✓ Загружено',
    error: 'Сохранено локально',
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold">{label}</label>
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setUploadStatus('idle'); setImgMeta(null); }}
          className="flex-1 border border-gray-300 px-3 py-2 bg-white outline-none focus:border-primary text-xs font-mono"
          placeholder="https://... или перетащите файл ниже"
        />
        {value && (
          <button type="button" onClick={() => { onChange(''); setImgMeta(null); setUploadStatus('idle'); }}
            className="px-3 py-2 border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Убрать изображение">
            <X size={14} />
          </button>
        )}
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        className={`border-2 border-dashed transition-colors ${isDragOver ? 'border-accent bg-accent/5' : 'border-gray-200 bg-[#F8F8F5]'}`}
      >
        {value ? (
          <div className="relative group cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
            <img src={value} alt={label} className="w-full max-h-56 object-contain p-2" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <span className="bg-black/60 text-white text-[10px] font-mono uppercase tracking-widest px-3 py-1.5">Развернуть</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] font-mono px-2 py-1 flex items-center gap-3">
              {imgMeta && <span>{imgMeta.w} × {imgMeta.h} px</span>}
              {isBase64 && <span className="text-amber-300">⚠ base64 — сохраните для загрузки на GitHub</span>}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2 select-none">
            <ImagePlus size={28} strokeWidth={1.5} />
            <span className="text-xs font-mono">Перетащите изображение сюда</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className={`inline-flex items-center gap-2 px-4 py-2 border text-[10px] uppercase tracking-[0.18em] cursor-pointer transition-colors flex-shrink-0 ${isUploading ? 'border-gray-200 text-gray-400 cursor-wait' : 'border-gray-300 hover:bg-gray-50'}`}>
          {isUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {statusLabel[uploadStatus] ?? 'Загрузить фото'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
        </label>
        <button type="button" onClick={handlePasteClipboard} disabled={isUploading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-[10px] uppercase tracking-[0.18em] disabled:opacity-40" title="Вставить изображение из буфера обмена (Ctrl+C → Ctrl+V)">
          <Clipboard size={13} />
          Вставить
        </button>
        {uploadStatus === 'done' && <span className="text-[10px] text-green-600 font-mono">→ /images/uploads/</span>}
        {uploadStatus === 'error' && <span className="text-[10px] text-amber-600 font-mono">PAT не активен — сохранено локально</span>}
      </div>

      {lightboxOpen && value && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white p-2" onClick={() => setLightboxOpen(false)}><X size={22} /></button>
          <img src={value} alt={label} className="max-w-full max-h-full object-contain" />
          {imgMeta && (
            <div className="absolute bottom-4 text-center text-white/50 text-xs font-mono">{imgMeta.w} × {imgMeta.h} px</div>
          )}
        </div>
      )}
    </div>
  );
};

const AutoTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  countType?: 'chars' | 'words' | 'paragraphs';
}> = ({ countType, className = '', onChange, value = '', style, ...props }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 600) + 'px';
  }, [value]);

  const v = String(value);
  const count = !countType ? null
    : countType === 'words' ? v.trim().split(/\s+/).filter(Boolean).length
    : countType === 'paragraphs' ? v.split(/\n{2,}/).filter(s => s.trim()).length
    : v.length;
  const countLabel = countType === 'words' ? 'сл' : countType === 'paragraphs' ? 'абз' : 'симв';

  return (
    <div className="relative">
      <textarea ref={ref} value={value} onChange={onChange}
        className={`w-full resize-none overflow-hidden ${className}`}
        style={{ minHeight: '72px', ...style }}
        {...props}
      />
      {count !== null && (
        <span className="absolute bottom-2 right-2 text-[9px] font-mono text-gray-300 pointer-events-none select-none">
          {count} {countLabel}
        </span>
      )}
    </div>
  );
};

const VariantsEditor: React.FC<{ value: string; onChange: (json: string) => void; error?: string }> = ({ value, onChange, error }) => {
  const FORMATS: Format[] = ['paperback', 'hardcover', 'digital', 'special_edition'];
  const parse = (): BookVariant[] => { try { return JSON.parse(value) || []; } catch { return []; } };
  const variants = parse();

  const update = (idx: number, patch: Partial<BookVariant>) => {
    const next = variants.map((v, i) => i === idx ? { ...v, ...patch } : v);
    onChange(JSON.stringify(next, null, 2));
  };
  const add = () => onChange(JSON.stringify([...variants, { id: `sku-${Date.now()}`, format: 'paperback' as Format, language: 'ru', price: 0, stock: 0, isbn: '' }], null, 2));
  const remove = (idx: number) => onChange(JSON.stringify(variants.filter((_, i) => i !== idx), null, 2));

  return (
    <div className="space-y-3">
      {variants.length === 0 && (
        <p className="text-xs text-gray-400 font-mono py-6 text-center border border-dashed border-gray-200">Нет вариантов — добавьте первый</p>
      )}
      {variants.map((v, idx) => (
        <div key={idx} className="border border-gray-200 p-4 bg-[#FAFAF8] space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Вариант {idx + 1}</span>
            <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <LF label="SKU / ID"><input value={v.id} onChange={e => update(idx, { id: e.target.value })} className="w-full border border-gray-300 px-3 py-2 font-mono text-xs" /></LF>
            <LF label="Формат">
              <select value={v.format} onChange={e => update(idx, { format: e.target.value as Format })} className="w-full border border-gray-300 px-3 py-2 bg-white text-sm">
                {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </LF>
            <LF label="Язык издания"><input value={v.language} onChange={e => update(idx, { language: e.target.value })} className="w-full border border-gray-300 px-3 py-2 text-sm" placeholder="ru, en, de" /></LF>
            <LF label="Цена (€)"><input type="number" min={0} step={0.01} value={v.price} onChange={e => update(idx, { price: Number(e.target.value) })} className="w-full border border-gray-300 px-3 py-2" /></LF>
            <LF label="Остаток"><input type="number" min={0} value={v.stock} onChange={e => update(idx, { stock: Number(e.target.value) })} className="w-full border border-gray-300 px-3 py-2" /></LF>
            <LF label="ISBN"><input value={v.isbn} onChange={e => update(idx, { isbn: e.target.value })} className="w-full border border-gray-300 px-3 py-2 font-mono text-xs" /></LF>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
      <button type="button" onClick={add} className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-gray-300 text-xs uppercase tracking-[0.18em] hover:bg-gray-50 text-gray-500 transition-colors">
        <Plus size={13} /> Добавить вариант
      </button>
    </div>
  );
};

const ThemesEditor: React.FC<{ value: string; onChange: (json: string) => void; error?: string }> = ({ value, onChange, error }) => {
  const parse = (): BookTheme[] => { try { return JSON.parse(value) || []; } catch { return []; } };
  const themes = parse();
  const update = (idx: number, patch: Partial<BookTheme>) => {
    onChange(JSON.stringify(themes.map((t, i) => i === idx ? { ...t, ...patch } : t), null, 2));
  };
  const add = () => onChange(JSON.stringify([...themes, { title: '', text: '' }], null, 2));
  const remove = (idx: number) => onChange(JSON.stringify(themes.filter((_, i) => i !== idx), null, 2));

  return (
    <div className="space-y-3">
      {themes.map((theme, idx) => (
        <div key={idx} className="border border-gray-200 p-4 bg-[#FAFAF8] space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Тема {idx + 1}</span>
            <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
          </div>
          <LF label="Заголовок">
            <input value={theme.title} onChange={e => update(idx, { title: e.target.value })} className="w-full border border-gray-300 px-3 py-2 text-sm" />
          </LF>
          <LF label="Описание">
            <AutoTextarea value={theme.text}
              onChange={e => update(idx, { text: (e.target as HTMLTextAreaElement).value })}
              countType="words"
              className="border border-gray-300 px-3 py-2 text-sm" rows={3} />
          </LF>
        </div>
      ))}
      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
      <button type="button" onClick={add} className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-gray-300 text-xs uppercase tracking-[0.18em] hover:bg-gray-50 text-gray-500 transition-colors">
        <Plus size={13} /> Добавить тему
      </button>
    </div>
  );
};

const ReviewsEditor: React.FC<{ value: string; onChange: (json: string) => void; error?: string }> = ({ value, onChange, error }) => {
  const parse = (): BookReview[] => { try { return JSON.parse(value) || []; } catch { return []; } };
  const reviews = parse();
  const update = (idx: number, patch: Partial<BookReview>) => {
    onChange(JSON.stringify(reviews.map((r, i) => i === idx ? { ...r, ...patch } : r), null, 2));
  };
  const add = () => onChange(JSON.stringify([...reviews, { quote: '', author: '' }], null, 2));
  const remove = (idx: number) => onChange(JSON.stringify(reviews.filter((_, i) => i !== idx), null, 2));

  return (
    <div className="space-y-3">
      {reviews.map((review, idx) => (
        <div key={idx} className="border border-gray-200 p-4 bg-[#FAFAF8] space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Рецензия {idx + 1}</span>
            <button type="button" onClick={() => remove(idx)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
          </div>
          <LF label="Цитата">
            <AutoTextarea value={review.quote}
              onChange={e => update(idx, { quote: (e.target as HTMLTextAreaElement).value })}
              countType="words"
              className="border border-gray-300 px-3 py-2 text-sm" rows={2}
              placeholder="«...»" />
          </LF>
          <LF label="Автор / источник">
            <input value={review.author} onChange={e => update(idx, { author: e.target.value })} className="w-full border border-gray-300 px-3 py-2 text-sm" placeholder="Имя, издание" />
          </LF>
        </div>
      ))}
      {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
      <button type="button" onClick={add} className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-gray-300 text-xs uppercase tracking-[0.18em] hover:bg-gray-50 text-gray-500 transition-colors">
        <Plus size={13} /> Добавить рецензию
      </button>
    </div>
  );
};

// --- STATUS PANEL ---

type WorkflowRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  head_sha: string;
  head_commit?: { message?: string };
  created_at: string;
  updated_at: string;
};

const formatRelative = (iso: string) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return new Date(iso).toLocaleString();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const StatusPanel: React.FC = () => {
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [siteCheck, setSiteCheck] = useState<{ status: 'idle' | 'ok' | 'fail'; ms?: number }>({ status: 'idle' });
  const [rateLimit, setRateLimit] = useState<{ used: number; remaining: number; limit: number; resetsAt: number } | null>(null);
  const [writeLog, setWriteLog] = useState<WriteLogEntry[]>([]);
  const [cacheSnap, setCacheSnap] = useState(contentStore.getCacheSnapshot());
  const [now, setNow] = useState(Date.now());

  const REPO = 'munister-v/ampublishing';

  const refreshAll = async () => {
    // Write log & cache snapshot are synchronous
    setWriteLog(contentStore.getWriteLog());
    setCacheSnap(contentStore.getCacheSnapshot());

    // Site probe
    setSiteCheck({ status: 'idle' });
    const t0 = performance.now();
    fetch('https://ampublishing.org/', { mode: 'no-cors', cache: 'no-store' })
      .then(() => setSiteCheck({ status: 'ok', ms: Math.round(performance.now() - t0) }))
      .catch(() => setSiteCheck({ status: 'fail', ms: Math.round(performance.now() - t0) }));

    // Rate limit (uses PAT → authenticated, 5000/h)
    contentStore.getRateLimit().then(rl => setRateLimit(rl));

    // GitHub Actions runs
    setRunsLoading(true);
    setRunsError(null);
    try {
      const pat = sessionStorage.getItem('gh_pat') || localStorage.getItem('gh_pat') || '';
      const res = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=8`, {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(pat ? { Authorization: `Bearer ${pat}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      setRuns(data.workflow_runs || []);
    } catch (err) {
      setRunsError(err instanceof Error ? err.message : 'fetch failed');
    } finally {
      setRunsLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
    const tick = setInterval(() => {
      setNow(Date.now());
      setWriteLog(contentStore.getWriteLog()); // refresh log every 5 s live
      setCacheSnap(contentStore.getCacheSnapshot());
    }, 5000);
    return () => clearInterval(tick);
  }, []);

  const latest = runs[0];
  const lastDeployTime = latest?.updated_at ? new Date(latest.updated_at).getTime() : 0;
  const minutesSinceDeploy = lastDeployTime ? Math.floor((now - lastDeployTime) / 60000) : null;
  const isFresh = minutesSinceDeploy !== null && minutesSinceDeploy < 5;

  const ratePct = rateLimit ? Math.round((rateLimit.remaining / rateLimit.limit) * 100) : null;
  const rateColor = ratePct === null ? 'text-gray-400' : ratePct > 30 ? 'text-green-600' : ratePct > 10 ? 'text-amber-600' : 'text-red-600';

  return (
    <section className="space-y-6">

      {/* ── Row 1: Quick cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        {/* Deploy */}
        <div className="bg-white border border-primary/10 p-5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <GitBranch size={13} />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Deploy</span>
          </div>
          <p className="font-serif text-2xl leading-none">
            {latest ? (latest.conclusion || latest.status) : '—'}
          </p>
          <p className="text-[11px] text-gray-500">
            {latest ? `${formatRelative(latest.updated_at)} · ${latest.head_sha.slice(0, 7)}` : 'no data'}
          </p>
          {isFresh && <span className="text-[9px] uppercase tracking-widest text-accent font-bold">fresh</span>}
        </div>

        {/* Site */}
        <div className="bg-white border border-primary/10 p-5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            {siteCheck.status === 'fail' ? <WifiOff size={13} className="text-red-500" /> : <Wifi size={13} />}
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Site</span>
          </div>
          <p className={`font-serif text-2xl leading-none ${siteCheck.status === 'fail' ? 'text-red-600' : ''}`}>
            {siteCheck.status === 'ok' ? 'reachable' : siteCheck.status === 'fail' ? 'down?' : 'checking…'}
          </p>
          <p className="text-[11px] text-gray-500">{siteCheck.ms ? `${siteCheck.ms} ms` : ''}</p>
        </div>

        {/* GitHub rate limit */}
        <div className="bg-white border border-primary/10 p-5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Activity size={13} />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]">API quota</span>
          </div>
          {rateLimit ? (
            <>
              <p className={`font-serif text-2xl leading-none ${rateColor}`}>
                {rateLimit.remaining.toLocaleString()}
              </p>
              <p className="text-[11px] text-gray-500">
                of {rateLimit.limit.toLocaleString()} · resets {formatRelative(new Date(rateLimit.resetsAt).toISOString())}
              </p>
            </>
          ) : (
            <p className="font-serif text-2xl leading-none text-gray-400">—</p>
          )}
        </div>

        {/* Cache */}
        <div className="bg-white border border-primary/10 p-5 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <Database size={13} />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Cache</span>
          </div>
          <p className={`font-serif text-2xl leading-none ${cacheSnap.loaded ? 'text-green-600' : 'text-gray-400'}`}>
            {cacheSnap.loaded ? 'loaded' : 'empty'}
          </p>
          <div className="text-[11px] text-gray-500 font-mono space-y-0.5 mt-1">
            {(['ru', 'en', 'de'] as const).map(lang => (
              <div key={lang}>
                <span className="uppercase">{lang}</span>
                {' '}· {cacheSnap[lang].books}b {cacheSnap[lang].news}n
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: GitHub write log ── */}
      <div className="bg-white border border-primary/10">
        <div className="p-5 border-b border-primary/10 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-serif flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              GitHub write log
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">All PUT operations this session — auto-refreshes every 5 s</p>
          </div>
          <button onClick={() => setWriteLog(contentStore.getWriteLog())}
            className="px-3 py-2 text-[10px] uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        {writeLog.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 font-mono">No writes yet this session.</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-[#F4F4F0]">
              <tr className="font-mono text-[9px] uppercase tracking-widest text-gray-500">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">ms</th>
                <th className="px-4 py-3">SHA / error</th>
              </tr>
            </thead>
            <tbody>
              {writeLog.map((entry, i) => (
                <tr key={i} className="border-t border-gray-100 font-mono text-xs">
                  <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                    {new Date(entry.ts).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-2 text-[11px] max-w-[22ch] truncate" title={entry.path}>
                    {entry.path.replace('public/content/', '')}
                  </td>
                  <td className="px-4 py-2">
                    {entry.status === 'ok' && <span className="inline-flex items-center gap-1 text-green-700"><CheckCircle size={11} /> ok</span>}
                    {entry.status === 'error' && <span className="inline-flex items-center gap-1 text-red-600"><AlertCircle size={11} /> error</span>}
                    {entry.status === 'retry' && <span className="inline-flex items-center gap-1 text-amber-600"><RefreshCw size={11} /> retry</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{entry.durationMs ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-500 max-w-[26ch] truncate" title={entry.error || entry.sha || ''}>
                    {entry.error ? <span className="text-red-500">{entry.error.slice(0, 60)}</span> : (entry.sha || '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Row 3: GitHub Actions runs ── */}
      <div className="bg-white border border-primary/10">
        <div className="p-5 border-b border-primary/10 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-serif flex items-center gap-2">
              <Activity size={16} className="text-gray-400" />
              GitHub Actions runs
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">{REPO}</p>
          </div>
          <button onClick={refreshAll}
            className="px-3 py-2 text-[10px] uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5">
            {runsLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Refresh
          </button>
        </div>
        {runsError && <p className="px-6 py-3 text-sm text-red-600">{runsError}</p>}
        <table className="w-full text-left">
          <thead className="bg-[#F4F4F0]">
            <tr className="font-mono text-[9px] uppercase tracking-widest text-gray-500">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Workflow</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Commit</th>
              <th className="px-4 py-3">↗</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => (
              <tr key={run.id} className="border-t border-gray-100">
                <td className="px-4 py-2.5 text-xs">
                  <div>{formatRelative(run.updated_at)}</div>
                  <div className="text-[10px] text-gray-400">{new Date(run.updated_at).toLocaleTimeString()}</div>
                </td>
                <td className="px-4 py-2.5 text-xs">{run.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] border ${
                    run.conclusion === 'success' ? 'border-green-600 text-green-700' :
                    run.conclusion === 'failure' ? 'border-red-600 text-red-700' :
                    run.status === 'in_progress' || run.status === 'queued' ? 'border-amber-500 text-amber-700' :
                    'border-gray-400 text-gray-500'
                  }`}>{run.conclusion || run.status}</span>
                </td>
                <td className="px-4 py-2.5 text-[11px] font-mono">
                  <div>{run.head_sha.slice(0, 7)}</div>
                  <div className="text-gray-400 max-w-[22ch] truncate" title={run.head_commit?.message || ''}>
                    {run.head_commit?.message?.split('\n')[0] || ''}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs">
                  <a href={run.html_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">open</a>
                </td>
              </tr>
            ))}
            {!runs.length && !runsLoading &&
              <tr><td colSpan={5} className="p-6 text-sm text-gray-500">No runs found.</td></tr>
            }
          </tbody>
        </table>
      </div>

      {/* ── Notes ── */}
      <div className="text-[11px] text-gray-400 font-mono space-y-1 p-4 bg-white border border-primary/10">
        <p>Write log: live view of all GitHub Contents API PUTs this browser session. «retry» = 409 conflict auto-resolved.</p>
        <p>API quota: authenticated (PAT) limit is 5 000 req/h. Each save uses ~2 req (GET sha + PUT). Rate resets every hour.</p>
        <p>Site probe via opaque no-cors fetch — «reachable» if no network error.</p>
      </div>
    </section>
  );
};

export const AdminPage: React.FC = () => {
  const { logout, orders, refreshOrders, updateOrderStatus, reloadContent, showToast, setSiteSettings: setGlobalSiteSettings, setLanguage } = useApp();
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
  const [featuredAuthorDraft, setFeaturedAuthorDraft] = useState<FeaturedAuthor | null>(null);
  const [showcaseDraft, setShowcaseDraft] = useState<ShowcaseAuthor[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(createPaymentSettingsTemplate());
  const [siteDraft, setSiteDraft] = useState<SiteSettings | null>(null);
  const [copyDrafts, setCopyDrafts] = useState<Record<string, string>>({});
  const [bookJsonDrafts, setBookJsonDrafts] = useState({ variants: '[]', themes: '[]', reviews: '[]' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string>('');
  const [lastPublishedAt, setLastPublishedAt] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [bookDirty, setBookDirty] = useState(false);
  const [newsDirty, setNewsDirty] = useState(false);
  const [storyCollapsed, setStoryCollapsed] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');
  const [bookSearch, setBookSearch] = useState('');
  const [newsSearch, setNewsSearch] = useState('');
  const [bookSort, setBookSort] = useState<'default' | 'alpha' | 'stock'>('default');
  const [saveOpPhase, setSaveOpPhase] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Radio section state ──────────────────────────────────────────────────
  const [radioAuthed, setRadioAuthed] = useState(!!getRadioAdminToken());
  const [radioPassword, setRadioPassword] = useState('');
  const [radioLoginErr, setRadioLoginErr] = useState('');
  const [radioLoginBusy, setRadioLoginBusy] = useState(false);
  const [radioTab, setRadioTab] = useState<'config' | 'announce' | 'pins' | 'messages' | 'chat'>('config');
  const [radioBusy, setRadioBusy] = useState(false);
  const [radioFlash, setRadioFlash] = useState('');
  const [radioFlashErr, setRadioFlashErr] = useState(false);
  const [aType, setAType] = useState<'announcement' | 'podcast'>('announcement');
  const [aTitle, setATitle] = useState('');
  const [aText, setAText] = useState('');
  const [aDesc, setADesc] = useState('');
  const [aUrl, setAUrl] = useState('');
  const [aImage, setAImage] = useState('');
  const [aPinned, setAPinned] = useState(true);
  const [radioPins, setRadioPins] = useState<RadioMessage[]>([]);
  const [radioMessages, setRadioMessages] = useState<RadioMessage[]>([]);

  const startSave = (key: string, phase = '') => {
    setSavingKey(key);
    setSaveOpPhase(phase);
    setSavedFlash('');
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  };
  const advancePhase = (phase: string) => setSaveOpPhase(phase);
  const finishSave = (flash: string) => {
    setSavingKey(null);
    setSaveOpPhase('');
    setLastPublishedAt(new Date().toLocaleTimeString());
    setSavedFlash(flash);
    flashTimerRef.current = setTimeout(() => setSavedFlash(''), 5000);
  };
  const failSave = () => { setSavingKey(null); setSaveOpPhase(''); };

  const loadAdminData = async () => {
    setIsRefreshing(true);
    try {
      const [db, translationState, paymentState, siteState] = await Promise.all([
        api.getContentDatabase(),
        api.getTranslationOverrides(),
        api.getPaymentSettings(),
        api.getSiteSettings(),
      ]);
      setDatabase(db);
      setOverrides(translationState);
      setPaymentSettings(paymentState);
      setSiteDraft(siteState);
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
    if (activeTab !== 'radio' || !radioAuthed) return;
    if (radioTab === 'pins') fetchPinnedMessages().then(setRadioPins).catch(() => {});
    if (radioTab === 'messages') fetchRadioMessages().then(msgs => setRadioMessages(msgs.filter(m => !m.is_deleted))).catch(() => {});
  }, [activeTab, radioAuthed, radioTab]);

  const radioFlashMsg = (text: string, err = false) => {
    setRadioFlash(text); setRadioFlashErr(err);
    setTimeout(() => setRadioFlash(''), 3500);
  };

  const handleRadioLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setRadioLoginBusy(true); setRadioLoginErr('');
    try { await radioAdminLogin(radioPassword); setRadioAuthed(true); setRadioPassword(''); }
    catch (err: any) { setRadioLoginErr(err.message || 'Неверный пароль'); }
    finally { setRadioLoginBusy(false); }
  };

  const handleRadioAnnounce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aTitle && !aText) return;
    setRadioBusy(true);
    try {
      const payload: AnnouncePayload = { msg_type: aType, text: aText, meta_title: aTitle, meta_description: aDesc, meta_url: aUrl, meta_image: aImage, pinned: aPinned };
      await adminAnnounce(payload);
      radioFlashMsg(aPinned ? 'Опубликовано и закреплено' : 'Опубликовано');
      setATitle(''); setAText(''); setADesc(''); setAUrl(''); setAImage('');
    } catch (err: any) { radioFlashMsg(err.message || 'Ошибка', true); }
    finally { setRadioBusy(false); }
  };

  const handleRadioUnpin = async (id: number) => {
    setRadioBusy(true);
    try { await adminPin(id); setRadioPins(p => p.filter(m => m.id !== id)); radioFlashMsg('Откреплено'); }
    catch (err: any) { radioFlashMsg(err.message || 'Ошибка', true); }
    finally { setRadioBusy(false); }
  };

  const handleRadioUnpinAll = async () => {
    if (!confirm('Открепить все?')) return;
    setRadioBusy(true);
    try { await adminUnpinAll(); setRadioPins([]); radioFlashMsg('Все откреплены'); }
    catch (err: any) { radioFlashMsg(err.message || 'Ошибка', true); }
    finally { setRadioBusy(false); }
  };

  const handleRadioClearChat = async () => {
    if (!confirm('Очистить весь чат? Это нельзя отменить.')) return;
    setRadioBusy(true);
    try { const r = await adminClearChat(); radioFlashMsg(`Очищено: ${r.cleared} сообщений`); }
    catch (err: any) { radioFlashMsg(err.message || 'Ошибка', true); }
    finally { setRadioBusy(false); }
  };

  const handleRadioDeleteMsg = async (id: number) => {
    setRadioBusy(true);
    try {
      await deleteRadioMessage(id);
      setRadioMessages(prev => prev.filter(m => m.id !== id));
      radioFlashMsg('Сообщение удалено');
    } catch (err: any) { radioFlashMsg(err.message || 'Ошибка', true); }
    finally { setRadioBusy(false); }
  };

  useEffect(() => {
    if (!database) return;
    const existing = database[selectedLanguage].books.find(book => book.id === selectedBookId);
    if (existing) {
      skipBookDirtyRef.current = true;
      setBookDraft(cloneBook(existing));
      setBookDirty(false);
    } else if (!selectedBookId) {
      const first = database[selectedLanguage].books[0];
      if (first) { skipBookDirtyRef.current = true; setSelectedBookId(first.id); setBookDraft(cloneBook(first)); setBookDirty(false); }
      else setBookDraft(null);
    }
    // selectedBookId set but not in DB → new book template in progress, don't touch draft
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
    const existing = database[selectedLanguage].news.find(item => item.id === selectedNewsId);
    if (existing) {
      skipNewsDirtyRef.current = true;
      setNewsDraft({ ...existing });
      setNewsDirty(false);
    } else if (!selectedNewsId) {
      const first = database[selectedLanguage].news[0];
      if (first) { skipNewsDirtyRef.current = true; setSelectedNewsId(first.id); setNewsDraft({ ...first }); setNewsDirty(false); }
      else setNewsDraft(null);
    }
    // selectedNewsId set but not in DB → new news item in progress, don't touch draft
  }, [database, selectedLanguage, selectedNewsId]);

  useEffect(() => {
    setFeaturedAuthorDraft(getFeaturedAuthorContent(selectedLanguage, overrides[selectedLanguage]?.['static.our_authors.featured_author']));
    setShowcaseDraft(getAuthorShowcaseContent(selectedLanguage, overrides[selectedLanguage]?.['static.our_authors.showcase_items']));
  }, [selectedLanguage, overrides]);

  // When language changes: reset selections so the sync effects auto-pick the first item
  // in the new language's DB. Also reset copyDrafts so they repopulate from new language defaults.
  useEffect(() => {
    setSelectedBookId('');
    setSelectedNewsId('');
    setBookDirty(false);
    setNewsDirty(false);
    setDeleteConfirm(null);
    setCopyDrafts({});
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
      saveAdminDraftState({
        copyDrafts,
        selectedBookId,
        selectedNewsId,
        bookDraft: bookDraft || undefined,
        newsDraft: newsDraft || undefined,
        bookJsonDrafts,
        language: selectedLanguage,
      });
      setLastDraftSavedAt(new Date().toLocaleTimeString());
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [selectedLanguage, copyDrafts, selectedBookId, selectedNewsId, bookDraft, newsDraft, bookJsonDrafts]);

  // Mark dirty on user edits — skipNext refs let the DB-sync useEffects suppress a false-dirty
  const bookDraftRef = useRef(bookDraft);
  const skipBookDirtyRef = useRef(false);
  useEffect(() => {
    if (skipBookDirtyRef.current) { skipBookDirtyRef.current = false; bookDraftRef.current = bookDraft; return; }
    if (bookDraftRef.current !== null && bookDraft !== null) setBookDirty(true);
    bookDraftRef.current = bookDraft;
  }, [bookDraft, bookJsonDrafts]);

  const newsDraftRef = useRef(newsDraft);
  const skipNewsDirtyRef = useRef(false);
  useEffect(() => {
    if (skipNewsDirtyRef.current) { skipNewsDirtyRef.current = false; newsDraftRef.current = newsDraft; return; }
    if (newsDraftRef.current !== null && newsDraft !== null) setNewsDirty(true);
    newsDraftRef.current = newsDraft;
  }, [newsDraft]);

  const handleSaveBookRef = useRef<(() => void) | null>(null);
  const handleSaveNewsRef = useRef<(() => void) | null>(null);
  const deletingRef = useRef(false);

  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (bookDirty || newsDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [bookDirty, newsDirty]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeTab === 'books' && handleSaveBookRef.current) handleSaveBookRef.current();
        if (activeTab === 'news' && handleSaveNewsRef.current) handleSaveNewsRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeTab]);

  const copyJsonErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    contentGroups.forEach(group => {
      group.fields.forEach(field => {
        if (field.type !== 'json') return;
        const value = copyDrafts[field.key];
        if (value === undefined || value === null) return; // not yet loaded
        try {
          parseJsonField(value);
        } catch {
          errors[field.key] = 'Invalid JSON';
        }
      });
    });
    return errors;
  }, [copyDrafts]);

  const bookJsonErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!bookDraft) return errors;
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

  // True when the selected item exists in local state but hasn't been saved to DB yet
  const isNewBook = useMemo(() =>
    !!selectedBookId && !!database && !database[selectedLanguage].books.find(b => b.id === selectedBookId),
    [selectedBookId, database, selectedLanguage],
  );
  const isNewNews = useMemo(() =>
    !!selectedNewsId && !!database && !database[selectedLanguage].news.find(n => n.id === selectedNewsId),
    [selectedNewsId, database, selectedLanguage],
  );

  const handleSaveTranslationField = async (field: ContentField) => {
    const rawValue = copyDrafts[field.key] ?? '';
    try {
      const parsedValue = field.type === 'json' ? parseJsonField(rawValue) : rawValue;
      startSave(field.key, 'Отправка…');
      const nextOverrides = await api.setTranslationValue(selectedLanguage, field.key, parsedValue);
      setOverrides(nextOverrides);
      advancePhase('Обновление…');
      await reloadContent();
      finishSave(field.label + (selectedLanguage === 'ru' ? ' · EN/DE перевод запустится автоматически' : ''));
    } catch {
      failSave();
      showToast(`Could not save ${field.label}`, 'error');
    }
  };

  const handleResetTranslationField = async (field: ContentField) => {
    try {
      startSave(`${field.key}:reset`, 'Сброс…');
      const nextOverrides = await api.resetTranslationValue(selectedLanguage, field.key);
      setOverrides(nextOverrides);
      advancePhase('Обновление…');
      await reloadContent();
      finishSave(field.label + ' сброшено');
    } catch {
      failSave();
      showToast(`Could not reset ${field.label}`, 'error');
    }
  };

  const handleSaveBook = useCallback(async () => {
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
      startSave(`book:${bookDraft.id}`, 'Подготовка…');
      advancePhase('Отправка на GitHub…');
      await api.upsertBook(selectedLanguage, nextBook);
      advancePhase('Обновление контента…');
      await reloadContent();
      await loadAdminData();
      setBookDirty(false);
      finishSave('Книга «' + (bookDraft.title || bookDraft.id) + '» сохранена' + (selectedLanguage === 'ru' ? ' · EN/DE запустится автоматически' : ''));
    } catch {
      failSave();
      showToast('Не удалось сохранить книгу', 'error');
    }
  }, [bookDraft, bookJsonDrafts, selectedLanguage]);

  useEffect(() => { handleSaveBookRef.current = handleSaveBook; }, [handleSaveBook]);

  const handleDeleteBook = async () => {
    if (!bookDraft || deletingRef.current) return;
    deletingRef.current = true;
    try {
      startSave(`book:delete:${bookDraft.id}`, 'Удаление…');
      advancePhase('Удаление на GitHub…');
      await api.deleteBook(selectedLanguage, bookDraft.id);
      if (selectedLanguage === 'ru') {
        await api.deleteBook('en', bookDraft.id).catch(() => {});
        await api.deleteBook('de', bookDraft.id).catch(() => {});
      }
      setSelectedBookId('');
      await reloadContent();
      await loadAdminData();
      finishSave('Книга удалена');
    } catch {
      failSave();
      showToast('Не удалось удалить книгу', 'error');
    } finally {
      deletingRef.current = false;
    }
  };

  const handleSaveNews = useCallback(async () => {
    if (!newsDraft) return;
    try {
      startSave(`news:${newsDraft.id}`, 'Отправка…');
      await api.upsertNewsItem(selectedLanguage, newsDraft);
      advancePhase('Обновление…');
      await reloadContent();
      await loadAdminData();
      setNewsDirty(false);
      finishSave('Новость «' + (newsDraft.title || newsDraft.id) + '» сохранена' + (selectedLanguage === 'ru' ? ' · EN/DE запустится автоматически' : ''));
    } catch {
      failSave();
      showToast('Не удалось сохранить новость', 'error');
    }
  }, [newsDraft, selectedLanguage]);

  useEffect(() => { handleSaveNewsRef.current = handleSaveNews; }, [handleSaveNews]);

  const handleDeleteNews = async () => {
    if (!newsDraft || deletingRef.current) return;
    deletingRef.current = true;
    try {
      startSave(`news:delete:${newsDraft.id}`, 'Удаление…');
      advancePhase('Удаление на GitHub…');
      await api.deleteNewsItem(selectedLanguage, newsDraft.id);
      if (selectedLanguage === 'ru') {
        await api.deleteNewsItem('en', newsDraft.id);
        await api.deleteNewsItem('de', newsDraft.id);
      }
      setSelectedNewsId('');
      await reloadContent();
      await loadAdminData();
      finishSave('Новость удалена');
    } catch {
      failSave();
      showToast('Не удалось удалить новость', 'error');
    } finally {
      deletingRef.current = false;
    }
  };

  const handleSaveAuthors = async () => {
    try {
      startSave('authors', 'Сохранение авторов…');
      const nextOverrides = await api.setTranslationValue(selectedLanguage, 'static.our_authors.showcase_items', showcaseDraft);
      setOverrides(nextOverrides);
      advancePhase('Обновление…');
      await reloadContent();
      finishSave('Авторы сохранены' + (selectedLanguage === 'ru' ? ' · EN/DE запустится автоматически' : ''));
    } catch {
      failSave();
      showToast('Не удалось сохранить авторов', 'error');
    }
  };

  const handleSaveSiteSettings = async () => {
    if (!siteDraft) return;
    try {
      startSave('site-settings', 'Настройки сайта…');
      const next = await api.saveSiteSettings(siteDraft);
      setSiteDraft(next);
      setGlobalSiteSettings(next);
      advancePhase('Применение…');
      await reloadContent();
      finishSave('Настройки сохранены');
    } catch {
      failSave();
      showToast('Не удалось сохранить настройки', 'error');
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPassword2) { showToast('Пароли не совпадают', 'error'); return; }
    if (newPassword.length < 8) { showToast('Пароль минимум 8 символов', 'error'); return; }
    setSavingPassword(true);
    setSaveOpPhase('Смена пароля…');
    try {
      const pat = sessionStorage.getItem('gh_pat') || localStorage.getItem('gh_pat') || '';
      advancePhase('Сохранение…');
      await api.setupAdminPassword('admin@ampublishing.org', newPassword, pat);
      setSaveOpPhase('');
      setSavedFlash('Пароль обновлён');
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setSavedFlash(''), 5000);
      setNewPassword('');
      setNewPassword2('');
    } catch (err) {
      setSaveOpPhase('');
      showToast(err instanceof Error ? err.message : 'Не удалось сохранить пароль', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const updateSiteNav = (
    section: 'headerNav' | 'footerNav' | 'footerLegal',
    updater: (items: NavLinkConfig[]) => NavLinkConfig[],
  ) => {
    setSiteDraft(prev => {
      if (!prev) return prev;
      return { ...prev, [section]: updater(prev[section] || []) };
    });
  };

  const handleSavePaymentSettings = async () => {
    try {
      startSave('payment-settings', 'Настройки оплаты…');
      const next = await api.savePaymentSettings(paymentSettings);
      setPaymentSettings(next);
      finishSave('Настройки оплаты сохранены');
    } catch {
      failSave();
      showToast('Не удалось сохранить настройки оплаты', 'error');
    }
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setSavingKey(`order:${orderId}`);
    setSaveOpPhase('Статус заказа…');
    await updateOrderStatus(orderId, status);
    setSavingKey(null);
    setSaveOpPhase('');
  };

  const handlePaymentStatusChange = async (orderId: string, paymentStatus: PaymentStatus) => {
    try {
      setSavingKey(`payment:${orderId}`);
      setSaveOpPhase('Статус оплаты…');
      await api.updatePaymentStatus(orderId, paymentStatus);
      await refreshOrders();
      showToast(`Payment status for ${orderId} updated`);
    } catch {
      showToast('Could not update payment status', 'error');
    } finally {
      setSavingKey(null);
      setSaveOpPhase('');
    }
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
    <div className="min-h-screen bg-[#F4F4F0] flex flex-col md:flex-row text-primary md:h-screen md:overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="md:hidden sticky top-0 z-30 bg-primary text-white border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="font-serif text-2xl">AM Admin</h2>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-white/60">Управление контентом</p>
          </div>
          <button onClick={() => setSidebarOpen(prev => !prev)} className="p-2 border border-white/20">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <aside className={`
  fixed top-0 left-0 bottom-0 z-40 w-72 max-w-[85vw] overflow-y-auto
  transition-transform duration-200 ease-in-out
  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
  md:relative md:translate-x-0 md:top-0 md:w-72 md:max-w-none
  md:flex-shrink-0 md:sticky md:h-screen
  bg-primary text-white
`}>
        <div className="hidden md:block p-8 border-b border-white/10">
          <h2 className="font-serif text-3xl">AM Admin</h2>
          <p className="text-[10px] font-mono opacity-60 uppercase tracking-[0.24em] mt-2">Управление контентом</p>
        </div>

        <nav className="p-6 space-y-3">
          {[
            { id: 'copy', label: 'Тексты сайта', icon: <FileText size={16} /> },
            { id: 'books', label: 'Книги', icon: <BookOpen size={16} /> },
            { id: 'news', label: 'Мероприятия', icon: <Newspaper size={16} /> },
            { id: 'authors', label: 'Наши авторы', icon: <Globe size={16} /> },
            { id: 'about', label: 'О нас', icon: <Info size={16} /> },
            { id: 'site', label: 'Сайт / Шапка / Подвал', icon: <Layout size={16} /> },
            { id: 'payments', label: 'Оплата', icon: <Gavel size={16} /> },
            { id: 'orders', label: 'Заказы', icon: <ShoppingBag size={16} />, badge: orders.filter(o => o.paymentStatus === 'pending').length },
            { id: 'status', label: 'Статус системы', icon: <Activity size={16} />, badge: 0 },
            { id: 'radio', label: 'Радио', icon: <Wifi size={16} /> },
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
              {item.badge > 0 && <span className="ml-auto bg-accent text-primary text-[9px] font-bold px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="px-6 pb-6">
          <div className="bg-white/5 border border-white/10 p-4 mb-4">
            <p className="text-[10px] uppercase font-mono tracking-[0.22em] text-white/50 mb-3">Язык редактирования</p>
            <div className="grid grid-cols-3 gap-2">
              {(['ru', 'en', 'de'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => { setSelectedLanguage(lang); setSidebarOpen(false); }}
                  className={`py-2 text-[10px] uppercase tracking-[0.2em] border relative ${
                    selectedLanguage === lang ? 'bg-accent text-primary border-accent font-bold' : 'border-white/20 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {lang}
                  {lang === 'ru' && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-400" title="Основной язык" />}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-white/40">
              {selectedLanguage === 'ru'
                ? '✓ Основной. Сохрани — CI переведёт EN/DE автоматически.'
                : `Правка ${selectedLanguage.toUpperCase()} напрямую (обход авто-перевода CI).`}
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 p-4">
            <p className="text-[10px] uppercase font-mono tracking-[0.22em] text-white/50 mb-3">Резервная копия</p>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={handleExport} className="flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-widest border border-white/15 hover:bg-white/10">
                <Download size={14} />
                Экспорт данных
              </button>
              <label className="flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-widest border border-white/15 hover:bg-white/10 cursor-pointer">
                <Upload size={14} />
                Импорт резервной копии
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
            Обновить
          </button>
          <button
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs uppercase tracking-widest border border-red-500/40 text-red-200 hover:bg-red-900/20"
          >
            <LogOut size={14} />
            Выйти
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto overflow-x-hidden min-h-screen md:h-screen">
        {/* ── Live save progress ── */}
        {(savingKey || savingPassword) && (
          <div className="sticky top-0 z-20 bg-primary text-white border-b border-white/10">
            <div className="px-4 py-2.5 flex items-center gap-3">
              <Loader2 size={13} className="animate-spin text-accent flex-shrink-0" />
              <span className="font-mono text-xs text-white/90 font-medium truncate flex-1 min-w-0">
                {saveOpPhase || 'Сохранение…'}
              </span>
              <span className="font-mono text-[10px] text-white/40 tracking-widest uppercase flex-shrink-0">GitHub API</span>
            </div>
            <div className="h-0.5 overflow-hidden bg-white/5">
              <div className="h-full bg-accent/70 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}
        {savedFlash && !savingKey && !savingPassword && (
          <div className="sticky top-0 z-20 bg-green-900 text-white border-b border-green-700/40 px-4 py-2 flex items-center gap-2">
            <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
            <span className="font-mono text-xs text-green-100 truncate">{savedFlash}</span>
            <span className="font-mono text-[10px] text-green-400/60 flex-shrink-0 ml-auto">{lastPublishedAt}</span>
          </div>
        )}
        {!database ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : null}

        {database ? (() => {
          const totalBooks = database[selectedLanguage].books.length;
          const totalNews = database[selectedLanguage].news.length;
          const pendingOrders = orders.filter(o => o.paymentStatus === 'pending').length;
          const totalRevenue = orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);
          const hasErrors = Object.keys(copyJsonErrors).length || Object.keys(bookJsonErrors).length ||
            (!isNewBook && bookRequiredErrors.length) ||
            (!isNewNews && newsRequiredErrors.length);
          return (
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="bg-white border border-primary/10 p-4 flex-1 min-w-[110px]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Книги</p>
                <p className="mt-1 font-serif text-3xl">{totalBooks}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4 flex-1 min-w-[110px]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Мероприятия</p>
                <p className="mt-1 font-serif text-3xl">{totalNews}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4 flex-1 min-w-[110px]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Заказы</p>
                <p className="mt-1 font-serif text-3xl">{orders.length}</p>
              </div>
              <div className={`border p-4 flex-1 min-w-[130px] ${pendingOrders > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-primary/10'}`}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Ожидают оплаты</p>
                <p className={`mt-1 font-serif text-3xl ${pendingOrders > 0 ? 'text-amber-700' : ''}`}>{pendingOrders}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4 flex-1 min-w-[120px]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Выручка (оплачено)</p>
                <p className="mt-1 font-serif text-3xl">{totalRevenue > 0 ? `€${totalRevenue.toFixed(0)}` : '—'}</p>
              </div>
              <div className={`border p-4 flex-1 min-w-[110px] ${hasErrors ? 'bg-red-50 border-red-200' : 'bg-white border-primary/10'}`}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Контент</p>
                <p className={`mt-1 font-serif text-2xl ${hasErrors ? 'text-red-600' : 'text-green-700'}`}>{hasErrors ? 'Ошибки' : 'ОК'}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4 flex-1 min-w-[150px]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Последнее сохранение</p>
                <p className="mt-1 font-serif text-xl truncate">{lastPublishedAt || '—'}</p>
              </div>
            </div>
          );
        })() : null}

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
                      <div className="flex flex-wrap justify-between items-start mb-3 gap-y-2 gap-x-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm">{field.label}</p>
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400 break-all">{field.key}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleResetTranslationField(field)}
                            className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-100"
                            title="Сбросить к базовому значению из translations.ts"
                          >
                            Сбросить
                          </button>
                          <button
                            onClick={() => handleSaveTranslationField(field)}
                            disabled={!!copyJsonErrors[field.key]}
                            className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary"
                          >
                            {savingKey === field.key ? <Loader2 size={12} className="animate-spin" /> : 'Сохранить'}
                          </button>
                        </div>
                      </div>
                      {field.key === 'home.hero_image' || field.key === 'home.feature_image' || field.key === 'static.about.mission_image' ? (
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
                        <AutoTextarea
                          value={copyDrafts[field.key] || ''}
                          onChange={e => setCopyDrafts(prev => ({ ...prev, [field.key]: (e.target as HTMLTextAreaElement).value }))}
                          rows={field.type === 'json' ? 12 : 5}
                          countType={field.type === 'json' ? undefined : 'words'}
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
                <h3 className="text-2xl font-serif">Книги</h3>
                <button
                  onClick={() => {
                    const next = createBookTemplate(selectedLanguage);
                    setSelectedBookId(next.id);
                    skipBookDirtyRef.current = true;
                    setBookDraft(next);
                    setBookDirty(false);
                  }}
                  className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                >
                  <Plus size={12} />
                  Добавить
                </button>
              </div>
              <div className="p-3 border-b border-gray-100 space-y-2">
                <input
                  value={bookSearch}
                  onChange={e => setBookSearch(e.target.value)}
                  placeholder="Поиск по названию…"
                  className="w-full border border-gray-200 px-3 py-2 text-xs bg-[#F8F8F5] outline-none focus:border-primary"
                />
                <div className="flex gap-1 items-center">
                  <SortAsc size={11} className="text-gray-400 flex-shrink-0" />
                  {(['default', 'alpha', 'stock'] as const).map(s => (
                    <button key={s} onClick={() => setBookSort(s)}
                      className={`px-2 py-0.5 text-[9px] uppercase tracking-widest border ${bookSort === s ? 'bg-primary text-white border-primary' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}>
                      {s === 'default' ? 'Дата' : s === 'alpha' ? 'А-Я' : 'Склад'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {books
                  .filter(b => !bookSearch || b.title.toLowerCase().includes(bookSearch.toLowerCase()) || b.author.toLowerCase().includes(bookSearch.toLowerCase()))
                  .sort((a, b2) => bookSort === 'alpha' ? a.title.localeCompare(b2.title) : bookSort === 'stock' ? a.stock - b2.stock : 0)
                  .map(book => (
                  <button
                    key={book.id}
                    onClick={() => { setSelectedBookId(book.id); setBookDirty(false); }}
                    className={`w-full text-left p-3 hover:bg-gray-50 flex gap-3 items-center ${selectedBookId === book.id ? 'bg-[#F4F4F0]' : ''}`}
                  >
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover flex-shrink-0 border border-gray-100" />
                    ) : (
                      <div className="w-10 h-14 bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300 text-[10px]">?</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-serif text-base leading-tight truncate">{book.title || book.id}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 truncate">{book.author}</p>
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {book.isPreorder && <span className="text-[9px] bg-accent/20 text-accent-dark px-1 uppercase tracking-widest">предзаказ</span>}
                        {book.stock === 0 ? <span className="text-[9px] bg-red-100 text-red-600 px-1 font-mono">нет</span> : book.stock <= 3 ? <span className="text-[9px] bg-amber-100 text-amber-700 px-1 font-mono">{book.stock} ост.</span> : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white border border-primary/10 p-6">
              {bookDraft ? (
                <div className="space-y-8">
                  <div className="sticky top-0 z-10 bg-white -mx-6 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <h3 className="text-3xl font-serif">Редактор книги</h3>
                      {bookDirty && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">● Есть несохранённые изменения · Ctrl+S</span>}
                    </div>
                    <div className="flex gap-2 items-center">
                      {deleteConfirm === `book:${bookDraft.id}` ? (
                        <>
                          <span className="text-xs text-red-600 font-bold">Удалить книгу?</span>
                          <button onClick={handleDeleteBook} disabled={!!savingKey} className="px-4 py-3 bg-red-600 text-white flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">
                            {savingKey?.startsWith('book:delete:') ? <Loader2 size={14} className="animate-spin" /> : null}Да, удалить
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} disabled={!!savingKey} className="px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest disabled:opacity-50">Отмена</button>
                        </>
                      ) : (
                        <>
                          {!isNewBook && (
                            <a href={`/catalog/${bookDraft.id}`} target="_blank" rel="noopener noreferrer"
                              className="px-4 py-3 border border-gray-300 hover:bg-gray-50 flex items-center gap-2 text-xs uppercase tracking-widest">
                              <ExternalLink size={14} />
                              Открыть
                            </a>
                          )}
                          <button onClick={() => setDeleteConfirm(`book:${bookDraft.id}`)} className="px-4 py-3 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-xs uppercase tracking-widest">
                            <Trash2 size={14} />
                            Удалить
                          </button>
                          <button onClick={() => {
                            const dup = cloneBook(bookDraft);
                            dup.id = `${bookDraft.id}-copy`;
                            skipBookDirtyRef.current = true;
                            setSelectedBookId(dup.id);
                            setBookDraft(dup);
                            setBookDirty(true);
                          }} className="px-4 py-3 border border-gray-300 hover:bg-gray-50 flex items-center gap-2 text-xs uppercase tracking-widest" title="Создать копию книги">
                            <Copy size={14} />
                            Копия
                          </button>
                          <button onClick={handleSaveBook} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                            {savingKey === `book:${bookDraft.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Сохранить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {(!isNewBook && bookRequiredErrors.length) || Object.keys(bookJsonErrors).length ? (
                    <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {[...(!isNewBook ? bookRequiredErrors : []), ...Object.values(bookJsonErrors)].map(item => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <LF label="ID (slug)" hint="Создаётся автоматически — менять не нужно">
                      <input value={bookDraft.id} onChange={e => setBookDraft(prev => prev ? { ...prev, id: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" />
                    </LF>
                    <LF label="Дата выхода">
                      <input type="date" value={bookDraft.releaseDate} onChange={e => setBookDraft(prev => prev ? { ...prev, releaseDate: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Название книги">
                      <input value={bookDraft.title} onChange={e => {
                        const title = e.target.value;
                        setBookDraft(prev => {
                          if (!prev) return prev;
                          return { ...prev, title, ...(isNewBook ? { id: slugify(title) } : {}) };
                        });
                      }} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Автор">
                      <input value={bookDraft.author} onChange={e => setBookDraft(prev => prev ? { ...prev, author: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Цена (€)">
                      <input type="number" min={0} step={0.01} value={bookDraft.price} onChange={e => setBookDraft(prev => prev ? { ...prev, price: Number(e.target.value) } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Старая цена € (зачёркнутая)">
                      <input type="number" min={0} step={0.01} value={bookDraft.oldPrice ?? ''} onChange={e => setBookDraft(prev => prev ? { ...prev, oldPrice: e.target.value ? Number(e.target.value) : undefined } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="Оставьте пустым, если нет скидки" />
                    </LF>
                    <LF label="Остаток на складе (0 = нет в наличии)">
                      <input type="number" min={0} value={bookDraft.stock} onChange={e => setBookDraft(prev => prev ? { ...prev, stock: Number(e.target.value) } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Тип издания">
                      <select value={bookDraft.type || 'publisher'} onChange={e => setBookDraft(prev => prev ? { ...prev, type: e.target.value as Book['type'] } : prev)} className="w-full border border-gray-300 px-4 py-3 bg-white">
                        <option value="publisher">Издательское издание</option>
                        <option value="author_project">Авторский проект</option>
                      </select>
                    </LF>
                    <LF label="Возрастной рейтинг">
                      <select value={bookDraft.ageRating || '16+'} onChange={e => setBookDraft(prev => prev ? { ...prev, ageRating: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3 bg-white">
                        {['0+','6+','12+','16+','18+'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </LF>
                    <LF label="Серия">
                      <input value={bookDraft.series || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, series: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Издательство">
                      <input value={bookDraft.details.publisher || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, publisher: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Жанры (через запятую)" className="md:col-span-2">
                      <input value={bookDraft.genre.join(', ')} onChange={e => setBookDraft(prev => prev ? { ...prev, genre: e.target.value.split(',').map(item => item.trim()).filter(Boolean) } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="проза, лирика, историческая" />
                    </LF>
                    <LF label="Ссылки на книгу (магазины)" className="md:col-span-2">
                      <div className="space-y-3">
                        <p className="text-xs leading-relaxed text-gray-500">
                          Shopify-ссылка становится основной кнопкой покупки на сайте. Остальные ссылки показываются ниже как дополнительные магазины.
                        </p>
                        {(Array.isArray(bookDraft.purchaseLinks) ? bookDraft.purchaseLinks : []).map((link, idx) => (
                          <div key={link.id} className="flex flex-col sm:flex-row gap-2">
                            <input
                              value={link.label}
                              onChange={e => setBookDraft(prev => {
                                if (!prev) return prev;
                                const list = [...(Array.isArray(prev.purchaseLinks) ? prev.purchaseLinks : [])];
                                list[idx] = { ...list[idx], label: e.target.value };
                                return { ...prev, purchaseLinks: list };
                              })}
                              className="sm:w-1/3 border border-gray-300 px-4 py-3 text-sm"
                              placeholder="Название (напр. Mnogoknig)"
                            />
                            <input
                              value={link.url}
                              onChange={e => setBookDraft(prev => {
                                if (!prev) return prev;
                                const list = [...(Array.isArray(prev.purchaseLinks) ? prev.purchaseLinks : [])];
                                list[idx] = { ...list[idx], url: e.target.value };
                                return { ...prev, purchaseLinks: list };
                              })}
                              className="flex-1 border border-gray-300 px-4 py-3 font-mono text-sm"
                              placeholder="https://..."
                            />
                            {`${link.id || ''} ${link.label || ''} ${link.url || ''}`.toLowerCase().includes('shopify') ? (
                              <span className="sm:self-center text-[10px] uppercase font-bold tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2">
                                checkout
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setBookDraft(prev => prev ? { ...prev, purchaseLinks: (Array.isArray(prev.purchaseLinks) ? prev.purchaseLinks : []).filter((_, i) => i !== idx) } : prev)}
                              className="px-4 py-3 border border-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors text-xs uppercase font-bold shrink-0"
                            >
                              Удалить
                            </button>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setBookDraft(prev => {
                              if (!prev) return prev;
                              const list = Array.isArray(prev.purchaseLinks) ? prev.purchaseLinks : [];
                              const hasShopify = list.some(link => `${link.id} ${link.label} ${link.url}`.toLowerCase().includes('shopify'));
                              if (hasShopify) return prev;
                              return { ...prev, purchaseLinks: [{ id: 'shopify', label: 'Shopify', url: '' }, ...list] };
                            })}
                            className="text-xs uppercase font-bold tracking-widest text-white bg-primary border border-primary px-4 py-2 hover:bg-accent hover:border-accent transition-colors"
                          >
                            + Shopify checkout
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookDraft(prev => prev ? { ...prev, purchaseLinks: [...(Array.isArray(prev.purchaseLinks) ? prev.purchaseLinks : []), { id: `pl-${Date.now()}`, label: '', url: '' }] } : prev)}
                            className="text-xs uppercase font-bold tracking-widest text-primary border border-gray-300 px-4 py-2 hover:bg-gray-50"
                          >
                            + Добавить ссылку
                          </button>
                        </div>
                      </div>
                    </LF>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-2">Метки и статусы</p>
                    <div className="flex flex-wrap gap-3">
                      {([
                        { id: 'new', label: 'Новинка' },
                        { id: 'bestseller', label: 'Бестселлер' },
                        { id: 'preorder', label: 'Предзаказ' },
                        { id: 'exclusive', label: 'Эксклюзив' },
                        { id: '18+', label: '18+' },
                        { id: 'last_copy', label: 'Последний экземпляр' },
                      ] as const).map(badge => (
                        <label key={badge.id} className="flex items-center gap-2 border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                          <input type="checkbox" checked={(bookDraft.badges || []).includes(badge.id)} onChange={e => setBookDraft(prev => {
                            if (!prev) return prev;
                            const next = e.target.checked ? [...(prev.badges || []), badge.id] : (prev.badges || []).filter(b => b !== badge.id);
                            return { ...prev, badges: next as Book['badges'] };
                          })} />
                          {badge.label}
                        </label>
                      ))}
                      <label className="flex items-center gap-2 border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                        <input type="checkbox" checked={!!bookDraft.isPreorder} onChange={e => setBookDraft(prev => prev ? { ...prev, isPreorder: e.target.checked } : prev)} />
                        Режим предзаказа
                      </label>
                    </div>
                  </div>

                  <ImageField
                    label="Обложка"
                    value={bookDraft.coverUrl}
                    onChange={value => setBookDraft(prev => prev ? { ...prev, coverUrl: value } : prev)}
                    filenamePrefix={`cover-${bookDraft.id || 'book'}`}
                  />

                  <LF label="Краткое описание">
                    <AutoTextarea value={bookDraft.description}
                      onChange={e => setBookDraft(prev => prev ? { ...prev, description: (e.target as HTMLTextAreaElement).value } : prev)}
                      countType="words"
                      className="border border-gray-300 px-4 py-3" rows={4} />
                  </LF>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    <LF label="Страниц">
                      <input type="number" min={0} value={bookDraft.details.pages} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, pages: Number(e.target.value) } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Год">
                      <input type="number" min={1900} max={2100} value={bookDraft.details.year} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, year: Number(e.target.value) } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Вес">
                      <input value={bookDraft.details.weight || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, weight: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="320 g" />
                    </LF>
                    <LF label="Формат">
                      <input value={bookDraft.details.dimensions || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, dimensions: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="21×14 cm" />
                    </LF>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between border-t border-gray-100 pt-6">
                      <h4 className="font-serif text-2xl">Story Page</h4>
                      <button type="button" onClick={() => setStoryCollapsed(v => !v)}
                        className="text-[10px] font-mono uppercase tracking-widest border border-gray-300 px-3 py-1.5 hover:bg-gray-50 flex-shrink-0">
                        {storyCollapsed ? '▾ Развернуть' : '▴ Свернуть'}
                      </button>
                    </div>
                    <div className={storyCollapsed ? 'hidden' : 'space-y-5'}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <LF label="Эпиграф">
                        <input value={bookDraft.story?.quote || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, quote: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="«...»" />
                      </LF>
                      <LF label="Источник цитаты">
                        <input value={bookDraft.story?.quoteSource || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, quoteSource: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="— Name, Title" />
                      </LF>
                    </div>
                    <LF label="Ссылка на детальную страницу">
                      <input value={bookDraft.story?.detailPageUrl || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, detailPageUrl: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
                    </LF>
                    <ImageField
                      label="URL фото для детальной страницы"
                      value={bookDraft.story?.featureImageUrl || ''}
                      onChange={value => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, featureImageUrl: value } } : prev)}
                      filenamePrefix={`story-${bookDraft.id || 'book'}`}
                    />
                    <LF label="О книге (абзацы)" hint="Разделяйте абзацы двойным переносом строки">
                      <AutoTextarea value={(bookDraft.story?.about || []).join('\n\n')}
                        onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, about: parseParagraphs((e.target as HTMLTextAreaElement).value) } } : prev)}
                        countType="paragraphs"
                        className="border border-gray-300 px-4 py-3" rows={6} />
                    </LF>
                    <LF label="Отрывок" hint="Разделяйте абзацы двойным переносом строки">
                      <AutoTextarea value={(bookDraft.story?.excerpt || []).join('\n\n')}
                        onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, excerpt: parseParagraphs((e.target as HTMLTextAreaElement).value) } } : prev)}
                        countType="paragraphs"
                        className="border border-gray-300 px-4 py-3" rows={6} />
                    </LF>
                    <LF label="Биография автора">
                      <AutoTextarea value={(bookDraft.story?.authorBio || []).join('\n\n')}
                        onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, authorBio: parseParagraphs((e.target as HTMLTextAreaElement).value) } } : prev)}
                        countType="words"
                        className="border border-gray-300 px-4 py-3" rows={5} />
                    </LF>
                    <LF label="Примечание к заказу">
                      <AutoTextarea value={bookDraft.story?.orderNote || ''}
                        onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, orderNote: (e.target as HTMLTextAreaElement).value } } : prev)}
                        countType="chars"
                        className="border border-gray-300 px-4 py-3" rows={3} />
                    </LF>
                    <LF label="Варианты издания">
                      <VariantsEditor
                        value={bookJsonDrafts.variants}
                        onChange={v => setBookJsonDrafts(prev => ({ ...prev, variants: v }))}
                        error={bookJsonErrors.variants}
                      />
                    </LF>
                    <LF label="Темы книги">
                      <ThemesEditor
                        value={bookJsonDrafts.themes}
                        onChange={v => setBookJsonDrafts(prev => ({ ...prev, themes: v }))}
                        error={bookJsonErrors.themes}
                      />
                    </LF>
                    <LF label="Рецензии читателей">
                      <ReviewsEditor
                        value={bookJsonDrafts.reviews}
                        onChange={v => setBookJsonDrafts(prev => ({ ...prev, reviews: v }))}
                        error={bookJsonErrors.reviews}
                      />
                    </LF>
                    </div>{/* end storyCollapsed wrapper */}
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
                <h3 className="text-2xl font-serif">Мероприятия</h3>
                <button
                  onClick={() => {
                    const next = createNewsTemplate();
                    setSelectedNewsId(next.id);
                    skipNewsDirtyRef.current = true;
                    setNewsDraft(next);
                    setNewsDirty(false);
                  }}
                  className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                >
                  <Plus size={12} />
                  Добавить
                </button>
              </div>
              <div className="p-3 border-b border-gray-100">
                <input
                  value={newsSearch}
                  onChange={e => setNewsSearch(e.target.value)}
                  placeholder="Поиск по заголовку…"
                  className="w-full border border-gray-200 px-3 py-2 text-xs bg-[#F8F8F5] outline-none focus:border-primary"
                />
              </div>
              <div className="divide-y divide-gray-100">
                {news.filter(n => !newsSearch || n.title.toLowerCase().includes(newsSearch.toLowerCase())).map(item => (
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
                  <div className="sticky top-0 z-10 bg-white -mx-6 px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div>
                      <h3 className="text-3xl font-serif">Редактор новости</h3>
                      {newsDirty && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">● НЕСОХРАНЁННЫЕ ИЗМЕНЕНИЯ · CTRL+S</span>}
                    </div>
                    <div className="flex gap-2 items-center">
                      {deleteConfirm === `news:${newsDraft.id}` ? (
                        <>
                          <span className="text-xs text-red-600 font-bold">Подтвердить удаление?</span>
                          <button onClick={handleDeleteNews} disabled={!!savingKey} className="px-4 py-3 bg-red-600 text-white flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed">
                            {savingKey?.startsWith('news:delete:') ? <Loader2 size={14} className="animate-spin" /> : null}Да, удалить
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} disabled={!!savingKey} className="px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest disabled:opacity-50">Отмена</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setDeleteConfirm(`news:${newsDraft.id}`)} className="px-4 py-3 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-xs uppercase tracking-widest">
                            <Trash2 size={14} />
                            Удалить
                          </button>
                          <button onClick={() => {
                            const dup: NewsItem = { ...newsDraft, id: `${newsDraft.id}-copy` };
                            skipNewsDirtyRef.current = true;
                            setSelectedNewsId(dup.id);
                            setNewsDraft(dup);
                            setNewsDirty(true);
                          }} className="px-4 py-3 border border-gray-300 hover:bg-gray-50 flex items-center gap-2 text-xs uppercase tracking-widest" title="Дублировать новость">
                            <Copy size={14} />
                            Копия
                          </button>
                          <button onClick={handleSaveNews} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                            {savingKey === `news:${newsDraft.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Сохранить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {!isNewNews && newsRequiredErrors.length ? (
                    <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {newsRequiredErrors.map(item => <div key={item}>{item}</div>)}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <LF label="ID (slug)">
                      <input value={newsDraft.id} onChange={e => setNewsDraft(prev => prev ? { ...prev, id: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" />
                    </LF>
                    <LF label="Дата">
                      <input type="date" value={newsDraft.date} onChange={e => setNewsDraft(prev => prev ? { ...prev, date: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                  </div>
                  <LF label="Заголовок">
                    <input value={newsDraft.title} onChange={e => setNewsDraft(prev => prev ? { ...prev, title: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                  </LF>
                  <LF label="Краткий анонс">
                    <AutoTextarea value={newsDraft.preview}
                      onChange={e => setNewsDraft(prev => prev ? { ...prev, preview: (e.target as HTMLTextAreaElement).value } : prev)}
                      countType="words"
                      className="border border-gray-300 px-4 py-3" rows={5} />
                  </LF>
                  <LF label="Текст мероприятия (полный)">
                    <AutoTextarea value={newsDraft.body || ''}
                      onChange={e => setNewsDraft(prev => prev ? { ...prev, body: (e.target as HTMLTextAreaElement).value } : prev)}
                      countType="words"
                      className="border border-gray-300 px-4 py-3" rows={10} />
                  </LF>
                </div>
              ) : (
                <div className="text-gray-400">Select a news item or create a new one.</div>
              )}
            </section>
          </div>
        ) : null}

        {database && activeTab === 'authors' ? (
          <div className="space-y-8">
            <section className="bg-white border border-primary/10 p-6 md:p-8">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
                <div>
                  <h3 className="text-3xl font-serif">Наши авторы</h3>
                  <p className="mt-2 text-sm text-gray-500">Карточки авторов на странице /our-authors и на главной.</p>
                </div>
                <button onClick={handleSaveAuthors} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                  {savingKey === 'authors' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Сохранить авторов
                </button>
              </div>

              <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-2xl">Карточки авторов</h4>
                      <button
                        onClick={() => setShowcaseDraft(prev => [
                          ...prev,
                          {
                            id: `author-${Date.now()}`,
                            nameMain: '',
                            nameAccent: '',
                            initial: 'A',
                            years: '',
                            knownFor: '',
                            bio: '',
                            tags: [],
                            imageUrl: '',
                          },
                        ])}
                        className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                      >
                        <Plus size={12} />
                        Добавить автора
                      </button>
                    </div>

                    {showcaseDraft.map((item, index) => (
                      <div key={item.id} className="border border-primary/10 p-6 bg-white">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-5">
                          <h5 className="font-serif text-xl">Автор {index + 1}</h5>
                          <div className="flex gap-2 flex-wrap">
                            <button disabled={index === 0} onClick={() => setShowcaseDraft(prev => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })} className="px-2 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-30" title="Вверх"><ArrowUp size={13} /></button>
                            <button disabled={index === showcaseDraft.length - 1} onClick={() => setShowcaseDraft(prev => { const next = [...prev]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })} className="px-2 py-2 border border-gray-300 hover:bg-gray-50 disabled:opacity-30" title="Вниз"><ArrowDown size={13} /></button>
                            <button
                              onClick={() => setShowcaseDraft(prev => prev.filter(entry => entry.id !== item.id))}
                              className="px-3 py-2 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-xs uppercase tracking-widest"
                            >
                              <Trash2 size={12} />
                              Удалить
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <LF label="ID (slug)"><input value={item.id} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, id: e.target.value } : entry))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" /></LF>
                          <LF label="Инициал"><input value={item.initial} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, initial: e.target.value.slice(0, 1).toUpperCase() } : entry))} className="w-full border border-gray-300 px-4 py-3" placeholder="А" /></LF>
                          <LF label="Имя (основное)"><input value={item.nameMain} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, nameMain: e.target.value } : entry))} className="w-full border border-gray-300 px-4 py-3" /></LF>
                          <LF label="Фамилия (акцент)"><input value={item.nameAccent} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, nameAccent: e.target.value } : entry))} className="w-full border border-gray-300 px-4 py-3" /></LF>
                          <LF label="Годы / период"><input value={item.years} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, years: e.target.value } : entry))} className="w-full border border-gray-300 px-4 py-3" placeholder="1982–" /></LF>
                          <LF label="Известен как"><input value={item.knownFor} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, knownFor: e.target.value } : entry))} className="w-full border border-gray-300 px-4 py-3" /></LF>
                        </div>
                        <div className="mt-5">
                          <ImageField
                            label="Фото автора"
                            value={item.imageUrl}
                            onChange={value => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, imageUrl: value } : entry))}
                          />
                        </div>
                        <LF label="Биография" className="mt-5">
                          <AutoTextarea value={item.bio}
                            onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, bio: (e.target as HTMLTextAreaElement).value } : entry))}
                            rows={4} countType="words"
                            className="border border-gray-300 px-4 py-3" placeholder="Биография" />
                        </LF>
                        <LF label="Теги (через запятую)" className="mt-5">
                          <input value={item.tags.join(', ')} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) } : entry))} className="w-full border border-gray-300 px-4 py-3" placeholder="fiction, berlin, contemporary" />
                        </LF>
                      </div>
                    ))}
                  </div>
            </section>
          </div>
        ) : null}

        {database && activeTab === 'about' ? (() => {
          const aboutSections: { label: string; fields: ContentField[] }[] = [
            {
              label: 'Шапка страницы',
              fields: [
                { key: 'static.about.title', label: 'Заголовок страницы', type: 'text' },
                { key: 'static.about.subtitle', label: 'Подзаголовок страницы', type: 'textarea' },
              ],
            },
            {
              label: 'Миссия и фото',
              fields: [
                { key: 'static.about.mission', label: 'Заголовок миссии', type: 'text' },
                { key: 'static.about.p1', label: 'Текст абзац 1', type: 'textarea' },
                { key: 'static.about.p2', label: 'Текст абзац 2', type: 'textarea' },
                { key: 'static.about.mission_image', label: 'Фото миссии', type: 'text' },
              ],
            },
            {
              label: 'Статистика',
              fields: [
                { key: 'static.about.stat1', label: 'Подпись стат. 1', type: 'text' },
                { key: 'static.about.stat2', label: 'Подпись стат. 2', type: 'text' },
              ],
            },
            {
              label: 'Команда',
              fields: [
                { key: 'static.about.team', label: 'Заголовок «Команда»', type: 'text' },
                { key: 'static.about.role1', label: 'Роль 1', type: 'text' },
                { key: 'static.about.role2', label: 'Роль 2', type: 'text' },
                { key: 'static.about.role3', label: 'Роль 3', type: 'text' },
              ],
            },
          ];
          const allAboutFields = aboutSections.flatMap(s => s.fields);
          const handleSaveAll = async () => {
            startSave('about:all', `Сохранение (1 / ${allAboutFields.length})…`);
            const errors: string[] = [];
            let lastOverrides: TranslationOverrides | null = null;
            for (let i = 0; i < allAboutFields.length; i++) {
              const field = allAboutFields[i];
              advancePhase(`${field.label} (${i + 1} / ${allAboutFields.length})`);
              try {
                const raw = copyDrafts[field.key] ?? '';
                const parsed = field.type === 'json' ? parseJsonField(raw) : raw;
                lastOverrides = await api.setTranslationValue(selectedLanguage, field.key, parsed);
              } catch {
                errors.push(field.label);
              }
            }
            if (lastOverrides) {
              advancePhase('Обновление контента…');
              setOverrides(lastOverrides);
              await reloadContent();
            }
            if (errors.length === 0) {
              finishSave(`«О нас» сохранено — ${allAboutFields.length} полей` + (selectedLanguage === 'ru' ? ' · EN/DE запустится автоматически' : ''));
            } else {
              failSave();
              showToast(`Ошибки при сохранении: ${errors.join(', ')}`, 'error');
            }
          };
          return (
            <div className="space-y-8">
              <div className="bg-white border border-primary/10 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-serif">О нас</h2>
                  <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-widest">ampublishing.org/about · язык: {selectedLanguage.toUpperCase()}</p>
                </div>
                <div className="flex gap-3 items-center">
                  <a href="https://ampublishing.org/about" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-xs uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-50">
                    Preview ↗
                  </a>
                  <button
                    onClick={handleSaveAll}
                    className="px-5 py-3 text-xs uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                  >
                    {savingKey ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Сохранить всё
                  </button>
                </div>
              </div>

              {aboutSections.map(section => (
                <section key={section.label} className="bg-white border border-primary/10 shadow-sm">
                  <div className="px-6 py-4 border-b border-primary/10 bg-[#F8F8F5]">
                    <h3 className="font-mono text-xs uppercase tracking-[0.22em] text-gray-500 font-bold">{section.label}</h3>
                  </div>
                  <div className="p-6 grid grid-cols-1 gap-5">
                    {section.fields.map(field => (
                      <div key={field.key} className="border border-gray-100 p-5 bg-[#FAFAF8]">
                        <div className="flex flex-wrap justify-between items-start mb-3 gap-y-2 gap-x-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm">{field.label}</p>
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-400 mt-0.5 break-all">{field.key}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleResetTranslationField(field)}
                              className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-100"
                            >
                              Сбросить
                            </button>
                            <button
                              onClick={() => handleSaveTranslationField(field)}
                              className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-1.5"
                            >
                              {savingKey === field.key ? <Loader2 size={11} className="animate-spin" /> : null}
                              Сохранить
                            </button>
                          </div>
                        </div>
                        {field.key === 'static.about.mission_image' ? (
                          <ImageField
                            label={field.label}
                            value={copyDrafts[field.key] || ''}
                            onChange={value => setCopyDrafts(prev => ({ ...prev, [field.key]: value }))}
                            filenamePrefix="about-photo"
                          />
                        ) : field.type === 'textarea' ? (
                          <AutoTextarea
                            value={copyDrafts[field.key] || ''}
                            onChange={e => setCopyDrafts(prev => ({ ...prev, [field.key]: (e.target as HTMLTextAreaElement).value }))}
                            rows={4}
                            countType="words"
                            className="w-full border border-gray-300 px-4 py-3 bg-white outline-none focus:border-primary text-sm"
                          />
                        ) : (
                          <input
                            value={copyDrafts[field.key] || ''}
                            onChange={e => setCopyDrafts(prev => ({ ...prev, [field.key]: e.target.value }))}
                            className="w-full border border-gray-300 px-4 py-3 bg-white outline-none focus:border-primary text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          );
        })() : null}

        {activeTab === 'site' && siteDraft ? (
          <section className="bg-white border border-primary/10 p-6 md:p-8 space-y-10">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-3xl font-serif">Сайт, Шапка и Футер</h3>
                <p className="mt-2 text-sm text-gray-500">Меню, соцсети, контакты и правовые ссылки в футере.</p>
              </div>
              <button onClick={handleSaveSiteSettings} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                {savingKey === 'site-settings' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Сохранить настройки
              </button>
            </div>

            {/* Brand */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-4">Бренд</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Название (футер)</label>
                  <input value={siteDraft.brand.name} onChange={e => setSiteDraft(prev => prev ? { ...prev, brand: { ...prev.brand, name: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Краткое название (шапка)</label>
                  <input value={siteDraft.brand.short} onChange={e => setSiteDraft(prev => prev ? { ...prev, brand: { ...prev.brand, short: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-4">Контакты (в футере)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Email</label>
                  <input value={siteDraft.contacts.email} onChange={e => setSiteDraft(prev => prev ? { ...prev, contacts: { ...prev.contacts, email: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="hello@example.com" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Phone</label>
                  <input value={siteDraft.contacts.phone} onChange={e => setSiteDraft(prev => prev ? { ...prev, contacts: { ...prev.contacts, phone: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="+49 30 1234567" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Адрес строка 1</label>
                  <input value={siteDraft.contacts.addressLine1} onChange={e => setSiteDraft(prev => prev ? { ...prev, contacts: { ...prev.contacts, addressLine1: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Адрес строка 2</label>
                  <input value={siteDraft.contacts.addressLine2} onChange={e => setSiteDraft(prev => prev ? { ...prev, contacts: { ...prev.contacts, addressLine2: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                </div>
              </div>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-4">Соцсети (оставьте пустым, чтобы скрыть)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(['telegramUrl', 'instagramUrl', 'facebookUrl', 'youtubeUrl', 'twitterUrl'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">{field.replace('Url', '')}</label>
                    <input value={siteDraft.social[field]} onChange={e => setSiteDraft(prev => prev ? { ...prev, social: { ...prev.social, [field]: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
                  </div>
                ))}
              </div>
            </div>

            {/* Nav editors */}
            {(['headerNav', 'footerNav', 'footerLegal'] as const).map(section => {
              const titles: Record<typeof section, string> = {
                headerNav: 'Меню шапки',
                footerNav: 'Ссылки в футере',
                footerLegal: 'Нижняя строка футера (правовые)',
              };
              const items = siteDraft[section] || [];
              return (
                <div key={section}>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400">{titles[section]}</h4>
                    <button
                      onClick={() => updateSiteNav(section, list => ([...list, { id: `${section}-${Date.now()}`, labelKey: '', path: '/', enabled: true }]))}
                      className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                    >
                      <Plus size={12} /> Добавить ссылку
                    </button>
                  </div>
                  <div className="space-y-3 overflow-x-auto">
                    {items.map((item, idx) => (
                      <div key={item.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-3 items-center bg-[#F8F8F5] border border-gray-200 p-3 min-w-[600px]">
                        <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                          <input
                            type="checkbox"
                            checked={item.enabled !== false}
                            onChange={e => updateSiteNav(section, list => list.map(it => it.id === item.id ? { ...it, enabled: e.target.checked } : it))}
                          />
                          Вкл
                        </label>
                        <input
                          value={item.labelKey}
                          onChange={e => updateSiteNav(section, list => list.map(it => it.id === item.id ? { ...it, labelKey: e.target.value } : it))}
                          className="border border-gray-300 px-3 py-2 font-mono text-xs"
                          placeholder="ключ перевода (напр. nav.catalog)"
                        />
                        <input
                          value={item.path}
                          onChange={e => updateSiteNav(section, list => list.map(it => it.id === item.id ? { ...it, path: e.target.value } : it))}
                          className="border border-gray-300 px-3 py-2 font-mono text-xs"
                          placeholder="/path"
                        />
                        <button
                          disabled={idx === 0}
                          onClick={() => updateSiteNav(section, list => {
                            const next = [...list];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            return next;
                          })}
                          className="px-2 py-2 border border-gray-300 hover:bg-gray-100 disabled:opacity-30"
                          title="Вверх"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          disabled={idx === items.length - 1}
                          onClick={() => updateSiteNav(section, list => {
                            const next = [...list];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            return next;
                          })}
                          className="px-2 py-2 border border-gray-300 hover:bg-gray-100 disabled:opacity-30"
                          title="Вниз"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() => updateSiteNav(section, list => list.filter(it => it.id !== item.id))}
                          className="px-2 py-2 border border-red-300 text-red-600 hover:bg-red-50"
                          title="Удалить"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {items.length === 0 ? <p className="text-xs text-gray-400 font-mono">Нет элементов.</p> : null}
                  </div>
                </div>
              );
            })}

            {/* Newsletter toggle */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-4">Блок подписки в футере</h4>
              <label className="flex items-center gap-3 border border-gray-200 px-4 py-4 max-w-md">
                <input
                  type="checkbox"
                  checked={siteDraft.showNewsletter}
                  onChange={e => setSiteDraft(prev => prev ? { ...prev, showNewsletter: e.target.checked } : prev)}
                />
                <span className="text-sm">Показывать блок «Подпишитесь на новости» в футере</span>
              </label>
            </div>

            {/* Admin password setup */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-1">Пароль администратора</h4>
              <p className="text-xs text-gray-500 mb-4">Установите или смените пароль для входа в /admin.</p>
              <form onSubmit={handleSetPassword} className="max-w-md space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-1">Новый пароль</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="мин. 8 символов" autoComplete="new-password" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-1">Подтвердите пароль</label>
                  <input type="password" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} minLength={8} required className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="повторите пароль" autoComplete="new-password" />
                </div>
                <button type="submit" disabled={savingPassword} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                  {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Сохранить пароль
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {activeTab === 'payments' ? (
          <section className="bg-white border border-primary/10 p-6 md:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-3xl font-serif">Оплата и счета</h3>
                <p className="mt-2 text-sm text-gray-500">Реквизиты для оплаты, которые видят покупатели.</p>
              </div>
              <button onClick={handleSavePaymentSettings} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                {savingKey === 'payment-settings' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Сохранить настройки оплаты
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <LF label="Получатель / название">
                <input value={paymentSettings.recipientName} onChange={e => setPaymentSettings(prev => ({ ...prev, recipientName: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="Префикс счёта (напр. AM → AM-0001)">
                <input value={paymentSettings.invoicePrefix} onChange={e => setPaymentSettings(prev => ({ ...prev, invoicePrefix: e.target.value.toUpperCase() }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Ссылка для оплаты Visa">
                <input value={paymentSettings.visaPaymentUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, visaPaymentUrl: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
              </LF>
              <LF label="Ссылка для оплаты Mastercard">
                <input value={paymentSettings.mastercardPaymentUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, mastercardPaymentUrl: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
              </LF>
              <LF label="Владелец карты (Visa/MC)">
                <input value={paymentSettings.cardholder} onChange={e => setPaymentSettings(prev => ({ ...prev, cardholder: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="Номер карты (Visa/MC)">
                <input value={paymentSettings.cardNumber} onChange={e => setPaymentSettings(prev => ({ ...prev, cardNumber: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Название банка">
                <input value={paymentSettings.bankName} onChange={e => setPaymentSettings(prev => ({ ...prev, bankName: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="IBAN / номер счёта">
                <input value={paymentSettings.iban} onChange={e => setPaymentSettings(prev => ({ ...prev, iban: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" />
              </LF>
              <LF label="Владелец карты МИР">
                <input value={paymentSettings.mirCardholder} onChange={e => setPaymentSettings(prev => ({ ...prev, mirCardholder: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="Номер карты МИР">
                <input value={paymentSettings.mirCardNumber} onChange={e => setPaymentSettings(prev => ({ ...prev, mirCardNumber: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Банк МИР" className="md:col-span-2">
                <input value={paymentSettings.mirBankName} onChange={e => setPaymentSettings(prev => ({ ...prev, mirBankName: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="WhatsApp (международный формат, напр. +49…)">
                <input value={paymentSettings.whatsappNumber} onChange={e => setPaymentSettings(prev => ({ ...prev, whatsappNumber: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Telegram username (без @)">
                <input value={paymentSettings.telegramUsername} onChange={e => setPaymentSettings(prev => ({ ...prev, telegramUsername: e.target.value.replace(/^@/, '') }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Контактный email" className="md:col-span-2">
                <input type="email" value={paymentSettings.contactEmail} onChange={e => setPaymentSettings(prev => ({ ...prev, contactEmail: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="Название вебхука">
                <input value={paymentSettings.webhookLabel} onChange={e => setPaymentSettings(prev => ({ ...prev, webhookLabel: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="URL вебхука (Make / n8n / Telegram)" className="md:col-span-2">
                <input value={paymentSettings.webhookUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, webhookUrl: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
              </LF>
            </div>

            <LF label="Примечание об оплате для покупателя">
              <AutoTextarea value={paymentSettings.paymentNote}
                onChange={e => setPaymentSettings(prev => ({ ...prev, paymentNote: (e.target as HTMLTextAreaElement).value }))}
                rows={4} countType="chars"
                className="border border-gray-300 px-4 py-3" />
            </LF>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 border border-gray-200 px-4 py-4">
                <input type="checkbox" checked={paymentSettings.notifyOnOrderCreated} onChange={e => setPaymentSettings(prev => ({ ...prev, notifyOnOrderCreated: e.target.checked }))} />
                <span className="text-sm">Отправлять вебхук при новом заказе</span>
              </label>
              <label className="flex items-center gap-3 border border-gray-200 px-4 py-4">
                <input type="checkbox" checked={paymentSettings.notifyOnPaymentConfirmed} onChange={e => setPaymentSettings(prev => ({ ...prev, notifyOnPaymentConfirmed: e.target.checked }))} />
                <span className="text-sm">Отправлять вебхук при подтверждении оплаты</span>
              </label>
            </div>

            <div className="border border-primary/10 bg-[#F8F8F5] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400 mb-4">Рекомендуемый процесс</p>
              <div className="space-y-3 text-sm text-gray-700">
                <p>1. Покупатель оформляет заказ, выбрав «Visa», «Mastercard», «Счёт» или «МИР».</p>
                <p>2. Заказ создаётся немедленно и отправляется на вебхук.</p>
                <p>3. Для Visa / Mastercard покупатель переходит по внешней ссылке для оплаты.</p>
                <p>4. Для Счёта / МИР покупатель платит вручную и присылает подтверждение в WhatsApp, Telegram или email.</p>
                <p>5. Вы подтверждаете оплату на вкладке «Заказы», меняя «статус оплаты» на «оплачен».</p>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === 'status' ? <StatusPanel /> : null}

        {activeTab === 'orders' ? (() => {
          const filteredOrders = orders.filter(o => {
            const q = orderSearch.toLowerCase();
            const matchQ = !q || o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.email.toLowerCase().includes(q);
            const matchStatus = orderStatusFilter === 'all' || o.status === orderStatusFilter;
            const matchPayment = orderPaymentFilter === 'all' || o.paymentStatus === orderPaymentFilter;
            return matchQ && matchStatus && matchPayment;
          });
          const paidRevenue = filteredOrders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);
          return (
          <section className="bg-white border border-primary/10 overflow-hidden">
            <div className="p-6 border-b border-primary/10">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                <h3 className="text-3xl font-serif">Заказы</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={refreshOrders} className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
                    <RefreshCw size={14} />
                    Обновить
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await contentStore.loadOrdersFromGitHub();
                        refreshOrders();
                        showToast('Заказы загружены с GitHub', 'success');
                      } catch (e) {
                        showToast('Ошибка загрузки с GitHub', 'error');
                      }
                    }}
                    className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download size={14} />
                    Загрузить с GitHub
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await contentStore.syncOrdersToGitHub();
                        showToast('Заказы синхронизированы с GitHub', 'success');
                      } catch (e) {
                        showToast('Ошибка синхронизации — проверьте PAT', 'error');
                      }
                    }}
                    className="px-4 py-3 text-xs uppercase tracking-widest border border-primary bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Синхронизировать с GitHub
                  </button>
                  <button onClick={() => exportOrdersCSV(filteredOrders)} className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
                    <Download size={14} />
                    CSV
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Поиск по ID, имени или email…" className="flex-1 border border-gray-300 px-4 py-2 text-sm" />
                <div className="flex gap-1 flex-wrap">
                  {['all','pending','processing','shipped','delivered','cancelled'].map(s => (
                    <button key={s} onClick={() => setOrderStatusFilter(s)} className={`px-3 py-2 text-[10px] uppercase tracking-widest border ${orderStatusFilter === s ? 'bg-primary text-white border-primary' : 'border-gray-200 hover:bg-gray-50'}`}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap">
                  {['all','pending','paid','failed','refunded'].map(s => (
                    <button key={s} onClick={() => setOrderPaymentFilter(s)} className={`px-3 py-2 text-[10px] uppercase tracking-widest border ${orderPaymentFilter === s ? 'bg-accent text-primary border-accent' : 'border-gray-200 hover:bg-gray-50'}`}>{s === 'all' ? '€ all' : s}</button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex gap-6 text-sm text-gray-500">
                <span><span className="font-bold text-primary">{filteredOrders.length}</span> заказов</span>
                {paidRevenue > 0 && <span>Оплачено: <span className="font-bold text-green-700">€{paidRevenue.toFixed(2)}</span></span>}
              </div>
            </div>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredOrders.map(order => (
                <div key={order.id + '-card'} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm">{order.id}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{new Date(order.date).toLocaleString()}</div>
                      <div className="text-sm font-medium mt-1">{order.customer.name}</div>
                      <div className="text-xs text-gray-400">{order.customer.email}</div>
                      {order.customer.phone && <div className="text-xs text-gray-400">{order.customer.phone}</div>}
                      {order.customer.location && <div className="text-xs text-gray-400">{order.customer.location}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold">{order.total.toFixed(2)} {order.currency}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">{order.paymentMethod || 'card'}</div>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-[9px] uppercase tracking-widest border ${
                        order.paymentStatus === 'paid' ? 'border-green-500 text-green-700' :
                        order.paymentStatus === 'failed' ? 'border-red-400 text-red-600' :
                        'border-amber-400 text-amber-700'
                      }`}>{order.paymentStatus}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 space-y-0.5">
                    {order.items.map(item => (
                      <div key={item.variantId}>{item.quantity}× {item.bookTitle}</div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <select
                      value={order.status}
                      onChange={e => handleStatusChange(order.id, e.target.value as OrderStatus)}
                      className="flex-1 min-w-[120px] border border-gray-300 px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="pending">Новый</option>
                      <option value="processing">В работе</option>
                      <option value="shipped">Отправлен</option>
                      <option value="delivered">Доставлен</option>
                      <option value="cancelled">Отменён</option>
                    </select>
                    <select
                      value={order.paymentStatus}
                      onChange={e => handlePaymentStatusChange(order.id, e.target.value as PaymentStatus)}
                      className="flex-1 min-w-[120px] border border-gray-300 px-2 py-1.5 text-xs bg-white"
                    >
                      <option value="pending">Ожидает оплаты</option>
                      <option value="paid">Оплачен</option>
                      <option value="failed">Отклонён</option>
                      <option value="refunded">Возврат</option>
                    </select>
                    {(savingKey === `order:${order.id}` || savingKey === `payment:${order.id}`) && (
                      <Loader2 size={14} className="animate-spin text-primary flex-shrink-0" />
                    )}
                  </div>
                  {order.diagnostics && (
                    <details className="text-xs border-t border-gray-100 pt-2">
                      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-gray-400">
                        Диагностика
                      </summary>
                      <div className="mt-2 font-mono text-[10px] text-gray-500 space-y-0.5">
                        {order.diagnostics.ip && <div>ip: {order.diagnostics.ip}</div>}
                        {order.diagnostics.ipCountry && <div>country: {order.diagnostics.ipCountry}</div>}
                        {order.diagnostics.userAgent && <div className="break-all">ua: {order.diagnostics.userAgent}</div>}
                      </div>
                    </details>
                  )}
                </div>
              ))}
              {filteredOrders.length === 0 && (
                <p className="p-6 text-sm text-gray-400">Нет заказов.</p>
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F4F4F0]">
                  <tr className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    <th className="p-4">Заказ</th>
                    <th className="p-4">Покупатель</th>
                    <th className="p-4">Товары</th>
                    <th className="p-4">Сумма</th>
                    <th className="p-4">Статус</th>
                    <th className="p-4">Изменить</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <React.Fragment key={order.id}>
                    <tr className="border-t border-gray-100 align-top">
                      <td className="p-4">
                        <div className="font-bold flex items-center gap-1">
                          {order.id}
                          <button onClick={() => navigator.clipboard.writeText(order.id)} className="text-gray-300 hover:text-gray-600 flex-shrink-0" title="Копировать ID"><Copy size={10} /></button>
                        </div>
                        <div className="text-xs text-gray-400">{new Date(order.date).toLocaleString()}</div>
                      </td>
                      <td className="p-4">
                        <div>{order.customer.name}</div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <span>{order.customer.email}</span>
                          <button onClick={() => navigator.clipboard.writeText(order.customer.email)} className="text-gray-300 hover:text-gray-600 flex-shrink-0" title="Копировать email"><Copy size={10} /></button>
                        </div>
                        {order.customer.phone ? <div className="text-xs text-gray-400">{order.customer.phone}</div> : null}
                        <div className="text-xs text-gray-400">{order.customer.location}</div>
                        {order.customer.addressLine ? <div className="text-xs text-gray-400 mt-1">{order.customer.addressLine}{order.customer.zip ? `, ${order.customer.zip}` : ''}</div> : null}
                      </td>
                      <td className="p-4 text-sm">
                        {order.items.map(item => (
                          <div key={item.variantId}>{item.quantity}x {item.bookTitle}</div>
                        ))}
                      </td>
                      <td className="p-4 font-bold">{order.total.toFixed(2)} {order.currency}</td>
                      <td className="p-4">
                        <div className="space-y-2">
                          <span className="inline-flex px-3 py-1 text-[10px] uppercase tracking-[0.18em] bg-[#F4F4F0] border border-gray-200">
                            {order.paymentMethod || 'card'}
                          </span>
                          <div className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                            Оплата: <span className="text-primary">{order.paymentStatus}</span>
                          </div>
                          {order.paymentReference ? <div className="text-[10px] font-mono text-gray-400">{order.paymentReference}</div> : null}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col items-start gap-3">
                          <select
                            value={order.status}
                            onChange={e => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            className="border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="pending">Новый</option>
                            <option value="processing">В работе</option>
                            <option value="shipped">Отправлен</option>
                            <option value="delivered">Доставлен</option>
                            <option value="cancelled">Отменён</option>
                          </select>
                          <select
                            value={order.paymentStatus}
                            onChange={e => handlePaymentStatusChange(order.id, e.target.value as PaymentStatus)}
                            className="border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="pending">Ожидает оплаты</option>
                            <option value="paid">Оплачен</option>
                            <option value="failed">Отклонён</option>
                            <option value="refunded">Возврат</option>
                          </select>
                          {(savingKey === `order:${order.id}` || savingKey === `payment:${order.id}`) && <Loader2 size={14} className="animate-spin" />}
                        </div>
                      </td>
                    </tr>
                    {order.diagnostics ? (
                      <tr className="border-t border-dashed border-gray-100 bg-[#F8F8F4]">
                        <td colSpan={6} className="p-4">
                          <details className="text-xs">
                            <summary className="cursor-pointer font-mono uppercase tracking-[0.2em] text-gray-500 hover:text-primary">
                              Диагностика · {order.diagnostics.ip || 'IP n/a'}
                              {order.diagnostics.ipCountry ? ` · ${order.diagnostics.ipCountry}` : ''}
                              {order.diagnostics.timezone ? ` · ${order.diagnostics.timezone}` : ''}
                            </summary>
                            <div className="grid md:grid-cols-3 gap-x-6 gap-y-1 mt-3 text-[11px] font-mono text-gray-600">
                              {order.diagnostics.ip ? <div><span className="text-gray-400">ip:</span> {order.diagnostics.ip}</div> : null}
                              {order.diagnostics.ipCity || order.diagnostics.ipRegion || order.diagnostics.ipCountry ? <div><span className="text-gray-400">ip-geo:</span> {[order.diagnostics.ipCity, order.diagnostics.ipRegion, order.diagnostics.ipCountry].filter(Boolean).join(', ')}</div> : null}
                              {order.diagnostics.ipOrg ? <div><span className="text-gray-400">ip-org:</span> {order.diagnostics.ipOrg}</div> : null}
                              {order.diagnostics.timezone ? <div><span className="text-gray-400">tz:</span> {order.diagnostics.timezone} ({order.diagnostics.timezoneOffset ?? '?'}m)</div> : null}
                              {order.diagnostics.language ? <div><span className="text-gray-400">lang:</span> {order.diagnostics.language}</div> : null}
                              {order.diagnostics.regionId ? <div><span className="text-gray-400">region:</span> {order.diagnostics.regionId}</div> : null}
                              {order.diagnostics.storeLanguage ? <div><span className="text-gray-400">store-lang:</span> {order.diagnostics.storeLanguage}</div> : null}
                              {order.diagnostics.platform ? <div><span className="text-gray-400">platform:</span> {order.diagnostics.platform}</div> : null}
                              {order.diagnostics.screen ? <div><span className="text-gray-400">screen:</span> {order.diagnostics.screen}</div> : null}
                              {order.diagnostics.viewport ? <div><span className="text-gray-400">viewport:</span> {order.diagnostics.viewport}</div> : null}
                              {order.diagnostics.devicePixelRatio ? <div><span className="text-gray-400">dpr:</span> {order.diagnostics.devicePixelRatio}</div> : null}
                              {order.diagnostics.referer ? <div className="md:col-span-3 break-all"><span className="text-gray-400">referer:</span> {order.diagnostics.referer}</div> : null}
                              {order.diagnostics.pageUrl ? <div className="md:col-span-3 break-all"><span className="text-gray-400">url:</span> {order.diagnostics.pageUrl}</div> : null}
                              {order.diagnostics.userAgent ? <div className="md:col-span-3 break-all"><span className="text-gray-400">ua:</span> {order.diagnostics.userAgent}</div> : null}
                            </div>
                          </details>
                        </td>
                      </tr>
                    ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          );
        })() : null}

        {/* ── Radio section ─────────────────────────────────────────────── */}
        {activeTab === 'radio' && (
          <section className="space-y-6 max-w-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-3xl mb-1">Радио</h2>
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Анонсы · Чат · Закрепы</p>
              </div>
              {radioAuthed && (
                <button onClick={() => { clearRadioAdminToken(); setRadioAuthed(false); }}
                  className="font-mono text-[10px] uppercase tracking-widest border border-gray-200 px-3 py-2 hover:bg-gray-100 transition-colors flex items-center gap-2">
                  <LogOut size={13} /> Выйти
                </button>
              )}
            </div>

            {radioFlash && (
              <div className={`px-4 py-2.5 font-mono text-[11px] border ${radioFlashErr ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                {radioFlash}
              </div>
            )}

            {!radioAuthed ? (
              <form onSubmit={handleRadioLogin} className="bg-white border border-primary/10 p-6 space-y-4 max-w-sm">
                <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400">Пароль радио-администратора</p>
                <input type="password" value={radioPassword} onChange={e => setRadioPassword(e.target.value)}
                  placeholder="Пароль…" autoFocus
                  className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary transition-colors" />
                {radioLoginErr && <p className="text-xs text-red-500 font-mono">{radioLoginErr}</p>}
                <button type="submit" disabled={radioLoginBusy || !radioPassword}
                  className="w-full bg-primary text-white font-mono text-[10px] uppercase tracking-widest py-3 hover:bg-accent hover:text-primary transition-colors disabled:opacity-40">
                  {radioLoginBusy ? '…' : 'Войти'}
                </button>
              </form>
            ) : (
              <>
                {/* Sub-tabs */}
                <div className="flex border border-primary/15">
                  {([['config', 'Оформление'], ['announce', 'Новый анонс'], ['pins', 'Закрепы'], ['messages', 'Сообщения'], ['chat', 'Чат']] as const).map(([t, label]) => (
                    <button key={t} onClick={() => setRadioTab(t)}
                      className={`flex-1 py-2.5 font-mono text-[9px] uppercase tracking-widest transition-colors border-r border-primary/15 last:border-r-0 ${radioTab === t ? 'bg-primary text-white' : 'text-gray-400 hover:text-primary hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="bg-white border border-primary/10 p-6">

                  {/* Configurator */}
                  {radioTab === 'config' && <RadioConfigForm />}

                  {/* Announce */}
                  {radioTab === 'announce' && (
                    <form onSubmit={handleRadioAnnounce} className="space-y-5">
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-2">Тип публикации</p>
                        <div className="flex gap-0">
                          {(['announcement', 'podcast'] as const).map(t => (
                            <button key={t} type="button" onClick={() => setAType(t)}
                              className={`flex-1 py-2.5 font-mono text-[10px] uppercase tracking-widest border transition-colors ${aType === t ? 'bg-primary text-white border-primary' : 'border-gray-200 text-gray-400 hover:border-primary hover:text-primary'}`}>
                              {t === 'announcement' ? '📢 Анонс' : '🎙 Подкаст'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {[
                        { label: 'Заголовок', val: aTitle, set: setATitle, ph: 'Заголовок публикации…', req: true },
                        { label: 'Текст / подпись', val: aText, set: setAText, ph: 'Текст анонса или описание эпизода…', textarea: true },
                        { label: 'Краткое описание', val: aDesc, set: setADesc, ph: 'Одно предложение…' },
                        { label: 'Ссылка', val: aUrl, set: setAUrl, ph: 'https://…', type: 'url' },
                        { label: 'Обложка (URL)', val: aImage, set: setAImage, ph: 'https://…/cover.jpg' },
                      ].map(({ label, val, set, ph, textarea, type, req }) => (
                        <div key={label}>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400 mb-1.5">
                            {label}{req && <span className="text-red-400 ml-1">*</span>}
                          </p>
                          {textarea
                            ? <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph} rows={3}
                                className="w-full border-b border-gray-200 pb-1.5 text-sm outline-none placeholder:text-gray-300 focus:border-primary transition-colors resize-none font-sans" />
                            : <input value={val} onChange={e => set(e.target.value)} placeholder={ph} type={type || 'text'}
                                className="w-full border-b border-gray-200 pb-1.5 text-sm outline-none placeholder:text-gray-300 focus:border-primary transition-colors font-sans" />
                          }
                          {label === 'Обложка (URL)' && val && (
                            <img src={val} alt="" className="mt-2 h-24 w-full object-cover border border-gray-100"
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          )}
                        </div>
                      ))}

                      <label className="flex items-center gap-3 cursor-pointer" onClick={() => setAPinned(p => !p)}>
                        <div className={`w-8 h-4 relative transition-colors flex-shrink-0 ${aPinned ? 'bg-primary' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-3 h-3 bg-white transition-transform ${aPinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-gray-500">Закрепить после публикации</span>
                      </label>

                      <button type="submit" disabled={radioBusy || (!aTitle && !aText)}
                        className="w-full bg-primary text-white font-mono text-[10px] uppercase tracking-widest py-3 hover:bg-accent hover:text-primary transition-colors disabled:opacity-40">
                        {radioBusy ? '…' : aPinned ? 'Опубликовать и закрепить →' : 'Опубликовать →'}
                      </button>
                    </form>
                  )}

                  {/* Pins */}
                  {radioTab === 'pins' && (
                    <div className="space-y-4">
                      {radioPins.length === 0 && (
                        <p className="font-mono text-[10px] text-gray-400 text-center py-8">Нет закреплённых</p>
                      )}
                      {radioPins.map(m => (
                        <div key={m.id} className={`border-l-2 ${m.msg_type === 'podcast' ? 'border-accent' : 'border-primary'} pl-4 py-2 flex items-start justify-between gap-4`}>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-[8px] uppercase tracking-widest text-gray-400 mb-1">
                              {m.msg_type === 'podcast' ? '🎙 Подкаст' : '📢 Анонс'} · #{m.id}
                            </p>
                            {m.meta_title && <p className="font-serif text-base leading-tight mb-1">{m.meta_title}</p>}
                            {m.text && <p className="text-xs text-gray-500 line-clamp-2 mb-1">{m.text}</p>}
                            {m.meta_url && <p className="font-mono text-[9px] text-gray-300 truncate">{m.meta_url}</p>}
                          </div>
                          <button onClick={() => handleRadioUnpin(m.id)} disabled={radioBusy}
                            className="font-mono text-[9px] uppercase tracking-widest border border-gray-200 px-3 py-1.5 hover:bg-primary hover:text-white hover:border-primary transition-colors disabled:opacity-40 flex-shrink-0">
                            Открепить
                          </button>
                        </div>
                      ))}
                      {radioPins.length > 1 && (
                        <button onClick={handleRadioUnpinAll} disabled={radioBusy}
                          className="w-full font-mono text-[9px] uppercase tracking-widest border border-gray-200 py-2.5 text-gray-400 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 mt-2">
                          Открепить все
                        </button>
                      )}
                    </div>
                  )}

                  {/* Messages */}
                  {radioTab === 'messages' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between mb-4">
                        <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">{radioMessages.length} сообщений</p>
                        <button onClick={() => fetchRadioMessages().then(msgs => setRadioMessages(msgs.filter(m => !m.is_deleted)))}
                          className="font-mono text-[9px] uppercase tracking-widest text-gray-400 hover:text-primary transition-colors flex items-center gap-1">
                          <RefreshCw size={11} /> Обновить
                        </button>
                      </div>
                      {radioMessages.length === 0 && <p className="font-mono text-[10px] text-gray-400 text-center py-8">Нет сообщений</p>}
                      {[...radioMessages].reverse().map(m => (
                        <div key={m.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 group">
                          <div className="w-6 h-6 flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: m.color || '#040F1E' }}>
                            {m.nickname.slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="text-xs font-bold" style={{ color: m.color }}>{m.nickname}</span>
                              <span className="font-mono text-[9px] text-gray-300">{new Date(m.created_at.includes('T') ? m.created_at : m.created_at.replace(' ', 'T') + 'Z').toLocaleString('ru', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              {m.msg_type !== 'chat' && <span className="font-mono text-[8px] text-accent uppercase tracking-widest">{m.msg_type}</span>}
                            </div>
                            <p className="text-sm text-gray-600 break-words line-clamp-2">{m.meta_title || m.text}</p>
                          </div>
                          <button onClick={() => handleRadioDeleteMsg(m.id)} disabled={radioBusy}
                            className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[9px] text-red-400 hover:text-red-600 flex-shrink-0 p-1 mt-0.5">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chat */}
                  {radioTab === 'chat' && (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 font-mono">
                        Очистка помечает все чат-сообщения как удалённые. Анонсы и закрепы не затрагиваются.
                      </div>
                      <button onClick={handleRadioClearChat} disabled={radioBusy}
                        className="w-full border border-red-200 py-3 font-mono text-[10px] uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors disabled:opacity-40">
                        {radioBusy ? '…' : 'Очистить чат'}
                      </button>
                    </div>
                  )}

                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
