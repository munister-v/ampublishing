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
import { ServicesEditor } from './ServicesEditor';
import { IntegrationsPanel } from './IntegrationsPanel';
import { buildDhlTrackingUrl } from '../utils/dhl';
import { getLeadLog } from '../services/leads';
import { contentStore, WriteLogEntry } from '../services/contentStore';
import { FeaturedAuthor, ShowcaseAuthor, getAuthorShowcaseContent, getFeaturedAuthorContent } from '../services/authorShowcase';
import { translations } from '../translations';
import { toGenitiveRu } from '../utils/declension';
import { getShopifyPurchaseLink, isShopifyPurchaseLink, SHOPIFY_STORE_URL } from '../utils/purchaseLinks';
import { getBookPath } from '../utils/bookRoutes';
import { DEFAULT_BOOK_FORMAT, ensureBookVariants } from '../utils/bookVariants';
import { AboutLayoutSettings, AboutSectionId, Book, BookReview, BookTheme, BookVariant, Format, Language, LocalizedCatalogData, NavLinkConfig, NewsBlock, NewsBlockType, NewsItem, OrderStatus, PaymentSettings, PaymentStatus, SiteSettings, TranslationOverrides } from '../types';
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
  Store,
  BarChart3,
  Link2,
  CreditCard,
  CircleCheck,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Target,
  TrendingUp,
  CalendarDays,
} from 'lucide-react';

type AdminTab = 'command' | 'copy' | 'books' | 'news' | 'authors' | 'about' | 'services' | 'site' | 'payments' | 'integrations' | 'orders' | 'status' | 'radio';

const getBookEditorReadiness = (book: Book) => {
  const checks = [
    Boolean(book.title.trim()),
    Boolean(book.author.trim()),
    Boolean(book.coverUrl.trim()),
    Boolean(book.description.trim()),
    Boolean(getShopifyPurchaseLink(book)),
  ];
  return { complete: checks.filter(Boolean).length, total: checks.length };
};

const ADMIN_TAB_META: Record<AdminTab, { title: string; description: string }> = {
  command: { title: 'Обзор', description: 'Состояние каталога, контента и подключений Shopify.' },
  books: { title: 'Книги', description: 'Карточки витрины, обложки, форматы и ссылки на товары Shopify.' },
  news: { title: 'Мероприятия', description: 'Новости, события, анонсы и публикации издательства.' },
  authors: { title: 'Авторы', description: 'Страница авторов и редакционная подача участников каталога.' },
  radio: { title: 'Радио', description: 'Анонсы эфиров, сообщения, закрепления и настройки радио.' },
  copy: { title: 'Тексты сайта', description: 'Переводимые заголовки, подписи и системные тексты.' },
  about: { title: 'О нас', description: 'Содержание и визуальная структура страницы издательства.' },
  services: { title: 'Услуги', description: 'Направления работы, состав услуг и условия сотрудничества.' },
  site: { title: 'Навигация и футер', description: 'Меню, контакты, социальные ссылки и системные настройки.' },
  integrations: { title: 'Shopify и сервисы', description: 'Магазин, заявки и аналитика сайта.' },
  status: { title: 'Состояние сайта', description: 'Диагностика публикаций, API и последних операций.' },
  payments: { title: 'Оплата', description: 'Архивный раздел локальной оплаты.' },
  orders: { title: 'Заказы', description: 'Архивный раздел локальных заказов.' },
};
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

type PublishProbe = {
  status: 'idle' | 'checking' | 'live' | 'pending' | 'error';
  message: string;
  checkedAt?: string;
  details?: string[];
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
      { key: 'static.about.eyebrow', label: 'О нас — надзаголовок', type: 'text' },
      { key: 'static.about.mission', label: 'О нас — заголовок миссии', type: 'text' },
      { key: 'static.about.p1', label: 'О нас — текст 1', type: 'textarea' },
      { key: 'static.about.p2', label: 'О нас — текст 2', type: 'textarea' },
      { key: 'static.about.quote', label: 'О нас — редакционная цитата', type: 'textarea' },
      { key: 'static.about.stat1', label: 'О нас — подпись стат. 1', type: 'text' },
      { key: 'static.about.stat2', label: 'О нас — подпись стат. 2', type: 'text' },
      { key: 'static.about.stat1_value', label: 'О нас — значение стат. 1', type: 'text' },
      { key: 'static.about.stat1_text', label: 'О нас — пояснение стат. 1', type: 'text' },
      { key: 'static.about.stat2_value', label: 'О нас — значение стат. 2', type: 'text' },
      { key: 'static.about.stat2_text', label: 'О нас — пояснение стат. 2', type: 'text' },
      { key: 'static.about.mission_image', label: 'О нас — фото', type: 'text' },
      { key: 'static.about.team', label: 'О нас — заголовок команды', type: 'text' },
      { key: 'static.about.role1', label: 'О нас — роль 1', type: 'text' },
      { key: 'static.about.role2', label: 'О нас — роль 2', type: 'text' },
      { key: 'static.about.role3', label: 'О нас — роль 3', type: 'text' },
      { key: 'static.about.cta_title', label: 'О нас — заголовок CTA', type: 'text' },
      { key: 'static.about.cta_text', label: 'О нас — текст CTA', type: 'textarea' },
      { key: 'static.about.cta_button', label: 'О нас — кнопка CTA', type: 'text' },
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
  aliases: [],
  title: '',
  author: '',
  price: 0,
  coverUrl: '',
  badges: ['new', 'preorder'],
  type: 'publisher',
  isPreorder: true,
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
  variants: [{
    id: `sku-${Date.now()}`,
    format: 'paperback',
    language,
    price: 0,
    stock: 0,
    isbn: '',
  }],
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
  ],
});

const createNewsTemplate = (): NewsItem => ({
  id: `news-${Date.now()}`,
  date: new Date().toISOString().slice(0, 10),
  title: '',
  preview: '',
  category: 'Новости',
  imageAlt: '',
  featured: false,
  blocks: [],
});

const createNewsBlock = (type: NewsBlockType): NewsBlock => ({
  id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type,
  content: type === 'heading' ? 'Новый раздел' : type === 'quote' ? 'Цитата или важное наблюдение.' : type === 'image' ? '' : 'Новый абзац.',
  caption: '',
});

const blocksFromLegacyBody = (body: string): NewsBlock[] => body.split(/\n{2,}/).map(part => part.trim()).filter(Boolean)
  .map(content => ({ ...createNewsBlock('text'), content }));

const createPaymentSettingsTemplate = (): PaymentSettings => ({
  shopifyStoreUrl: '',
  shopifyAdminUrl: '',
  shopifyAnalyticsUrl: '',
  shopifySupportUrl: '',
  gaMeasurementId: '',
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

const asSafeExternalUrl = (value?: string) => {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
};

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

const isSafeBookSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

const createCopySlug = (book: Book) => {
  const base = slugify(book.title || book.id).replace(/-copy$/, '') || 'book';
  return `${base}-${Date.now().toString(36).slice(-5)}`;
};

const isValidHttpUrl = (value: string) => {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const getShopifyProductHandle = (value: string) => {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    const match = url.pathname.match(/^\/products\/([^/]+)/);
    return match?.[1] || '';
  } catch {
    return '';
  }
};

const isValidShopifyProductUrl = (value: string) => {
  if (!isValidHttpUrl(value)) return false;
  try {
    const url = new URL(value.trim());
    return url.hostname === 'shop.ampublishing.org' && Boolean(getShopifyProductHandle(value));
  } catch {
    return false;
  }
};

const normalizeShopifyProductUrl = (value: string) => {
  const handle = getShopifyProductHandle(value);
  return handle ? `${SHOPIFY_STORE_URL}products/${handle}` : value.trim();
};

const withShopifyPurchaseUrl = (book: Book, url: string): Book => {
  const links = [...(Array.isArray(book.purchaseLinks) ? book.purchaseLinks : [])];
  const index = links.findIndex(link => isShopifyPurchaseLink(link));
  const shopifyLink = { id: 'shopify', label: 'Shopify', url };
  if (index >= 0) links[index] = { ...links[index], ...shopifyLink };
  else links.unshift(shopifyLink);
  return { ...book, purchaseLinks: links };
};

const withPreorderStatus = (book: Book, enabled: boolean): Book => {
  const badges = new Set(book.badges || []);
  if (enabled) badges.add('preorder');
  else badges.delete('preorder');
  return { ...book, isPreorder: enabled, badges: Array.from(badges) as Book['badges'] };
};

const parseAliases = (value: string) =>
  value
    .split(/[\n,]+/)
    .map(item => slugify(item.trim()))
    .filter(Boolean);

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
    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.14em] text-primary/65">{label}</label>
    {children}
    {hint ? <p className="mt-2 text-xs leading-relaxed text-gray-500">{hint}</p> : null}
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
  const { logout, orders, refreshOrders, updateOrderStatus, reloadContent, showToast, setSiteSettings: setGlobalSiteSettings, setLanguage, reloadIntegrations, integrations } = useApp();
  const [activeTab, setActiveTab] = useState<AdminTab>('command');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('ru');
  const [database, setDatabase] = useState<Record<Language, LocalizedCatalogData> | null>(null);
  const [adminLoadError, setAdminLoadError] = useState('');
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
  const [storyCollapsed, setStoryCollapsed] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');
  const [bookSearch, setBookSearch] = useState('');
  const [newsSearch, setNewsSearch] = useState('');
  const [newsPreviewDevice, setNewsPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [bookSort, setBookSort] = useState<'default' | 'alpha' | 'stock'>('default');
  const [saveOpPhase, setSaveOpPhase] = useState('');
  const [savedFlash, setSavedFlash] = useState('');
  const [bookPublishProbe, setBookPublishProbe] = useState<PublishProbe>({
    status: 'idle',
    message: '',
  });
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Radio section state ──────────────────────────────────────────────────
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  useEffect(() => {
    setNewLeadsCount(getLeadLog().filter(lead => lead.status === 'new').length);
  }, [activeTab]);

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
    setAdminLoadError('');
    try {
      const db = await api.getContentDatabase();
      const [translationResult, paymentResult, siteResult] = await Promise.allSettled([
        api.getTranslationOverrides(),
        api.getPaymentSettings(),
        api.getSiteSettings(),
      ]);
      setDatabase(db);
      if (translationResult.status === 'fulfilled') setOverrides(translationResult.value);
      if (paymentResult.status === 'fulfilled') setPaymentSettings(paymentResult.value);
      if (siteResult.status === 'fulfilled') setSiteDraft(siteResult.value);
      if (!selectedBookId && db[selectedLanguage]?.books?.[0]) {
        setSelectedBookId(db[selectedLanguage].books[0].id);
      }
      if (!selectedNewsId && db[selectedLanguage]?.news?.[0]) {
        setSelectedNewsId(db[selectedLanguage].news[0].id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить данные админки';
      setAdminLoadError(message);
      showToast(message, 'error');
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
    if (!bookDraft.id.trim()) issues.push('ID / slug missing');
    if (bookDraft.id.trim() && !isSafeBookSlug(bookDraft.id)) issues.push('ID должен содержать только латиницу, цифры и дефисы');
    if (/-copy(?:-|$)/.test(bookDraft.id)) issues.push('ID с -copy запрещён: задайте нормальный публичный slug');
    (bookDraft.aliases || []).forEach(alias => {
      if (!isSafeBookSlug(alias)) issues.push(`Alias «${alias}» содержит недопустимые символы`);
      if (alias === bookDraft.id) issues.push(`Alias «${alias}» совпадает с основным ID`);
    });
    if (!bookDraft.title.trim()) issues.push('Title missing');
    if (!bookDraft.author.trim()) issues.push('Author missing');
    if (!bookDraft.coverUrl.trim()) issues.push('Cover image missing');
    if (bookDraft.coverUrl && !isValidHttpUrl(bookDraft.coverUrl)) issues.push('Cover image URL должен начинаться с http:// или https://');
    if (bookDraft.story?.featureImageUrl && !isValidHttpUrl(bookDraft.story.featureImageUrl)) issues.push('Story image URL должен начинаться с http:// или https://');
    if (bookDraft.story?.detailPageUrl && !isValidHttpUrl(bookDraft.story.detailPageUrl)) issues.push('Detail page URL должен начинаться с http:// или https://');
    (bookDraft.purchaseLinks || []).forEach(link => {
      if (link.url && !isValidHttpUrl(link.url)) issues.push(`Ссылка «${link.label || link.id}» должна начинаться с http:// или https://`);
    });
    const shopifyLink = getShopifyPurchaseLink(bookDraft);
    if (!shopifyLink) issues.push('Добавьте публичную ссылку товара Shopify');
    else if (!isValidShopifyProductUrl(shopifyLink.url)) issues.push('Shopify URL должен иметь вид https://shop.ampublishing.org/products/...');
    return issues;
  }, [bookDraft]);

  const newsRequiredErrors = useMemo(() => {
    if (!newsDraft) return [];
    const issues: string[] = [];
    if (!newsDraft.title.trim()) issues.push('News title missing');
    if (!newsDraft.preview.trim()) issues.push('News preview missing');
    return issues;
  }, [newsDraft]);

  const newsEditorialChecks = useMemo(() => {
    if (!newsDraft) return [];
    const source = newsDraft.blocks?.length ? newsDraft.blocks.map(block => block.content).join(' ') : (newsDraft.body || '');
    const words = source.trim().split(/\s+/).filter(Boolean).length;
    return [
      { label: 'Заголовок', ok: Boolean(newsDraft.title.trim()) },
      { label: 'Анонс', ok: Boolean(newsDraft.preview.trim()) },
      { label: 'Обложка', ok: Boolean(newsDraft.imageUrl?.trim()) },
      { label: words ? `${words} слов в тексте` : 'Текст', ok: words >= 30 },
      { label: 'Alt-подпись', ok: !newsDraft.imageUrl || Boolean(newsDraft.imageAlt?.trim()) },
    ];
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
  const activeShopifyLink = bookDraft ? getShopifyPurchaseLink(bookDraft) : null;
  const bookSetupChecks = useMemo(() => bookDraft ? [
    { label: 'Название и автор', ok: Boolean(bookDraft.title.trim() && bookDraft.author.trim()) },
    { label: 'Обложка', ok: Boolean(bookDraft.coverUrl.trim() && isValidHttpUrl(bookDraft.coverUrl)) },
    { label: 'Описание', ok: Boolean(bookDraft.description.trim()) },
    { label: 'Жанр', ok: bookDraft.genre.some(Boolean) },
    { label: 'Товар Shopify', ok: Boolean(activeShopifyLink && isValidShopifyProductUrl(activeShopifyLink.url)) },
  ] : [], [bookDraft, activeShopifyLink]);
  const completedBookSetupChecks = bookSetupChecks.filter(item => item.ok).length;
  const currentBookPublicPath = bookDraft ? getBookPath(bookDraft) : '';
  const currentBookPublicUrl = currentBookPublicPath && typeof window !== 'undefined'
    ? `${window.location.origin}${currentBookPublicPath}`
    : currentBookPublicPath;

  useEffect(() => {
    setBookPublishProbe({ status: 'idle', message: '' });
  }, [selectedBookId, selectedLanguage]);

  const probePublishedBook = useCallback(async (book: Book, lang: Language) => {
    const checkedAt = new Date().toLocaleTimeString();
    setBookPublishProbe({
      status: 'checking',
      message: 'Проверяю live JSON на сайте...',
      checkedAt,
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`/content/books.${lang}.json?probe=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const liveBooks = (await res.json()) as Book[];
      const liveBook = liveBooks.find(item => item.id === book.id);

      if (!liveBook) {
        setBookPublishProbe({
          status: 'pending',
          checkedAt,
          message: 'GitHub сохранил, но live-сайт пока не видит эту книгу. Обычно Pages догоняет за 30-90 секунд.',
          details: [`Жду ID: ${book.id}`],
        });
        return;
      }

      const mismatches = [
        liveBook.title !== book.title ? 'Название на live ещё старое' : '',
        liveBook.coverUrl !== book.coverUrl ? 'Обложка на live ещё старая' : '',
        liveBook.description !== book.description ? 'Описание на live ещё старое' : '',
        JSON.stringify(liveBook.purchaseLinks || []) !== JSON.stringify(book.purchaseLinks || []) ? 'Ссылки покупки на live ещё старые' : '',
      ].filter(Boolean);

      setBookPublishProbe({
        status: mismatches.length ? 'pending' : 'live',
        checkedAt,
        message: mismatches.length
          ? 'Сохранение прошло, но GitHub Pages/CDN пока отдаёт старую версию.'
          : 'Live-сайт уже отдаёт эту версию книги.',
        details: mismatches,
      });
    } catch (err) {
      setBookPublishProbe({
        status: 'error',
        checkedAt,
        message: err instanceof Error && err.name === 'AbortError'
          ? 'Live-проверка не ответила за 8 секунд. Сохранение могло пройти, проверьте статус Pages.'
          : 'Не удалось проверить live-сайт после сохранения.',
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

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
      if (bookRequiredErrors.length || Object.keys(bookJsonErrors).length) {
        showToast('Исправьте ошибки в карточке книги перед сохранением', 'error');
        return;
      }
      const parsedVariants = parseJsonField(bookJsonDrafts.variants);
      const parsedThemes = parseJsonField(bookJsonDrafts.themes);
      const parsedReviews = parseJsonField(bookJsonDrafts.reviews);
      const normalizedShopifyLink = getShopifyPurchaseLink(bookDraft);
      const normalizedDraft = withPreorderStatus(
        normalizedShopifyLink
          ? withShopifyPurchaseUrl(bookDraft, normalizeShopifyProductUrl(normalizedShopifyLink.url))
          : bookDraft,
        Boolean(bookDraft.isPreorder),
      );
      const nextBook = {
        ...normalizedDraft,
        genre: normalizedDraft.genre.filter(Boolean),
        variants: parsedVariants?.length ? parsedVariants : ensureBookVariants(normalizedDraft, selectedLanguage),
        story: {
          ...normalizedDraft.story!,
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
      advancePhase('Проверка live-сайта...');
      await probePublishedBook(nextBook, selectedLanguage);
      setBookDirty(false);
      finishSave('Книга «' + (bookDraft.title || bookDraft.id) + '» сохранена' + (selectedLanguage === 'ru' ? ' · EN/DE запустится автоматически' : ''));
    } catch {
      failSave();
      showToast('Не удалось сохранить книгу', 'error');
    }
  }, [bookDraft, bookJsonDrafts, bookJsonErrors, bookRequiredErrors, selectedLanguage, probePublishedBook, showToast]);

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

  const updateAboutLayout = (updater: (layout: AboutLayoutSettings) => AboutLayoutSettings) => {
    setSiteDraft(prev => prev ? { ...prev, aboutLayout: updater(prev.aboutLayout) } : prev);
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

  const handleTrackingSave = async (orderId: string, trackingNumber: string) => {
    try {
      setSavingKey(`tracking:${orderId}`);
      setSaveOpPhase('Номер посылки…');
      await api.updateOrderTracking(orderId, trackingNumber.trim());
      await refreshOrders();
      showToast(trackingNumber.trim() ? `Трек-номер для ${orderId} сохранён` : `Трек-номер для ${orderId} убран`);
    } catch {
      showToast('Не удалось сохранить трек-номер', 'error');
    } finally {
      setSavingKey(null);
      setSaveOpPhase('');
    }
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

  const books = database?.[selectedLanguage]?.books || [];
  const news = database?.[selectedLanguage]?.news || [];
  const currentTabMeta = ADMIN_TAB_META[activeTab];
  const activeEditorDirty = (activeTab === 'books' && bookDirty) || (activeTab === 'news' && newsDirty);
  const activeEditorHasErrors = activeTab === 'books'
    ? bookRequiredErrors.length > 0 || Object.keys(bookJsonErrors).length > 0
    : activeTab === 'news'
      ? newsRequiredErrors.length > 0
      : false;
  const normalizedBookSearch = bookSearch.trim().toLowerCase();
  const filteredAdminBooks = [...books]
    .filter(book => !normalizedBookSearch || book.title.toLowerCase().includes(normalizedBookSearch) || book.author.toLowerCase().includes(normalizedBookSearch))
    .sort((a, b) => bookSort === 'alpha' ? a.title.localeCompare(b.title) : bookSort === 'stock' ? a.stock - b.stock : 0);
  const normalizedNewsSearch = newsSearch.trim().toLowerCase();
  const filteredAdminNews = news.filter(item => !normalizedNewsSearch || item.title.toLowerCase().includes(normalizedNewsSearch));

  const confirmEditorLeave = () => !activeEditorDirty || window.confirm('Есть несохранённые изменения. Если перейти сейчас, они будут потеряны. Продолжить?');
  const changeAdminTab = (nextTab: AdminTab) => {
    if (nextTab !== activeTab && !confirmEditorLeave()) return;
    setActiveTab(nextTab);
    setSidebarOpen(false);
  };
  const changeAdminLanguage = (language: Language) => {
    if (language !== selectedLanguage && !confirmEditorLeave()) return;
    setSelectedLanguage(language);
    setSidebarOpen(false);
  };
  const selectAdminBook = (bookId: string) => {
    if (bookId === selectedBookId) return;
    if (bookDirty && !window.confirm('В книге есть несохранённые изменения. Если открыть другую карточку, они будут потеряны. Продолжить?')) return;
    setSelectedBookId(bookId);
    setBookDirty(false);
  };
  const startNewBook = () => {
    if (bookDirty && !window.confirm('В книге есть несохранённые изменения. Если создать новую карточку, они будут потеряны. Продолжить?')) return;
    const next = createBookTemplate(selectedLanguage);
    setSelectedBookId(next.id);
    skipBookDirtyRef.current = true;
    setBookDraft(next);
    setStoryCollapsed(true);
    setBookDirty(false);
  };
  const selectAdminNews = (newsId: string) => {
    if (newsId === selectedNewsId) return;
    if (newsDirty && !window.confirm('В материале есть несохранённые изменения. Если открыть другой материал, они будут потеряны. Продолжить?')) return;
    setSelectedNewsId(newsId);
    setNewsDirty(false);
  };
  const startNewNews = () => {
    if (newsDirty && !window.confirm('В материале есть несохранённые изменения. Если создать новый, они будут потеряны. Продолжить?')) return;
    const next = createNewsTemplate();
    setSelectedNewsId(next.id);
    skipNewsDirtyRef.current = true;
    setNewsDraft(next);
    setNewsDirty(false);
  };

  return (
    <div className="admin-ui min-h-screen bg-[#F4F4F0] flex flex-col md:flex-row text-primary md:h-screen md:overflow-hidden">
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
  fixed inset-y-0 left-0 z-40 w-full max-w-72 overflow-y-auto
  transition-transform duration-200 ease-in-out
  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
  md:sticky md:top-0 md:h-screen md:w-72 md:max-w-none md:flex-shrink-0 md:translate-x-0
  bg-primary text-white
`}>
        <div className="hidden md:block p-8 border-b border-white/10">
          <h2 className="font-serif text-3xl">AM Admin</h2>
          <p className="text-[10px] font-mono opacity-60 uppercase tracking-[0.24em] mt-2">Управление контентом</p>
        </div>

        <nav className="space-y-6 p-5" aria-label="Разделы админки">
          {([
            {
              label: 'Рабочий стол',
              items: [{ id: 'command', label: 'Обзор', icon: <Sparkles size={17} /> }],
            },
            {
              label: 'Контент',
              items: [
                { id: 'books', label: 'Книги', icon: <BookOpen size={17} /> },
                { id: 'news', label: 'Мероприятия', icon: <Newspaper size={17} /> },
                { id: 'authors', label: 'Авторы', icon: <Globe size={17} /> },
                { id: 'radio', label: 'Радио', icon: <Wifi size={17} /> },
              ],
            },
            {
              label: 'Сайт',
              items: [
                { id: 'copy', label: 'Тексты', icon: <FileText size={17} /> },
                { id: 'about', label: 'О нас', icon: <Info size={17} /> },
                { id: 'services', label: 'Услуги', icon: <Clipboard size={17} /> },
                { id: 'site', label: 'Навигация и футер', icon: <Layout size={17} /> },
              ],
            },
            {
              label: 'Система',
              items: [
                { id: 'integrations', label: 'Shopify и сервисы', icon: <GitBranch size={17} />, badge: newLeadsCount },
                { id: 'status', label: 'Состояние сайта', icon: <Activity size={17} /> },
              ],
            },
          ] as { label: string; items: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] }[]).map(group => (
            <div key={group.label}>
              <p className="mb-2 px-3 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">{group.label}</p>
              <div className="space-y-1">
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => changeAdminTab(item.id)}
                    aria-current={activeTab === item.id ? 'page' : undefined}
                    className={`flex min-h-[48px] w-full items-center gap-3 border-l-2 px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] transition-colors ${
                      activeTab === item.id
                        ? 'border-accent bg-white/10 text-white'
                        : 'border-transparent text-white/65 hover:border-white/30 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {Boolean(item.badge) && <span className="ml-auto min-w-[20px] bg-accent px-1.5 py-0.5 text-center text-[9px] font-bold text-primary">{item.badge}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-6 pb-6">
          <div className="bg-white/5 border border-white/10 p-4 mb-4">
            <p className="text-[10px] uppercase font-mono tracking-[0.22em] text-white/50 mb-3">Язык редактирования</p>
            <div className="grid grid-cols-3 gap-2">
              {(['ru', 'en', 'de'] as Language[]).map(lang => (
                <button
                  key={lang}
                  onClick={() => changeAdminLanguage(lang)}
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

      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden min-h-screen p-4 pb-28 md:h-screen md:p-8 md:pb-28 xl:p-10 xl:pb-28 scroll-panel">
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
        {!database && adminLoadError ? (
          <div className="h-full flex items-center justify-center p-4">
            <section className="w-full max-w-xl border border-red-200 bg-white p-8 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-600">Ошибка загрузки</p>
              <h1 className="mt-3 font-serif text-3xl">Данные админки недоступны</h1>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{adminLoadError}</p>
              <button onClick={loadAdminData} className="mt-6 min-h-[44px] bg-primary px-6 py-3 text-xs font-bold uppercase tracking-widest text-white">Повторить загрузку</button>
            </section>
          </div>
        ) : !database ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" />
          </div>
        ) : null}

        {database ? (
          <header className="mb-6 border border-primary/10 bg-white p-4 md:p-6" aria-labelledby="admin-section-title">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-primary px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-white">{selectedLanguage.toUpperCase()}</span>
                  {activeTab === 'books' || activeTab === 'news' ? (
                    activeEditorDirty ? (
                      <span className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-amber-800">
                        <span className="h-1.5 w-1.5 bg-amber-500" aria-hidden="true" /> Не опубликовано
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-emerald-800">
                        <CheckCircle size={11} aria-hidden="true" /> Актуально
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 border border-primary/15 bg-[#F8F8F5] px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest text-gray-600">
                      Раздел открыт
                    </span>
                  )}
                </div>
                <h1 id="admin-section-title" className="mt-3 font-serif text-4xl leading-none md:text-5xl">{currentTabMeta.title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">{currentTabMeta.description}</p>
                {lastDraftSavedAt ? <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-gray-400">Локальный черновик: {lastDraftSavedAt}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-primary/20 px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:border-primary hover:bg-[#F8F8F5]">
                  <ExternalLink size={14} aria-hidden="true" /> Открыть сайт
                </a>
                <a href={SHOPIFY_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-primary bg-primary px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white hover:bg-accent hover:text-primary">
                  <Store size={14} aria-hidden="true" /> Shopify
                </a>
              </div>
            </div>
          </header>
        ) : null}

        {activeEditorDirty ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary bg-white shadow-[0_-12px_32px_rgba(4,15,30,0.12)] md:left-72" role="status" aria-live="polite">
            <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-8">
              <div className="min-w-0">
                <p className="text-sm font-bold">Есть несохранённые изменения</p>
                <p className="mt-0.5 text-xs text-gray-500">Черновик сохранён только в этом браузере{lastDraftSavedAt ? ` · ${lastDraftSavedAt}` : ''}.</p>
              </div>
              <button
                type="button"
                onClick={() => activeTab === 'books' ? handleSaveBook() : handleSaveNews()}
                disabled={Boolean(savingKey) || activeEditorHasErrors}
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 bg-primary px-6 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-accent hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                title={activeEditorHasErrors ? 'Исправьте ошибки перед публикацией' : 'Опубликовать изменения'}
              >
                {savingKey ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {activeEditorHasErrors ? 'Исправьте ошибки' : 'Сохранить и опубликовать'}
              </button>
            </div>
          </div>
        ) : null}

        {database && activeTab === 'command' ? (() => {
          const totalBooks = database[selectedLanguage].books.length;
          const totalNews = database[selectedLanguage].news.length;
          const linkedBooks = database[selectedLanguage].books.filter(book => Boolean(getShopifyPurchaseLink(book))).length;
          const preorderBooks = database[selectedLanguage].books.filter(book => book.isPreorder).length;
          const hasErrors = Object.keys(copyJsonErrors).length || Object.keys(bookJsonErrors).length ||
            (!isNewBook && bookRequiredErrors.length) ||
            (!isNewNews && newsRequiredErrors.length);
          return (
            <div className="mb-6 grid grid-cols-2 gap-px border border-primary/10 bg-primary/10 lg:grid-cols-5">
              <div className="bg-white border border-primary/10 p-4 flex-1 min-w-[110px]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Книги</p>
                <p className="mt-1 font-serif text-3xl">{totalBooks}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4 flex-1 min-w-[110px]">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Мероприятия</p>
                <p className="mt-1 font-serif text-3xl">{totalNews}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Shopify-ссылки</p>
                <p className="mt-1 font-serif text-3xl">{linkedBooks}<span className="text-base text-gray-400">/{totalBooks}</span></p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Предзаказ</p>
                <p className="mt-1 font-serif text-3xl">{preorderBooks}</p>
              </div>
              <div className={`${hasErrors ? 'bg-red-50' : 'bg-white'} p-4`}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Контент</p>
                <p className={`mt-1 font-serif text-2xl ${hasErrors ? 'text-red-600' : 'text-green-700'}`}>{hasErrors ? 'Ошибки' : 'ОК'}</p>
              </div>
            </div>
          );
        })() : null}

        {database && activeTab === 'command' ? (() => {
          const catalog = database[selectedLanguage];
          const now = Date.now();
          const draftNews = catalog.news.filter(item => item.draft).length;
          const scheduledNews = catalog.news.filter(item => item.publishAt && new Date(item.publishAt).getTime() > now).length;
          const liveNews = Math.max(0, catalog.news.length - draftNews - scheduledNews);
          const linkedBooks = catalog.books.filter(book => Boolean(getShopifyPurchaseLink(book)));
          const missingShopify = catalog.books.filter(book => !getShopifyPurchaseLink(book));
          const incompleteBooks = catalog.books.filter(book => !book.coverUrl || !book.description || !book.title || !book.author);
          const preorderBooks = catalog.books.filter(book => book.isPreorder);
          const readiness = Math.min(100,
            (catalog.books.length ? 22 : 0) +
            (catalog.news.length ? 14 : 0) +
            (incompleteBooks.length === 0 ? 24 : 8) +
            (missingShopify.length === 0 ? 28 : 8) +
            (lastPublishedAt ? 12 : 4)
          );
          const nextAction = newLeadsCount
              ? { title: `Ответить на ${newLeadsCount} новых заявок`, detail: 'Горячие обращения из раздела услуг ждут обработки.', tab: 'integrations' as AdminTab, label: 'Открыть заявки' }
              : missingShopify.length
                ? { title: `Подключить Shopify: ${missingShopify.length} книг`, detail: 'Добавьте публичные ссылки товаров, чтобы все карточки имели понятную кнопку покупки.', tab: 'books' as AdminTab, label: 'Открыть книги' }
                : incompleteBooks.length
                  ? { title: `Дополнить ${incompleteBooks.length} карточек`, detail: 'У части книг не хватает обложки или описания.', tab: 'books' as AdminTab, label: 'Проверить каталог' }
                  : { title: 'Запланировать следующий материал', detail: 'Каталог готов — можно усилить редакционный ритм.', tab: 'news' as AdminTab, label: 'Создать материал' };

          return (
            <section className="space-y-6 pb-12">
              <div className="relative overflow-hidden bg-primary text-white border border-primary min-h-[360px]">
                <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ background: 'radial-gradient(circle at 82% 18%, rgba(205,242,79,.42), transparent 31%), radial-gradient(circle at 62% 84%, rgba(255,255,255,.14), transparent 34%)' }} />
                <div className="relative grid lg:grid-cols-[1.35fr_.65fr] min-h-[360px]">
                  <div className="p-7 md:p-10 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/15">
                    <div>
                      <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.24em] font-mono text-white/55">
                        <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> Publishing intelligence</span>
                        <span>Live workspace</span>
                      </div>
                      <h1 className="font-serif text-5xl md:text-7xl leading-[.92] mt-8 max-w-3xl">Издательство<br /><span className="text-accent italic">в одном кадре.</span></h1>
                      <p className="mt-7 max-w-xl text-sm md:text-base text-white/65 leading-relaxed">Каталог, материалы, заявки и готовность сайта собраны в одном редакционном пространстве. Заказы, оплата и доставка полностью ведутся в Shopify.</p>
                    </div>
                    <button onClick={() => setActiveTab(nextAction.tab)} className="mt-9 min-h-12 w-fit inline-flex items-center gap-3 bg-accent text-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] hover:bg-white focus:outline-none focus:ring-4 focus:ring-accent/30 transition-colors">
                      {nextAction.label}<ArrowRight size={16} />
                    </button>
                  </div>
                  <div className="p-7 md:p-10 flex flex-col justify-between bg-white/[.035]">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.22em] font-mono text-white/50">Publishing readiness</p>
                      <div className="flex items-end gap-3 mt-5"><span className="font-serif text-8xl leading-none text-accent">{readiness}</span><span className="pb-2 text-xl text-white/40">/100</span></div>
                      <div className="h-1.5 bg-white/10 mt-6 overflow-hidden"><div className="h-full bg-accent transition-all duration-500" style={{ width: `${readiness}%` }} /></div>
                      <p className="mt-4 text-sm leading-relaxed text-white/60">{readiness >= 85 ? 'Контур готов к активному продвижению.' : readiness >= 65 ? 'Хорошая база. Осталось закрыть несколько операционных точек.' : 'Есть критические элементы, требующие внимания.'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-white/10 border border-white/10 mt-8">
                      <div className="bg-primary/80 p-4"><p className="text-[9px] uppercase tracking-widest text-white/40">Shopify</p><p className="mt-2 font-serif text-xl">{linkedBooks.length}/{catalog.books.length}</p></div>
                      <div className="bg-primary/80 p-4"><p className="text-[9px] uppercase tracking-widest text-white/40">Предзаказ</p><p className="mt-2 font-serif text-xl">{preorderBooks.length}</p></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid xl:grid-cols-[1.25fr_.75fr] gap-6">
                <div className="bg-white border border-primary/10">
                  <div className="p-6 md:p-8 border-b border-primary/10 flex items-start justify-between gap-4">
                    <div><p className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-400">Editorial pulse</p><h2 className="font-serif text-3xl mt-2">Редакционный конвейер</h2></div>
                    <CalendarDays size={22} className="text-gray-300" />
                  </div>
                  <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-primary/10">
                    {[['Черновики', draftNews, 'Требуют редакторского решения'], ['Запланировано', scheduledNews, 'Ждут момента публикации'], ['Опубликовано', liveNews, 'Работают на аудиторию']].map(([label, value, detail], index) => (
                      <button key={String(label)} onClick={() => setActiveTab('news')} className="min-h-[180px] p-6 text-left hover:bg-[#F8F8F4] focus:outline-none focus:ring-4 focus:ring-inset focus:ring-accent/40 transition-colors group">
                        <span className="font-mono text-[10px] text-gray-400">0{index + 1}</span>
                        <p className="font-serif text-5xl mt-6">{value}</p>
                        <p className="font-bold text-sm mt-4">{label}</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{detail}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#E9D9B7] border border-primary/10 p-6 md:p-8 flex flex-col justify-between">
                  <div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-mono"><Target size={14} /> Следующее действие</span><span className="text-[10px] font-mono uppercase tracking-widest opacity-50">Priority 01</span></div>
                  <div className="py-10"><h2 className="font-serif text-4xl leading-tight">{nextAction.title}</h2><p className="mt-4 text-sm leading-relaxed text-primary/60">{nextAction.detail}</p></div>
                  <button onClick={() => setActiveTab(nextAction.tab)} className="min-h-12 border-t border-primary/20 pt-4 flex items-center justify-between text-xs uppercase font-bold tracking-[0.16em] hover:text-white focus:outline-none focus:ring-4 focus:ring-primary/15">{nextAction.label}<ArrowRight size={16} /></button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-px bg-primary/10 border border-primary/10">
                {[
                  { label: 'Shopify подключён', value: linkedBooks.length, sub: `${missingShopify.length} без ссылки`, icon: <Store size={17} />, tab: 'books' as AdminTab },
                  { label: 'Новые заявки', value: newLeadsCount, sub: 'из формы услуг', icon: <TrendingUp size={17} />, tab: 'integrations' as AdminTab },
                  { label: 'Неполные карточки', value: incompleteBooks.length, sub: incompleteBooks[0]?.title || 'всё заполнено', icon: <AlertTriangle size={17} />, tab: 'books' as AdminTab },
                  { label: 'Каталог', value: catalog.books.length, sub: `${catalog.news.length} материалов`, icon: <BookOpen size={17} />, tab: 'books' as AdminTab },
                ].map(item => (
                  <button key={item.label} onClick={() => setActiveTab(item.tab)} className="min-h-[150px] bg-white p-6 text-left hover:bg-[#F8F8F4] focus:outline-none focus:ring-4 focus:ring-inset focus:ring-accent/40 transition-colors">
                    <div className="flex items-center justify-between text-gray-400"><span className="text-[10px] uppercase tracking-[0.18em]">{item.label}</span>{item.icon}</div>
                    <p className="font-serif text-5xl mt-5">{item.value}</p><p className="text-xs text-gray-400 mt-2 truncate">{item.sub}</p>
                  </button>
                ))}
              </div>

              <div className="bg-white border border-primary/10">
                <div className="p-6 md:p-8 border-b border-primary/10"><p className="text-[10px] uppercase tracking-[0.2em] font-mono text-gray-400">Быстрый старт</p><h2 className="font-serif text-3xl mt-2">Что редактируем сейчас?</h2></div>
                <div className="grid md:grid-cols-3 gap-px bg-primary/10">
                  <button onClick={() => setActiveTab('books')} className="min-h-[140px] bg-white p-6 text-left hover:bg-[#F8F8F4] focus:ring-4 focus:ring-inset focus:ring-accent/35">
                    <BookOpen size={20} className="text-accent" /><p className="mt-6 font-serif text-2xl">Книгу</p><p className="mt-2 text-xs leading-relaxed text-gray-500">Карточка, обложка и ссылка Shopify.</p>
                  </button>
                  <button onClick={() => setActiveTab('news')} className="min-h-[140px] bg-white p-6 text-left hover:bg-[#F8F8F4] focus:ring-4 focus:ring-inset focus:ring-accent/35">
                    <Newspaper size={20} className="text-accent" /><p className="mt-6 font-serif text-2xl">Материал</p><p className="mt-2 text-xs leading-relaxed text-gray-500">Новость, событие или анонс.</p>
                  </button>
                  <a href={SHOPIFY_STORE_URL} target="_blank" rel="noopener noreferrer" className="min-h-[140px] bg-white p-6 text-left hover:bg-[#F8F8F4] focus:ring-4 focus:ring-inset focus:ring-accent/35">
                    <Store size={20} className="text-accent" /><p className="mt-6 font-serif text-2xl">Shopify</p><p className="mt-2 text-xs leading-relaxed text-gray-500">Товары, заказы, оплата и доставка.</p>
                  </a>
                </div>
              </div>
            </section>
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
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <section className="bg-white border border-primary/10 xl:sticky xl:top-0 xl:max-h-[calc(100vh-5rem)] xl:self-start xl:overflow-y-auto">
              <div className="p-6 border-b border-primary/10 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-serif">Книги</h3>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-gray-400">{books.length} карточек</p>
                </div>
                <button
                  onClick={startNewBook}
                  className="min-h-[44px] px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                >
                  <Plus size={12} />
                  Новая книга
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
                      className={`min-h-[44px] px-3 py-2 text-[9px] uppercase tracking-widest border ${bookSort === s ? 'bg-primary text-white border-primary' : 'border-gray-200 hover:bg-gray-50 text-gray-500'}`}>
                      {s === 'default' ? 'Дата' : s === 'alpha' ? 'А-Я' : 'Склад'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] leading-relaxed text-gray-400">Готовность: название, автор, обложка, описание и Shopify-ссылка.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {filteredAdminBooks.map(book => {
                  const readiness = getBookEditorReadiness(book);
                  return (
                  <button
                    key={book.id}
                    onClick={() => selectAdminBook(book.id)}
                    aria-current={selectedBookId === book.id ? 'true' : undefined}
                    className={`w-full min-h-[84px] text-left p-3 hover:bg-gray-50 flex gap-3 items-center border-l-2 ${selectedBookId === book.id ? 'bg-[#F4F4F0] border-accent' : 'border-transparent'}`}
                  >
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover flex-shrink-0 border border-gray-100" />
                    ) : (
                      <div className="w-10 h-14 bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-300 text-[10px]">?</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-base leading-tight truncate">{book.title || book.id}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400 truncate">{book.author}</p>
                      <div className="flex gap-1 flex-wrap mt-0.5">
                        {book.isPreorder && <span className="text-[9px] bg-accent/20 text-accent-dark px-1 uppercase tracking-widest">предзаказ</span>}
                        {getShopifyPurchaseLink(book)
                          ? <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1 uppercase tracking-widest">Shopify</span>
                          : book.stock === 0
                            ? <span className="text-[9px] bg-red-100 text-red-600 px-1 font-mono">нет ссылки</span>
                            : book.stock <= 3
                              ? <span className="text-[9px] bg-amber-100 text-amber-700 px-1 font-mono">{book.stock} ост.</span>
                              : null}
                      </div>
                      <div className="mt-2 flex items-center gap-2" aria-label={`Заполнено ${readiness.complete} из ${readiness.total}`}>
                        <div className="h-1 flex-1 overflow-hidden bg-gray-200">
                          <div className={`h-full ${readiness.complete === readiness.total ? 'bg-emerald-600' : 'bg-accent'}`} style={{ width: `${(readiness.complete / readiness.total) * 100}%` }} />
                        </div>
                        <span className="font-mono text-[9px] text-gray-400">{readiness.complete}/{readiness.total}</span>
                      </div>
                    </div>
                  </button>
                  );
                })}
                {filteredAdminBooks.length === 0 ? (
                  <div className="p-6 text-center">
                    <BookOpen size={22} className="mx-auto text-gray-300" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold">Книги не найдены</p>
                    <p className="mt-1 text-xs text-gray-500">Измените запрос или создайте новую карточку.</p>
                    <button type="button" onClick={() => setBookSearch('')} className="mt-4 min-h-[44px] border border-primary px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white">Сбросить поиск</button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="admin-editor overflow-hidden bg-white border border-primary/10 p-4 md:p-6">
              {bookDraft ? (
                <div className="space-y-8">
                  <div className="sticky top-0 z-20 bg-white -mx-4 px-4 py-4 md:-mx-6 md:px-6 border-b border-gray-100 flex flex-col lg:flex-row justify-between lg:items-center gap-3">
                    <div>
                      <h3 className="text-3xl font-serif">Редактор книги</h3>
                      {bookDirty && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">● Есть несохранённые изменения · Ctrl+S</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
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
                            <a href={currentBookPublicPath} target="_blank" rel="noopener noreferrer"
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
                            let dup = cloneBook(bookDraft);
                            dup.id = createCopySlug(bookDraft);
                            dup.aliases = [];
                            dup = withPreorderStatus(withShopifyPurchaseUrl(dup, ''), true);
                            dup.variants = (dup.variants || []).map((variant, index) => ({
                              ...variant,
                              id: `sku-${Date.now()}-${index + 1}`,
                              isbn: '',
                              price: 0,
                              stock: 0,
                            }));
                            skipBookDirtyRef.current = true;
                            setSelectedBookId(dup.id);
                            setBookDraft(dup);
                            setStoryCollapsed(true);
                            setBookDirty(true);
                          }} className="px-4 py-3 border border-gray-300 hover:bg-gray-50 flex items-center gap-2 text-xs uppercase tracking-widest" title="Создать шаблон новой книги без старой Shopify-ссылки и ISBN">
                            <Copy size={14} />
                            Как шаблон
                          </button>
                          <button
                            onClick={handleSaveBook}
                            disabled={Boolean(savingKey) || bookRequiredErrors.length > 0 || Object.keys(bookJsonErrors).length > 0}
                            title={bookRequiredErrors.length || Object.keys(bookJsonErrors).length ? 'Сначала исправьте ошибки в карточке' : 'Сохранить книгу'}
                            className="min-h-[44px] px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary disabled:hover:text-white"
                          >
                            {savingKey === `book:${bookDraft.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Сохранить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <nav className="-mt-8 flex min-h-[52px] gap-2 overflow-x-auto border-b border-gray-100 py-2" aria-label="Разделы карточки книги">
                    {[
                      { href: '#book-basics', label: 'Основное' },
                      { href: '#book-shopify', label: 'Shopify' },
                      { href: '#book-cover', label: 'Обложка' },
                      { href: '#book-details', label: 'Описание' },
                      { href: '#book-story', label: 'Story Page' },
                    ].map(item => (
                      <a
                        key={item.href}
                        href={item.href}
                        className="inline-flex min-h-[44px] shrink-0 items-center border border-gray-200 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:border-primary hover:bg-[#F4F4F0] hover:text-primary"
                      >
                        {item.label}
                      </a>
                    ))}
                  </nav>
                  {bookPublishProbe.status !== 'idle' ? (
                    <div className={`border p-4 text-sm ${
                      bookPublishProbe.status === 'live'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : bookPublishProbe.status === 'checking'
                          ? 'border-blue-200 bg-blue-50 text-blue-800'
                          : bookPublishProbe.status === 'pending'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : 'border-red-200 bg-red-50 text-red-700'
                    }`}>
                      <div className="flex items-start gap-3">
                        {bookPublishProbe.status === 'checking' ? <Loader2 size={16} className="animate-spin mt-0.5 flex-shrink-0" /> : null}
                        {bookPublishProbe.status === 'live' ? <CheckCircle size={16} className="mt-0.5 flex-shrink-0" /> : null}
                        {bookPublishProbe.status === 'pending' || bookPublishProbe.status === 'error' ? <AlertCircle size={16} className="mt-0.5 flex-shrink-0" /> : null}
                        <div>
                          <p className="font-bold">{bookPublishProbe.message}</p>
                          {bookPublishProbe.checkedAt ? <p className="text-xs opacity-70 mt-1">Проверено: {bookPublishProbe.checkedAt}</p> : null}
                          {bookPublishProbe.details?.length ? (
                            <ul className="mt-2 space-y-1 text-xs">
                              {bookPublishProbe.details.map(item => <li key={item}>- {item}</li>)}
                            </ul>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {bookRequiredErrors.length || Object.keys(bookJsonErrors).length ? (
                    <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                      {[...bookRequiredErrors, ...Object.values(bookJsonErrors)].map(item => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  ) : null}

                  <section className="border border-primary bg-[#F4F4F0] p-5 md:p-6" aria-labelledby="book-setup-title">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="max-w-2xl">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">{isNewBook ? 'Новая книга · быстрый сценарий' : 'Карточка книги · готовность'}</p>
                        <h4 id="book-setup-title" className="mt-2 font-serif text-3xl leading-tight">Заполните витрину и вставьте ссылку Shopify</h4>
                        <p className="mt-2 text-sm leading-relaxed text-gray-600">
                          Название создаёт URL автоматически. Для публикации обязательны автор, обложка и публичная ссылка товара из Shopify; цену, наличие, оплату и доставку дальше ведёт сам магазин.
                        </p>
                      </div>
                      <div className="shrink-0 border border-primary bg-white px-4 py-3 text-center">
                        <span className="block font-serif text-3xl leading-none">{completedBookSetupChecks}/{bookSetupChecks.length}</span>
                        <span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-gray-500">готовность карточки</span>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-px border border-primary/10 bg-primary/10 sm:grid-cols-2 xl:grid-cols-5">
                      {bookSetupChecks.map(item => (
                        <div key={item.label} className="flex min-h-[52px] items-center gap-2 bg-white px-3 py-3 text-xs">
                          {item.ok
                            ? <CircleCheck size={16} className="shrink-0 text-emerald-700" aria-hidden="true" />
                            : <AlertCircle size={16} className="shrink-0 text-amber-600" aria-hidden="true" />}
                          <span className={item.ok ? 'text-primary' : 'text-gray-600'}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div id="book-basics" className="grid scroll-mt-32 grid-cols-1 gap-5 md:grid-cols-2">
                    <LF label="ID (slug)" hint="Создаётся автоматически — менять не нужно">
                      <input
                        value={bookDraft.id}
                        disabled={!isNewBook}
                        onChange={e => setBookDraft(prev => prev ? { ...prev, id: slugify(e.target.value) } : prev)}
                        className={`w-full border px-4 py-3 font-mono text-sm ${!isNewBook ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                      />
                      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 text-[11px]">
                        <a href={currentBookPublicPath} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:text-accent break-all">
                          {currentBookPublicUrl}
                        </a>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(currentBookPublicUrl).then(() => showToast('Ссылка скопирована'))}
                          className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-widest text-gray-500 hover:text-primary"
                        >
                          <Clipboard size={11} /> Copy URL
                        </button>
                      </div>
                    </LF>
                    <LF label="Старые URL / aliases" hint="По одному alias в строке. Старые ссылки будут вести на основной URL книги.">
                      <AutoTextarea
                        value={(bookDraft.aliases || []).join('\n')}
                        onChange={e => setBookDraft(prev => prev ? { ...prev, aliases: parseAliases((e.target as HTMLTextAreaElement).value) } : prev)}
                        rows={3}
                        className="border border-gray-300 px-4 py-3 font-mono text-sm"
                      />
                      {(bookDraft.aliases || []).length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(bookDraft.aliases || []).map(alias => (
                            <span key={alias} className="text-[10px] uppercase tracking-widest border border-gray-200 bg-gray-50 px-2 py-1 font-mono">
                              {`/product/${alias} -> ${currentBookPublicPath}`}
                            </span>
                          ))}
                        </div>
                      ) : null}
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
                    <LF label="Автор — родительный падеж (для «от …»)">
                      <input
                        value={bookDraft.authorGenitive ?? ''}
                        onChange={e => setBookDraft(prev => prev ? { ...prev, authorGenitive: e.target.value } : prev)}
                        className="w-full border border-gray-300 px-4 py-3"
                        placeholder={bookDraft.author ? `Авто: ${toGenitiveRu(bookDraft.author)}` : 'Оставьте пустым — склонится автоматически'}
                      />
                      <p className="mt-1.5 text-[11px] text-gray-400 leading-snug">
                        Заполняйте только если автосклонение неверно (напр. «Лев Толстой» → «Льва Толстого»). Пусто = склоняется само.
                      </p>
                    </LF>

                    <div id="book-shopify" className="md:col-span-2 scroll-mt-28 border border-primary bg-[#F8F8F5] p-4 md:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Шаг 2 · продажа</p>
                          <h4 className="mt-1 font-serif text-2xl">Товар в Shopify</h4>
                          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-600">
                            Откройте товар в магазине, нажмите View и скопируйте публичный адрес вида <span className="font-mono">shop.ampublishing.org/products/…</span>. Это будет основная кнопка покупки на сайте.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={SHOPIFY_STORE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-gray-300 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:border-primary"
                          >
                            <Store size={14} aria-hidden="true" /> Магазин
                          </a>
                          <a
                            href="https://admin.shopify.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-gray-300 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:border-primary"
                          >
                            <ExternalLink size={14} aria-hidden="true" /> Shopify Admin
                          </a>
                        </div>
                      </div>
                      <label htmlFor="book-shopify-url" className="mt-5 block text-[10px] font-bold uppercase tracking-widest text-gray-500">
                        Публичная ссылка товара Shopify <span className="text-red-600">*</span>
                      </label>
                      <div className="mt-1 flex flex-col gap-2 lg:flex-row">
                        <input
                          id="book-shopify-url"
                          type="url"
                          inputMode="url"
                          value={activeShopifyLink?.url || ''}
                          onChange={e => setBookDraft(prev => prev ? withShopifyPurchaseUrl(prev, e.target.value) : prev)}
                          onBlur={e => setBookDraft(prev => prev ? withShopifyPurchaseUrl(prev, normalizeShopifyProductUrl(e.target.value)) : prev)}
                          aria-invalid={!activeShopifyLink || !isValidShopifyProductUrl(activeShopifyLink.url)}
                          aria-describedby="book-shopify-help"
                          className={`min-h-[48px] flex-1 border bg-white px-4 py-3 font-mono text-sm outline-none focus:border-primary ${
                            activeShopifyLink && isValidShopifyProductUrl(activeShopifyLink.url) ? 'border-emerald-300' : 'border-amber-400'
                          }`}
                          placeholder="https://shop.ampublishing.org/products/nazvanie-knigi"
                        />
                        {activeShopifyLink && isValidShopifyProductUrl(activeShopifyLink.url) ? (
                          <a
                            href={activeShopifyLink.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 border border-emerald-300 bg-emerald-50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-emerald-800 hover:bg-white"
                          >
                            <ExternalLink size={14} aria-hidden="true" /> Проверить товар
                          </a>
                        ) : null}
                      </div>
                      <p id="book-shopify-help" className={`mt-2 text-xs ${activeShopifyLink && isValidShopifyProductUrl(activeShopifyLink.url) ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {activeShopifyLink && isValidShopifyProductUrl(activeShopifyLink.url)
                          ? 'Ссылка корректна — кнопки карточки и страницы книги откроют этот товар.'
                          : 'Обязательное поле. Нужна именно публичная страница товара на shop.ampublishing.org.'}
                      </p>
                    </div>

                    <LF label="Цена на витрине (€)" hint="Необязательно. Оставьте 0, чтобы показывать «Текущая цена в магазине» и не дублировать Shopify.">
                      <input type="number" min={0} step={0.01} value={bookDraft.price} onChange={e => setBookDraft(prev => prev ? { ...prev, price: Number(e.target.value) } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Старая цена (€)" hint="Используется только если выше указана локальная цена.">
                      <input type="number" min={0} step={0.01} value={bookDraft.oldPrice ?? ''} onChange={e => setBookDraft(prev => prev ? { ...prev, oldPrice: e.target.value ? Number(e.target.value) : undefined } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="Оставьте пустым, если нет скидки" />
                    </LF>
                    <LF label="Локальный остаток" hint="Для Shopify не используется: реальное наличие ведётся в магазине.">
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
                    <LF label="Основной формат" hint="У всех текущих книг — мягкая обложка. Для новой книги выберите формат здесь; фильтр каталога обновится автоматически.">
                      <select
                        value={(bookDraft.variants?.[0]?.format || DEFAULT_BOOK_FORMAT)}
                        onChange={e => setBookDraft(prev => {
                          if (!prev) return prev;
                          const variants = ensureBookVariants(prev, selectedLanguage).map(variant => ({ ...variant }));
                          variants[0] = { ...variants[0], format: e.target.value as Format };
                          return { ...prev, variants };
                        })}
                        className="w-full border border-gray-300 bg-white px-4 py-3"
                      >
                        <option value="paperback">Мягкая обложка</option>
                        <option value="hardcover">Твёрдая обложка</option>
                        <option value="digital">Цифровой отрывок</option>
                        <option value="special_edition">Подарочный комплект</option>
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
                    <LF label="Дополнительные магазины" hint="Необязательно. Эти ссылки появятся ниже основной кнопки Shopify." className="md:col-span-2">
                      <div className="space-y-3">
                        {(Array.isArray(bookDraft.purchaseLinks) ? bookDraft.purchaseLinks : [])
                          .map((link, idx) => ({ link, idx }))
                          .filter(({ link }) => !isShopifyPurchaseLink(link))
                          .map(({ link, idx }) => (
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
                            onClick={() => setBookDraft(prev => prev ? { ...prev, purchaseLinks: [...(Array.isArray(prev.purchaseLinks) ? prev.purchaseLinks : []), { id: `pl-${Date.now()}`, label: '', url: '' }] } : prev)}
                            className="min-h-[44px] text-xs uppercase font-bold tracking-widest text-primary border border-gray-300 px-4 py-2 hover:bg-gray-50"
                          >
                            + Добавить магазин
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
                      <label className="flex min-h-[44px] items-center gap-3 border border-accent/40 bg-accent/10 px-3 py-2 cursor-pointer hover:bg-accent/20 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(bookDraft.isPreorder)}
                          onChange={e => setBookDraft(prev => prev ? withPreorderStatus(prev, e.target.checked) : prev)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span><b className="block text-xs uppercase tracking-widest">Предзаказ</b><small className="block text-[11px] text-gray-500">Меняет и статус, и бейдж на витрине</small></span>
                      </label>
                    </div>
                  </div>

                  <div id="book-cover" className="scroll-mt-32">
                    <ImageField
                      label="Обложка"
                      value={bookDraft.coverUrl}
                      onChange={value => setBookDraft(prev => prev ? { ...prev, coverUrl: value } : prev)}
                      filenamePrefix={`cover-${bookDraft.id || 'book'}`}
                    />
                  </div>

                  <section className="border border-primary/10 bg-[#F8F8F5] p-4 md:p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">Preview</p>
                        <h4 className="font-serif text-2xl leading-tight">Как выглядит карточка</h4>
                      </div>
                      <a href={currentBookPublicPath} target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase tracking-widest font-bold text-primary hover:text-accent inline-flex items-center gap-1">
                        Page <ExternalLink size={11} />
                      </a>
                    </div>
                    <div className="max-w-[280px] bg-white border border-primary shadow-[8px_8px_0_rgba(4,15,30,0.08)]">
                      <div className="aspect-[3/4] border-b border-primary bg-[#E8EDF2] p-3">
                        {bookDraft.coverUrl ? (
                          <img src={bookDraft.coverUrl} alt={bookDraft.title || 'Book cover preview'} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-mono text-gray-400">NO COVER</div>
                        )}
                      </div>
                      <div className="p-4 space-y-3">
                        <div>
                          <h5 className="font-serif text-2xl leading-none line-clamp-2">{bookDraft.title || 'Название книги'}</h5>
                          <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-gray-400">
                            от <span className="text-primary font-bold">{bookDraft.author || 'Автор'}</span>
                          </p>
                        </div>
                        <div className="flex items-end justify-between gap-3 border-t border-gray-100 pt-3">
                          <span className={bookDraft.price > 0 ? 'font-serif text-xl leading-none' : 'font-mono text-[9px] uppercase tracking-widest text-gray-500'}>
                            {bookDraft.price > 0 ? `${bookDraft.price.toFixed(2)} EUR` : 'Цена в Shopify'}
                          </span>
                          <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 ${activeShopifyLink ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                            {activeShopifyLink ? 'Shopify' : 'Нет ссылки'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <div id="book-details" className="scroll-mt-32 space-y-5">
                    <LF label="Краткое описание">
                      <AutoTextarea value={bookDraft.description}
                        onChange={e => setBookDraft(prev => prev ? { ...prev, description: (e.target as HTMLTextAreaElement).value } : prev)}
                        countType="words"
                        className="border border-gray-300 px-4 py-3" rows={4} />
                    </LF>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
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
                  </div>

                  <div id="book-story" className="scroll-mt-32 space-y-5">
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
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
            <section className="bg-white border border-primary/10 xl:sticky xl:top-0 xl:max-h-[calc(100vh-5rem)] xl:self-start xl:overflow-y-auto">
              <div className="p-6 border-b border-primary/10 flex items-center justify-between">
                <h3 className="text-2xl font-serif">Мероприятия</h3>
                <button
                  onClick={startNewNews}
                  className="min-h-[44px] px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
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
                {filteredAdminNews.map(item => (
                  <button
                    key={item.id}
                    onClick={() => selectAdminNews(item.id)}
                    aria-current={selectedNewsId === item.id ? 'true' : undefined}
                    className={`w-full min-h-[80px] border-l-2 p-4 text-left hover:bg-gray-50 ${selectedNewsId === item.id ? 'border-accent bg-[#F4F4F0]' : 'border-transparent'}`}
                  >
                    <div className="flex gap-3">
                      {item.imageUrl ? <img src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 border border-primary/10 object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-dashed border-primary/20 bg-[#F8F8F5] font-mono text-[9px] text-gray-400">NO IMG</span>}
                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-xl leading-none mb-2 line-clamp-2">{item.title || item.id}</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400">{item.category || 'Новости'} · {item.date}{item.featured ? ' · ★' : ''}</p>
                      </div>
                    </div>
                  </button>
                ))}
                {filteredAdminNews.length === 0 ? (
                  <div className="p-6 text-center">
                    <Newspaper size={22} className="mx-auto text-gray-300" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold">Материалы не найдены</p>
                    <p className="mt-1 text-xs text-gray-500">Измените запрос или добавьте новое мероприятие.</p>
                    <button type="button" onClick={() => setNewsSearch('')} className="mt-4 min-h-[44px] border border-primary px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white">Сбросить поиск</button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="overflow-hidden bg-white border border-primary/10 p-4 md:p-6">
              {newsDraft ? (
                <div className="space-y-6">
                  <div className="sticky top-0 z-10 -mx-4 flex flex-col justify-between gap-3 border-b border-gray-100 bg-white px-4 py-4 md:-mx-6 md:px-6 lg:flex-row lg:items-center">
                    <div>
                      <h3 className="text-3xl font-serif">Редактор новости</h3>
                      {newsDirty && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">● НЕСОХРАНЁННЫЕ ИЗМЕНЕНИЯ · CTRL+S</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
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
                          <button onClick={handleSaveNews} disabled={Boolean(savingKey) || newsRequiredErrors.length > 0} className="min-h-[44px] px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40">
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
                  <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <LF label="ID (slug)">
                          <input value={newsDraft.id} onChange={e => setNewsDraft(prev => prev ? { ...prev, id: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" />
                        </LF>
                        <LF label="Дата публикации">
                          <input type="date" value={newsDraft.date} onChange={e => setNewsDraft(prev => prev ? { ...prev, date: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                        </LF>
                      </div>

                      <div className="border border-primary/10 bg-[#F8F8F5] p-4 md:p-5">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/45">Editorial canvas</p>
                            <h4 className="mt-1 font-serif text-2xl">Содержание материала</h4>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setNewsDraft(prev => prev ? { ...prev, blocks: [...(prev.blocks?.length ? prev.blocks : blocksFromLegacyBody(prev.body || '')), createNewsBlock('heading')] } : prev)} className="border border-primary/20 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white">+ Заголовок</button>
                            <button type="button" onClick={() => setNewsDraft(prev => prev ? { ...prev, blocks: [...(prev.blocks?.length ? prev.blocks : blocksFromLegacyBody(prev.body || '')), createNewsBlock('quote')] } : prev)} className="border border-primary/20 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white">+ Цитата</button>
                            <button type="button" onClick={() => setNewsDraft(prev => prev ? { ...prev, blocks: [...(prev.blocks?.length ? prev.blocks : blocksFromLegacyBody(prev.body || '')), createNewsBlock('text')] } : prev)} className="border border-primary/20 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white">+ Текст</button>
                            <button type="button" onClick={() => setNewsDraft(prev => prev ? { ...prev, blocks: [...(prev.blocks?.length ? prev.blocks : blocksFromLegacyBody(prev.body || '')), createNewsBlock('image')] } : prev)} className="border border-primary/20 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white">+ Фото</button>
                          </div>
                        </div>
                        <LF label="Заголовок">
                          <input value={newsDraft.title} onChange={e => setNewsDraft(prev => prev ? { ...prev, title: e.target.value } : prev)} className="w-full border border-gray-300 bg-white px-4 py-3 text-lg font-serif" placeholder="Название, которое хочется открыть" />
                        </LF>
                        <div className="mt-5">
                          <LF label="Краткий анонс">
                            <AutoTextarea value={newsDraft.preview}
                              onChange={e => setNewsDraft(prev => prev ? { ...prev, preview: (e.target as HTMLTextAreaElement).value } : prev)}
                              countType="words"
                              className="border border-gray-300 bg-white px-4 py-3" rows={4} />
                          </LF>
                        </div>
                        <div className="mt-5">
                          {newsDraft.blocks?.length ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/55">Блоки материала · {newsDraft.blocks.length}</span><button type="button" onClick={() => setNewsDraft(prev => prev ? { ...prev, blocks: [], body: prev.blocks?.map(block => block.content).filter(Boolean).join('\n\n') } : prev)} className="text-[10px] uppercase tracking-widest text-gray-500 underline hover:text-primary">В обычный текст</button></div>
                              {newsDraft.blocks.map((block, index) => (
                                <div key={block.id} className="border border-primary/15 bg-white p-3 md:p-4">
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><select value={block.type} onChange={e => setNewsDraft(prev => prev ? { ...prev, blocks: prev.blocks?.map(item => item.id === block.id ? { ...item, type: e.target.value as NewsBlockType } : item) } : prev)} className="border border-gray-300 bg-[#F8F8F5] px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest"><option value="text">Текст</option><option value="heading">Заголовок</option><option value="quote">Цитата</option><option value="image">Фото</option></select><div className="flex gap-1"><button type="button" disabled={index === 0} onClick={() => setNewsDraft(prev => { if (!prev?.blocks) return prev; const blocks = [...prev.blocks]; [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]]; return { ...prev, blocks }; })} className="border border-gray-200 px-2 py-1 text-xs disabled:opacity-30">↑</button><button type="button" disabled={index === (newsDraft.blocks?.length || 0) - 1} onClick={() => setNewsDraft(prev => { if (!prev?.blocks) return prev; const blocks = [...prev.blocks]; [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]]; return { ...prev, blocks }; })} className="border border-gray-200 px-2 py-1 text-xs disabled:opacity-30">↓</button><button type="button" onClick={() => setNewsDraft(prev => prev ? { ...prev, blocks: prev.blocks?.filter(item => item.id !== block.id) } : prev)} className="border border-red-200 px-2 py-1 text-xs text-red-600">×</button></div></div>
                                  {block.type === 'image' ? <><input value={block.content} onChange={e => setNewsDraft(prev => prev ? { ...prev, blocks: prev.blocks?.map(item => item.id === block.id ? { ...item, content: e.target.value } : item) } : prev)} className="w-full border border-gray-300 px-3 py-2 text-xs font-mono" placeholder="URL изображения" /><input value={block.caption || ''} onChange={e => setNewsDraft(prev => prev ? { ...prev, blocks: prev.blocks?.map(item => item.id === block.id ? { ...item, caption: e.target.value } : item) } : prev)} className="mt-2 w-full border border-gray-300 px-3 py-2 text-xs" placeholder="Подпись к изображению" /></> : <AutoTextarea value={block.content} onChange={e => setNewsDraft(prev => prev ? { ...prev, blocks: prev.blocks?.map(item => item.id === block.id ? { ...item, content: (e.target as HTMLTextAreaElement).value } : item) } : prev)} className="border border-gray-300 px-3 py-2 font-serif text-base" rows={block.type === 'heading' ? 2 : 4} countType="words" />}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <LF label="Полный текст · можно конвертировать в блоки">
                              <AutoTextarea value={newsDraft.body || ''}
                                onChange={e => setNewsDraft(prev => prev ? { ...prev, body: (e.target as HTMLTextAreaElement).value } : prev)}
                                countType="words"
                                className="min-h-[300px] border border-gray-300 bg-white px-4 py-4 font-serif text-lg leading-relaxed" rows={12} />
                            </LF>
                          )}
                        </div>
                      </div>

                      <ImageField
                        label="Обложка материала"
                        hint="Загрузите, вставьте из буфера или укажите URL. На сайте она появляется в самом материале и в разделе «Медиа»."
                        value={newsDraft.imageUrl || ''}
                        onChange={value => setNewsDraft(prev => prev ? { ...prev, imageUrl: value } : prev)}
                        filenamePrefix={`news-${newsDraft.id || 'story'}`}
                      />
                    </div>

                    <aside className="space-y-5 2xl:sticky 2xl:top-24 2xl:self-start">
                      <section className={`overflow-hidden border border-primary bg-white shadow-[10px_10px_0_rgba(4,15,30,0.08)] transition-[max-width] duration-300 ${newsPreviewDevice === 'mobile' ? 'mx-auto max-w-[360px]' : ''}`}>
                        <div className="flex items-center justify-between border-b border-primary/10 px-4 py-3">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary/55">Живой предпросмотр</span>
                          <span className="flex border border-primary/15 bg-white p-0.5">
                            <button type="button" onClick={() => setNewsPreviewDevice('desktop')} className={`px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${newsPreviewDevice === 'desktop' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Desktop</button>
                            <button type="button" onClick={() => setNewsPreviewDevice('mobile')} className={`px-2 py-1 font-mono text-[9px] uppercase tracking-widest ${newsPreviewDevice === 'mobile' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}>Mobile</button>
                          </span>
                        </div>
                        {newsDraft.imageUrl ? <img src={newsDraft.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" /> : <div className="flex aspect-[16/9] items-center justify-center bg-[#E8EDF2] font-mono text-[10px] uppercase tracking-widest text-gray-400">Обложка не добавлена</div>}
                        <article className="p-5 md:p-6">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">{newsDraft.category || 'Новости'} · {newsDraft.date || 'дата'}</p>
                          <h4 className={`mt-4 font-serif leading-[.95] text-primary ${newsPreviewDevice === 'mobile' ? 'text-3xl' : 'text-4xl'}`}>{newsDraft.title || 'Заголовок материала'}</h4>
                          <p className="mt-4 font-serif text-lg italic leading-relaxed text-primary/70">{newsDraft.preview || 'Короткий анонс появится здесь.'}</p>
                          <div className="mt-5 border-t border-primary/10 pt-5 font-serif text-base leading-relaxed text-primary/90 whitespace-pre-line line-clamp-8">{newsDraft.blocks?.length ? newsDraft.blocks.map(block => block.content).filter(Boolean).join('\n\n') : (newsDraft.body || 'Полный текст материала появится здесь.')}</div>
                        </article>
                      </section>

                      <section className="border border-primary/10 bg-[#F8F8F5] p-5 space-y-4">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/45">Настройки публикации</p>
                          <h4 className="mt-1 font-serif text-2xl">Карточка и SEO</h4>
                        </div>
                        <LF label="Рубрика">
                          <input value={newsDraft.category || ''} onChange={e => setNewsDraft(prev => prev ? { ...prev, category: e.target.value } : prev)} className="w-full border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Новости, анонс, событие…" />
                        </LF>
                        <LF label="Подпись к обложке / alt">
                          <AutoTextarea value={newsDraft.imageAlt || ''} onChange={e => setNewsDraft(prev => prev ? { ...prev, imageAlt: (e.target as HTMLTextAreaElement).value } : prev)} className="border border-gray-300 bg-white px-3 py-2 text-sm" rows={3} countType="chars" placeholder="Коротко опишите изображение для доступности и поиска" />
                        </LF>
                        <label className="flex cursor-pointer items-start gap-3 border border-primary/10 bg-white p-3 text-sm hover:border-primary/30">
                          <input type="checkbox" checked={Boolean(newsDraft.featured)} onChange={e => setNewsDraft(prev => prev ? { ...prev, featured: e.target.checked } : prev)} className="mt-0.5 h-4 w-4 accent-primary" />
                          <span><b className="block text-xs uppercase tracking-widest">Выделить материал</b><small className="mt-1 block text-xs leading-relaxed text-gray-500">Метка готова для витринных блоков; сам материал остаётся доступен по отдельной ссылке.</small></span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 border border-primary/10 bg-white p-3 text-sm hover:border-primary/30">
                          <input type="checkbox" checked={Boolean(newsDraft.draft)} onChange={e => setNewsDraft(prev => prev ? { ...prev, draft: e.target.checked } : prev)} className="mt-0.5 h-4 w-4 accent-primary" />
                          <span><b className="block text-xs uppercase tracking-widest">Черновик</b><small className="mt-1 block text-xs leading-relaxed text-gray-500">Сохранится в редакции, но не будет виден на публичном сайте.</small></span>
                        </label>
                        <LF label="Отложить публикацию">
                          <input type="datetime-local" value={newsDraft.publishAt ? newsDraft.publishAt.slice(0, 16) : ''} onChange={e => setNewsDraft(prev => prev ? { ...prev, publishAt: e.target.value ? new Date(e.target.value).toISOString() : undefined } : prev)} className="w-full border border-gray-300 bg-white px-3 py-2 text-sm" />
                        </LF>
                        <div className="border border-primary/10 bg-white p-3">
                          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary/45">Готовность материала</p>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                            {newsEditorialChecks.map(check => <span key={check.label} className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide ${check.ok ? 'text-green-700' : 'text-amber-700'}`}><i className={`h-1.5 w-1.5 rounded-full ${check.ok ? 'bg-green-600' : 'bg-amber-500'}`} />{check.label}</span>)}
                          </div>
                        </div>
                        <a href={`/news/${newsDraft.id}`} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 border border-primary bg-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white"><ExternalLink size={13} /> Открыть страницу</a>
                      </section>
                    </aside>
                  </div>
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
          const sectionLabels: Record<AboutSectionId, string> = {
            hero: 'Обложка / Hero',
            story: 'История и миссия',
            principles: 'Принципы и цифры',
            team: 'Команда',
            contact: 'Финальный призыв',
          };
          const aboutSections: { label: string; fields: ContentField[] }[] = [
            {
              label: 'Шапка страницы',
              fields: [
                { key: 'static.about.eyebrow', label: 'Надзаголовок', type: 'text' },
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
                { key: 'static.about.quote', label: 'Редакционная цитата', type: 'textarea' },
              ],
            },
            {
              label: 'Статистика',
              fields: [
                { key: 'static.about.stat1_value', label: 'Значение 1', type: 'text' },
                { key: 'static.about.stat1_text', label: 'Пояснение 1', type: 'text' },
                { key: 'static.about.stat2_value', label: 'Значение 2', type: 'text' },
                { key: 'static.about.stat2_text', label: 'Пояснение 2', type: 'text' },
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
            {
              label: 'Финальный призыв',
              fields: [
                { key: 'static.about.cta_title', label: 'Заголовок', type: 'text' },
                { key: 'static.about.cta_text', label: 'Описание', type: 'textarea' },
                { key: 'static.about.cta_button', label: 'Текст кнопки', type: 'text' },
              ],
            },
          ];
          const allAboutFields = aboutSections.flatMap(s => s.fields);
          const moveAboutSection = (index: number, direction: -1 | 1) => {
            updateAboutLayout(layout => {
              const target = index + direction;
              if (target < 0 || target >= layout.sections.length) return layout;
              const sections = [...layout.sections];
              [sections[index], sections[target]] = [sections[target], sections[index]];
              return { ...layout, sections };
            });
          };
          const handleSaveAll = async () => {
            startSave('about:all', `Сохранение структуры и текстов…`);
            const errors: string[] = [];
            let lastOverrides: TranslationOverrides | null = null;
            if (siteDraft) {
              try {
                const next = await api.saveSiteSettings(siteDraft);
                setSiteDraft(next);
                setGlobalSiteSettings(next);
              } catch {
                errors.push('Структура и фото');
              }
            }
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
              finishSave(`«О нас» сохранено — структура, фото и ${allAboutFields.length} полей` + (selectedLanguage === 'ru' ? ' · EN/DE запустится автоматически' : ''));
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

              {siteDraft && (
                <section className="bg-white border border-primary/10 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-primary/10 bg-primary text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">Конструктор страницы</p>
                      <h3 className="font-serif text-2xl mt-1">Структура, видимость и изображения</h3>
                    </div>
                    <p className="text-xs text-white/55 max-w-md">Порядок меняется стрелками. Любой блок можно скрыть без удаления контента.</p>
                  </div>
                  <div className="p-5 md:p-6 space-y-6">
                    <div className="border border-primary/10">
                      {siteDraft.aboutLayout.sections.map((section, index) => (
                        <div key={section.id} className="min-h-16 px-4 py-3 border-b last:border-b-0 border-primary/10 flex items-center gap-3 bg-[#FAFAF8]">
                          <span className="font-mono text-[10px] text-gray-400 w-6">{String(index + 1).padStart(2, '0')}</span>
                          <label className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={section.enabled}
                              onChange={e => updateAboutLayout(layout => ({ ...layout, sections: layout.sections.map(item => item.id === section.id ? { ...item, enabled: e.target.checked } : item) }))}
                              className="h-5 w-5 accent-[#0b1623]"
                            />
                            <span className={`text-sm font-medium ${section.enabled ? 'text-primary' : 'text-gray-400 line-through'}`}>{sectionLabels[section.id]}</span>
                          </label>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => moveAboutSection(index, -1)} disabled={index === 0} aria-label={`Поднять секцию ${sectionLabels[section.id]}`} className="h-11 w-11 inline-flex items-center justify-center border border-primary/15 hover:bg-white disabled:opacity-25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ArrowUp size={15} /></button>
                            <button type="button" onClick={() => moveAboutSection(index, 1)} disabled={index === siteDraft.aboutLayout.sections.length - 1} aria-label={`Опустить секцию ${sectionLabels[section.id]}`} className="h-11 w-11 inline-flex items-center justify-center border border-primary/15 hover:bg-white disabled:opacity-25 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"><ArrowDown size={15} /></button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <details className="border border-primary/10 bg-[#FAFAF8]" open>
                      <summary className="cursor-pointer select-none px-5 py-4 font-mono text-xs uppercase tracking-[0.18em] font-bold">Обложка и история</summary>
                      <div className="p-5 pt-2 grid lg:grid-cols-2 gap-6">
                        <ImageField label="Фото Hero" value={siteDraft.aboutLayout.heroImageUrl} onChange={value => updateAboutLayout(layout => ({ ...layout, heroImageUrl: value }))} filenamePrefix="about-hero" hint="Широкий кадр, оптимально 1800 × 1200 px." />
                        <div className="space-y-5">
                          <ImageField label="Фото миссии" value={siteDraft.aboutLayout.missionImageUrl} onChange={value => updateAboutLayout(layout => ({ ...layout, missionImageUrl: value }))} filenamePrefix="about-mission" hint="Вертикальный или горизонтальный кадр — сайт обрежет адаптивно." />
                          <LF label="Положение фото миссии">
                            <select value={siteDraft.aboutLayout.missionImageSide} onChange={e => updateAboutLayout(layout => ({ ...layout, missionImageSide: e.target.value as 'left' | 'right' }))} className="w-full min-h-12 border border-gray-300 px-4 bg-white">
                              <option value="left">Слева от текста</option>
                              <option value="right">Справа от текста</option>
                            </select>
                          </LF>
                        </div>
                      </div>
                    </details>

                    <details className="border border-primary/10 bg-[#FAFAF8]">
                      <summary className="cursor-pointer select-none px-5 py-4 font-mono text-xs uppercase tracking-[0.18em] font-bold">Фотографии команды</summary>
                      <div className="p-5 pt-2 grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {siteDraft.aboutLayout.team.map(member => (
                          <div key={member.id} className="p-4 bg-white border border-primary/10 space-y-4">
                            <label className="min-h-11 flex items-center gap-3 cursor-pointer">
                              <input type="checkbox" checked={member.enabled} onChange={e => updateAboutLayout(layout => ({ ...layout, team: layout.team.map(item => item.id === member.id ? { ...item, enabled: e.target.checked } : item) }))} className="h-5 w-5 accent-[#0b1623]" />
                              <span className="text-sm font-bold">{copyDrafts[`static.about.${member.id}`] || member.id}</span>
                            </label>
                            <ImageField label="Фото" value={member.imageUrl} onChange={value => updateAboutLayout(layout => ({ ...layout, team: layout.team.map(item => item.id === member.id ? { ...item, imageUrl: value } : item) }))} filenamePrefix={`about-${member.id}`} />
                          </div>
                        ))}
                      </div>
                    </details>

                    <div className="flex justify-end">
                      <button type="button" onClick={handleSaveSiteSettings} className="min-h-12 px-5 bg-primary text-white hover:bg-accent hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                        <Save size={14} /> Сохранить структуру
                      </button>
                    </div>
                  </div>
                </section>
              )}

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
                        {field.type === 'textarea' ? (
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

        {activeTab === 'integrations' ? (
          <IntegrationsPanel
            language={selectedLanguage}
            orders={orders}
            onToast={showToast}
            onReload={reloadIntegrations}
            onBulkTracking={async pairs => {
              for (const pair of pairs) {
                await api.updateOrderTracking(pair.orderId, pair.tracking);
              }
              await refreshOrders();
            }}
          />
        ) : null}

        {activeTab === 'services' ? (
          <ServicesEditor language={selectedLanguage} onToast={showToast} />
        ) : null}

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

        {activeTab === 'payments' ? (() => {
          const paidOrders = orders.filter(order => order.paymentStatus === 'paid');
          const pendingOrders = orders.filter(order => order.paymentStatus === 'pending');
          const paidRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
          const configured = [
            integrations?.shopify.enabled,
            Boolean(integrations?.shopify.domain),
            integrations?.analytics.enabled,
          ].filter(Boolean).length;
          const cardInput = 'w-full min-h-11 border border-primary/15 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10';
          return <section className="space-y-6">
            <div className="border border-primary bg-primary px-6 py-7 text-white md:px-8 md:py-8">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-white/60"><Store size={14} /> Commerce control room</div>
                  <h3 className="font-serif text-3xl leading-none md:text-4xl">Shopify, payments &amp; growth</h3>
                  <p className="mt-3 text-sm leading-6 text-white/70">Основной путь покупки — Shopify. Ручные реквизиты остаются резервным вариантом; магазин, live‑цены и аналитика настраиваются в едином контуре интеграций.</p>
                  <button onClick={() => setActiveTab('integrations')} className="mt-4 inline-flex min-h-11 items-center gap-2 border border-white/35 px-3 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white hover:text-primary"><GitBranch size={14} />Открыть интеграции Shopify</button>
                </div>
                <button onClick={handleSavePaymentSettings} disabled={savingKey === 'payment-settings'} className="inline-flex min-h-11 items-center justify-center gap-2 border border-white bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-primary transition hover:bg-accent disabled:cursor-wait disabled:opacity-70">
                  {savingKey === 'payment-settings' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Сохранить
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px border border-primary/15 bg-primary/15 md:grid-cols-4">
              {[
                ['Продажи подтверждены', `${paidOrders.length}`, <CircleCheck size={17} />],
                ['Ожидают оплаты', `${pendingOrders.length}`, <CreditCard size={17} />],
                ['Подтверждённый оборот', `${paidRevenue.toLocaleString('de-DE', { maximumFractionDigits: 2 })} EUR`, <BarChart3 size={17} />],
                ['Контур подключён', `${configured}/3`, configured === 3 ? <CircleCheck size={17} /> : <AlertTriangle size={17} />],
              ].map(([label, value, icon]) => <div key={String(label)} className="min-w-0 bg-white p-4 md:p-5">
                <div className="flex items-center justify-between text-primary/55">{icon as React.ReactNode}</div>
                <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-primary/55">{label as string}</p>
                <p className="mt-1 truncate font-serif text-2xl text-primary">{value as string}</p>
              </div>)}
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
              <div className="border border-primary/15 bg-white p-5 md:p-7">
                <div className="mb-6 flex items-start gap-3"><Store size={18} className="mt-1" /><div><h4 className="font-serif text-2xl">Shopify — главный контур</h4><p className="mt-1 text-sm text-gray-500">Основная ссылка товара задаётся прямо в редакторе каждой книги; API-настройки в «Интеграциях» необязательны.</p></div></div>
                <div className="grid gap-px border border-primary/15 bg-primary/15 sm:grid-cols-3">
                  {[
                    ['Каталог', 'Вставьте публичный URL товара в карточке книги — кнопка покупки сразу ведёт в Shopify.'],
                    ['Цена и наличие', 'Ведите цену, остаток, оплату и доставку в Shopify без дублирования на сайте.'],
                    ['Аналитика', 'GA4, Plausible, Umami и Meta Pixel настраиваются с cookie‑согласием.'],
                  ].map(([title, text]) => <div key={title} className="bg-white p-4"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary/55">{title}</p><p className="mt-3 text-sm leading-5 text-gray-600">{text}</p></div>)}
                </div>
                <button onClick={() => setActiveTab('integrations')} className="mt-5 inline-flex min-h-11 items-center gap-2 border border-primary px-3 text-xs font-bold uppercase tracking-wider transition hover:bg-primary hover:text-white"><ExternalLink size={13} />Настроить Shopify</button>
              </div>

              <aside className="border border-primary/15 bg-[#F8F8F5] p-5 md:p-7">
                <div className="flex items-start gap-3"><BarChart3 size={18} className="mt-1" /><div><h4 className="font-serif text-2xl">Analytics</h4><p className="mt-1 text-sm leading-5 text-gray-500">GA4 получает просмотры книг и переходы покупателей в Shopify.</p></div></div>
                <div className="mt-6 border-t border-primary/10 pt-4 text-xs leading-5 text-gray-600"><p className="flex gap-2"><CircleCheck size={15} className="mt-0.5 shrink-0 text-green-700" />События просмотра книги и клика по Shopify уже предусмотрены. В «Интеграциях» добавьте GA4 Measurement ID и включите consent‑режим.</p></div>
                <button onClick={() => setActiveTab('integrations')} className="mt-5 inline-flex min-h-11 items-center gap-2 border border-primary px-3 text-xs font-bold uppercase tracking-wider transition hover:bg-primary hover:text-white"><BarChart3 size={13} />Настроить аналитику</button>
              </aside>
            </div>

            <details className="group border border-primary/15 bg-white" open>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-bold"><span className="flex items-center gap-2"><Link2 size={16} />Резервная оплата и уведомления</span><span className="font-mono text-[10px] font-normal uppercase tracking-widest text-gray-400">раскрыть / скрыть</span></summary>
              <div className="border-t border-primary/10 p-5 md:p-7">
                <p className="mb-5 max-w-3xl text-sm leading-6 text-gray-500">Эти данные нужны только для ручных Visa / Mastercard / счёта. Не вводите сюда ключи Shopify, Stripe или Google — секреты остаются в соответствующих сервисах.</p>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <LF label="Получатель / название"><input value={paymentSettings.recipientName} onChange={e => setPaymentSettings(prev => ({ ...prev, recipientName: e.target.value }))} className={cardInput} /></LF>
                  <LF label="Префикс счёта"><input value={paymentSettings.invoicePrefix} onChange={e => setPaymentSettings(prev => ({ ...prev, invoicePrefix: e.target.value.toUpperCase() }))} className={`${cardInput} font-mono`} /></LF>
                  <LF label="Внешняя ссылка Visa"><input value={paymentSettings.visaPaymentUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, visaPaymentUrl: e.target.value }))} className={`${cardInput} font-mono`} placeholder="https://..." inputMode="url" /></LF>
                  <LF label="Внешняя ссылка Mastercard"><input value={paymentSettings.mastercardPaymentUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, mastercardPaymentUrl: e.target.value }))} className={`${cardInput} font-mono`} placeholder="https://..." inputMode="url" /></LF>
                  <LF label="Банк"><input value={paymentSettings.bankName} onChange={e => setPaymentSettings(prev => ({ ...prev, bankName: e.target.value }))} className={cardInput} /></LF>
                  <LF label="IBAN / счёт"><input value={paymentSettings.iban} onChange={e => setPaymentSettings(prev => ({ ...prev, iban: e.target.value }))} className={`${cardInput} font-mono`} /></LF>
                  <LF label="WhatsApp"><input value={paymentSettings.whatsappNumber} onChange={e => setPaymentSettings(prev => ({ ...prev, whatsappNumber: e.target.value }))} className={`${cardInput} font-mono`} placeholder="+49..." inputMode="tel" /></LF>
                  <LF label="Email для подтверждений"><input type="email" value={paymentSettings.contactEmail} onChange={e => setPaymentSettings(prev => ({ ...prev, contactEmail: e.target.value }))} className={cardInput} /></LF>
                  <LF label="Название webhook"><input value={paymentSettings.webhookLabel} onChange={e => setPaymentSettings(prev => ({ ...prev, webhookLabel: e.target.value }))} className={cardInput} /></LF>
                  <LF label="Webhook URL"><input value={paymentSettings.webhookUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, webhookUrl: e.target.value }))} className={`${cardInput} font-mono`} placeholder="https://..." inputMode="url" /></LF>
                </div>
                <div className="mt-5"><LF label="Примечание для покупателя"><AutoTextarea value={paymentSettings.paymentNote} onChange={e => setPaymentSettings(prev => ({ ...prev, paymentNote: (e.target as HTMLTextAreaElement).value }))} rows={3} countType="chars" className="border border-primary/15 px-3 py-2.5" /></LF></div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <label className="flex min-h-12 items-center gap-3 border border-primary/15 px-4 text-sm"><input type="checkbox" checked={paymentSettings.notifyOnOrderCreated} onChange={e => setPaymentSettings(prev => ({ ...prev, notifyOnOrderCreated: e.target.checked }))} />Webhook при новом заказе</label>
                  <label className="flex min-h-12 items-center gap-3 border border-primary/15 px-4 text-sm"><input type="checkbox" checked={paymentSettings.notifyOnPaymentConfirmed} onChange={e => setPaymentSettings(prev => ({ ...prev, notifyOnPaymentConfirmed: e.target.checked }))} />Webhook при подтверждении оплаты</label>
                </div>
              </div>
            </details>
          </section>;
        })() : null}

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
                          <div className="w-full">
                            <label className="block text-[9px] uppercase tracking-widest text-gray-400 mb-1">Трек-номер DHL</label>
                            <div className="flex items-center gap-2">
                              <input
                                defaultValue={order.trackingNumber || ''}
                                placeholder="00340434…"
                                onBlur={e => {
                                  const value = e.target.value.trim();
                                  if (value !== (order.trackingNumber || '')) handleTrackingSave(order.id, value);
                                }}
                                className="w-40 border border-gray-300 px-2 py-1.5 font-mono text-[11px]"
                              />
                              {order.trackingNumber ? (
                                <a
                                  href={buildDhlTrackingUrl(
                                    integrations?.dhl || { trackingUrlTemplate: '' } as any,
                                    order.trackingNumber,
                                  ) || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 border border-gray-200 hover:bg-gray-50"
                                  title="Отследить в DHL"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              ) : null}
                            </div>
                          </div>
                          {(savingKey === `order:${order.id}` || savingKey === `payment:${order.id}` || savingKey === `tracking:${order.id}`) && <Loader2 size={14} className="animate-spin" />}
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
