import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../AppContext';
import { api } from '../services/api';
import { contentStore } from '../services/contentStore';
import { FeaturedAuthor, ShowcaseAuthor, getAuthorShowcaseContent, getFeaturedAuthorContent } from '../services/authorShowcase';
import { translations } from '../translations';
import { Book, Language, LocalizedCatalogData, NavLinkConfig, NewsItem, OrderStatus, PaymentSettings, PaymentStatus, SiteSettings, TranslationOverrides } from '../types';
import {
  Activity,
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
  Layout,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

type AdminTab = 'copy' | 'books' | 'news' | 'authors' | 'site' | 'payments' | 'orders' | 'status';
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
      { key: 'nav.our_authors', label: 'Our authors menu label', type: 'text' },
      { key: 'static.our_authors.title', label: 'Our authors title', type: 'text' },
      { key: 'static.our_authors.subtitle', label: 'Our authors subtitle', type: 'textarea' },
      { key: 'static.our_authors.gallery_label', label: 'Our authors gallery label', type: 'text' },
      { key: 'static.our_authors.gallery_title', label: 'Our authors gallery title', type: 'text' },
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
  purchaseLinks: {
    amazon: '',
  },
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
}> = ({ label, value, onChange, filenamePrefix = 'upload' }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'optimizing' | 'uploading' | 'done' | 'error'>('idle');

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      setUploadStatus('optimizing');
      const dataUrl = await optimizeImageFile(file);

      // Try uploading to GitHub; fall back to data URL if not authenticated
      const ext = 'webp';
      const filename = `${filenamePrefix}-${Date.now()}.${ext}`;
      try {
        setUploadStatus('uploading');
        const publicPath = await contentStore.uploadImage(filename, dataUrl);
        onChange(publicPath);
        setUploadStatus('done');
      } catch {
        // Not authenticated or quota issue — keep data URL locally
        onChange(dataUrl);
        setUploadStatus('error');
      }
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const statusLabel = {
    idle: 'Upload image',
    optimizing: 'Optimizing…',
    uploading: 'Uploading to GitHub…',
    done: 'Uploaded ✓',
    error: 'Saved locally (no PAT)',
  }[uploadStatus];

  const isBase64 = value.startsWith('data:');

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold">{label}</label>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setUploadStatus('idle'); }}
        className="w-full border border-gray-300 px-4 py-3 bg-white outline-none focus:border-primary text-xs font-mono"
        placeholder="https://... or upload a file →"
      />
      {isBase64 && (
        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2">
          ⚠ Image stored as base64 — save the book to upload it to GitHub and replace with a proper URL.
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <label className={`inline-flex items-center justify-center gap-2 px-4 py-3 border text-xs uppercase tracking-[0.18em] cursor-pointer transition-colors ${isUploading ? 'border-gray-200 text-gray-400 cursor-wait' : 'border-gray-300 hover:bg-gray-50'}`}>
          {isUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {statusLabel}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
        </label>
        {uploadStatus === 'done' && <span className="text-xs text-green-600">Saved to /images/uploads/ in repo</span>}
        {uploadStatus === 'error' && <span className="text-xs text-amber-600">Stored locally — log in with PAT to upload</span>}
      </div>
      {value ? (
        <div className="border border-gray-200 bg-[#F8F8F5] p-3">
          <img src={value} alt={label} className="max-h-48 w-auto object-contain" />
        </div>
      ) : null}
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteCheck, setSiteCheck] = useState<{ status: 'idle' | 'ok' | 'fail'; ms?: number }>({ status: 'idle' });
  const [storage, setStorage] = useState<{ key: string; bytes: number; preview?: string }[]>([]);
  const [now, setNow] = useState(Date.now());

  const REPO = 'munister-v/ampublishing';

  const fetchRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=5`, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      const data = await res.json();
      setRuns(data.workflow_runs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'fetch failed');
    } finally {
      setLoading(false);
    }
  };

  const probeSite = async () => {
    setSiteCheck({ status: 'idle' });
    const t0 = performance.now();
    try {
      // no-cors returns opaque response but resolves on reachable host
      await fetch('https://ampublishing.org/', { mode: 'no-cors', cache: 'no-store' });
      setSiteCheck({ status: 'ok', ms: Math.round(performance.now() - t0) });
    } catch {
      setSiteCheck({ status: 'fail', ms: Math.round(performance.now() - t0) });
    }
  };

  const collectStorage = () => {
    try {
      const interesting = Object.keys(localStorage).filter(k =>
        /^(am-|am_|ampublishing|admin_)/.test(k),
      );
      const rows = interesting.map(k => {
        const v = localStorage.getItem(k) || '';
        return {
          key: k,
          bytes: new Blob([v]).size,
          preview: v.length > 80 ? v.slice(0, 80) + '…' : v,
        };
      });
      setStorage(rows.sort((a, b) => b.bytes - a.bytes));
    } catch {
      setStorage([]);
    }
  };

  useEffect(() => {
    fetchRuns();
    probeSite();
    collectStorage();
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tick);
  }, []);

  const latest = runs[0];
  const lastDeployTime = latest?.updated_at ? new Date(latest.updated_at).getTime() : 0;
  const minutesSinceDeploy = lastDeployTime ? Math.floor((now - lastDeployTime) / 60000) : null;
  const isFresh = minutesSinceDeploy !== null && minutesSinceDeploy < 5;

  return (
    <section className="space-y-8">
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border border-primary/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-400">Deploy</p>
          <p className="font-serif text-3xl mt-2">
            {latest ? (latest.conclusion || latest.status) : '—'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {latest ? `${formatRelative(latest.updated_at)} · ${latest.head_sha.slice(0, 7)}` : 'no data'}
          </p>
          {isFresh ? <p className="text-[10px] uppercase tracking-widest text-accent mt-2">fresh</p> : null}
        </div>
        <div className="bg-white border border-primary/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-400">ampublishing.org</p>
          <p className="font-serif text-3xl mt-2">
            {siteCheck.status === 'ok' ? 'reachable' : siteCheck.status === 'fail' ? 'unreachable' : 'checking…'}
          </p>
          <p className="text-xs text-gray-500 mt-1">{siteCheck.ms ? `${siteCheck.ms} ms round-trip` : ''}</p>
        </div>
        <div className="bg-white border border-primary/10 p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-gray-400">Local store</p>
          <p className="font-serif text-3xl mt-2">{storage.length} keys</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatBytes(storage.reduce((sum, row) => sum + row.bytes, 0))}
          </p>
        </div>
      </div>

      <div className="bg-white border border-primary/10">
        <div className="p-6 border-b border-primary/10 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-serif">GitHub Pages deploys</h3>
            <p className="text-xs text-gray-500 mt-1">{REPO}</p>
          </div>
          <button onClick={fetchRuns} className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </button>
        </div>
        {error ? <p className="px-6 py-4 text-sm text-red-600">{error}</p> : null}
        <table className="w-full text-left">
          <thead className="bg-[#F4F4F0]">
            <tr className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              <th className="p-4">When</th>
              <th className="p-4">Workflow</th>
              <th className="p-4">Status</th>
              <th className="p-4">Commit</th>
              <th className="p-4">Link</th>
            </tr>
          </thead>
          <tbody>
            {runs.map(run => (
              <tr key={run.id} className="border-t border-gray-100">
                <td className="p-4 text-sm">
                  <div>{formatRelative(run.updated_at)}</div>
                  <div className="text-xs text-gray-400">{new Date(run.updated_at).toLocaleString()}</div>
                </td>
                <td className="p-4 text-sm">{run.name}</td>
                <td className="p-4 text-sm">
                  <span className={`px-2 py-1 text-[10px] uppercase tracking-[0.18em] border ${
                    run.conclusion === 'success' ? 'border-green-600 text-green-700' :
                    run.conclusion === 'failure' ? 'border-red-600 text-red-700' :
                    run.status === 'in_progress' || run.status === 'queued' ? 'border-amber-500 text-amber-700' :
                    'border-gray-400 text-gray-500'
                  }`}>{run.conclusion || run.status}</span>
                </td>
                <td className="p-4 text-xs font-mono">
                  <div>{run.head_sha.slice(0, 7)}</div>
                  <div className="text-gray-500 max-w-[28ch] truncate" title={run.head_commit?.message || ''}>
                    {run.head_commit?.message?.split('\n')[0] || ''}
                  </div>
                </td>
                <td className="p-4 text-xs">
                  <a href={run.html_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">open ↗</a>
                </td>
              </tr>
            ))}
            {!runs.length && !loading ? (
              <tr><td colSpan={5} className="p-6 text-sm text-gray-500">No runs found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-primary/10">
        <div className="p-6 border-b border-primary/10 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-serif">Local autosave & cache</h3>
            <p className="text-xs text-gray-500 mt-1">localStorage keys persisted by the admin/site</p>
          </div>
          <button onClick={collectStorage} className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-[#F4F4F0]">
            <tr className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
              <th className="p-4">Key</th>
              <th className="p-4">Size</th>
              <th className="p-4">Preview</th>
            </tr>
          </thead>
          <tbody>
            {storage.map(row => (
              <tr key={row.key} className="border-t border-gray-100 align-top">
                <td className="p-4 text-xs font-mono">{row.key}</td>
                <td className="p-4 text-xs font-mono whitespace-nowrap">{formatBytes(row.bytes)}</td>
                <td className="p-4 text-xs font-mono text-gray-500 break-all">{row.preview}</td>
              </tr>
            ))}
            {!storage.length ? (
              <tr><td colSpan={3} className="p-6 text-sm text-gray-500">No local-cache entries.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-primary/10 p-6 text-xs text-gray-500 space-y-2">
        <p><span className="font-mono uppercase tracking-[0.18em] text-gray-400">Probe:</span> ampublishing.org is checked via opaque <code>fetch</code> (no-cors). 200/0 both register as «reachable»; an actual network error is the only fail signal.</p>
        <p><span className="font-mono uppercase tracking-[0.18em] text-gray-400">Deploys:</span> unauthenticated GitHub API allows 60 req/h per source IP. If you hit «GitHub API 403», the rate-limit reset takes ~1 h.</p>
        <button onClick={() => { probeSite(); fetchRuns(); collectStorage(); }} className="mt-2 px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2">
          <RefreshCw size={14} /> Refresh all
        </button>
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');

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
    setFeaturedAuthorDraft(getFeaturedAuthorContent(selectedLanguage, overrides[selectedLanguage]?.['static.our_authors.featured_author']));
    setShowcaseDraft(getAuthorShowcaseContent(selectedLanguage, overrides[selectedLanguage]?.['static.our_authors.showcase_items']));
  }, [selectedLanguage, overrides]);

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

  // Mark dirty whenever the drafts change from user edits (not initial load)
  const bookDraftRef = useRef(bookDraft);
  useEffect(() => {
    if (bookDraftRef.current !== null && bookDraft !== null) setBookDirty(true);
    bookDraftRef.current = bookDraft;
  }, [bookDraft, bookJsonDrafts]);

  const newsDraftRef = useRef(newsDraft);
  useEffect(() => {
    if (newsDraftRef.current !== null && newsDraft !== null) setNewsDirty(true);
    newsDraftRef.current = newsDraft;
  }, [newsDraft]);

  const handleSaveBookRef = useRef<(() => void) | null>(null);
  const handleSaveNewsRef = useRef<(() => void) | null>(null);

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
      const nextOverrides = await api.setTranslationValue(selectedLanguage, field.key, parsedValue);
      setOverrides(nextOverrides);
      await reloadContent();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast(
        selectedLanguage === 'ru'
          ? `${field.label} (RU) сохранено. EN/DE автоматически переведёт CI в течение пары минут.`
          : `${field.label} saved`,
      );
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
      setSavingKey(`book:${bookDraft.id}`);
      await api.upsertBook(selectedLanguage, nextBook);
      await reloadContent();
      await loadAdminData();
      setBookDirty(false);
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast(
        selectedLanguage === 'ru'
          ? `Книга «${bookDraft.title || bookDraft.id}» (RU) сохранена. EN/DE автоматически переведёт CI.`
          : `Book ${bookDraft.title || bookDraft.id} saved`,
      );
    } catch {
      showToast('Could not save book', 'error');
    } finally {
      setSavingKey(null);
    }
  }, [bookDraft, bookJsonDrafts, selectedLanguage]);

  useEffect(() => { handleSaveBookRef.current = handleSaveBook; }, [handleSaveBook]);

  const handleDeleteBook = async () => {
    if (!bookDraft) return;
    try {
      setSavingKey(`book:delete:${bookDraft.id}`);
      await api.deleteBook(selectedLanguage, bookDraft.id);
      if (selectedLanguage === 'ru') {
        await api.deleteBook('en', bookDraft.id).catch(() => {});
        await api.deleteBook('de', bookDraft.id).catch(() => {});
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

  const handleSaveNews = useCallback(async () => {
    if (!newsDraft) return;
    try {
      setSavingKey(`news:${newsDraft.id}`);
      await api.upsertNewsItem(selectedLanguage, newsDraft);
      await reloadContent();
      await loadAdminData();
      setNewsDirty(false);
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast(
        selectedLanguage === 'ru'
          ? `Новость «${newsDraft.title || newsDraft.id}» (RU) сохранена. EN/DE автоматически переведёт CI.`
          : `News ${newsDraft.title || newsDraft.id} saved`,
      );
    } catch {
      showToast('Could not save news', 'error');
    } finally {
      setSavingKey(null);
    }
  }, [newsDraft, selectedLanguage]);

  useEffect(() => { handleSaveNewsRef.current = handleSaveNews; }, [handleSaveNews]);

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

  const handleSaveAuthors = async () => {
    if (!featuredAuthorDraft) return;
    try {
      setSavingKey('authors');
      await api.setTranslationValue(selectedLanguage, 'static.our_authors.featured_author', featuredAuthorDraft);
      const nextOverrides = await api.setTranslationValue(selectedLanguage, 'static.our_authors.showcase_items', showcaseDraft);

      setOverrides(nextOverrides);
      await reloadContent();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast(
        selectedLanguage === 'ru'
          ? 'Раздел «Наши авторы» (RU) сохранён. EN/DE автоматически переведёт CI.'
          : 'Our authors saved',
      );
    } catch {
      showToast('Could not save authors section', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveSiteSettings = async () => {
    if (!siteDraft) return;
    try {
      setSavingKey('site-settings');
      const next = await api.saveSiteSettings(siteDraft);
      setSiteDraft(next);
      setGlobalSiteSettings(next);
      await reloadContent();
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast('Site settings saved');
    } catch {
      showToast('Could not save site settings', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPassword2) { showToast('Passwords do not match', 'error'); return; }
    if (newPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
    setSavingPassword(true);
    try {
      const pat = sessionStorage.getItem('gh_pat') || localStorage.getItem('gh_pat') || '';
      await api.setupAdminPassword('admin@ampublishing.org', newPassword, pat);
      showToast('Password saved — you can now log in with your password');
      setNewPassword('');
      setNewPassword2('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save password', 'error');
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
      setSavingKey('payment-settings');
      const next = await api.savePaymentSettings(paymentSettings);
      setPaymentSettings(next);
      setLastPublishedAt(new Date().toLocaleTimeString());
      showToast('Payment and invoice settings saved');
    } catch {
      showToast('Could not save payment settings', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    setSavingKey(`order:${orderId}`);
    await updateOrderStatus(orderId, status);
    setSavingKey(null);
  };

  const handlePaymentStatusChange = async (orderId: string, paymentStatus: PaymentStatus) => {
    try {
      setSavingKey(`payment:${orderId}`);
      await api.updatePaymentStatus(orderId, paymentStatus);
      await refreshOrders();
      showToast(`Payment status for ${orderId} updated`);
    } catch {
      showToast('Could not update payment status', 'error');
    } finally {
      setSavingKey(null);
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
            { id: 'authors', label: 'Our Authors', icon: <Globe size={16} /> },
            { id: 'site', label: 'Site / Header / Footer', icon: <Layout size={16} /> },
            { id: 'payments', label: 'Payments', icon: <Gavel size={16} /> },
            { id: 'orders', label: 'Orders', icon: <ShoppingBag size={16} /> },
            { id: 'status', label: 'Status', icon: <Activity size={16} /> },
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
                  onClick={() => { setSelectedLanguage(lang); setLanguage(lang); }}
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

        {database ? (() => {
          const totalBooks = database[selectedLanguage].books.length;
          const totalNews = database[selectedLanguage].news.length;
          const pendingOrders = orders.filter(o => o.paymentStatus === 'pending').length;
          const totalRevenue = orders.filter(o => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);
          const hasErrors = Object.keys(copyJsonErrors).length || Object.keys(bookJsonErrors).length || bookRequiredErrors.length || newsRequiredErrors.length;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
              <div className="bg-white border border-primary/10 p-4 col-span-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Books</p>
                <p className="mt-1 font-serif text-3xl">{totalBooks}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">News</p>
                <p className="mt-1 font-serif text-3xl">{totalNews}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Orders</p>
                <p className="mt-1 font-serif text-3xl">{orders.length}</p>
              </div>
              <div className={`border p-4 ${pendingOrders > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-primary/10'}`}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Awaiting payment</p>
                <p className={`mt-1 font-serif text-3xl ${pendingOrders > 0 ? 'text-amber-700' : ''}`}>{pendingOrders}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Revenue (paid)</p>
                <p className="mt-1 font-serif text-3xl">{totalRevenue > 0 ? `€${totalRevenue.toFixed(0)}` : '—'}</p>
              </div>
              <div className={`border p-4 ${hasErrors ? 'bg-red-50 border-red-200' : 'bg-white border-primary/10'}`}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Validation</p>
                <p className={`mt-1 font-serif text-2xl ${hasErrors ? 'text-red-600' : 'text-green-700'}`}>{hasErrors ? 'Issues' : 'OK'}</p>
              </div>
              <div className="bg-white border border-primary/10 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Published</p>
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
                      {book.isPreorder && <span className="text-[9px] bg-accent/20 text-accent-dark px-1 uppercase tracking-widest">pre-order</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white border border-primary/10 p-6">
              {bookDraft ? (
                <div className="space-y-8">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h3 className="text-3xl font-serif">Book Editor</h3>
                      {bookDirty && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">● Unsaved changes · Ctrl+S to save</span>}
                    </div>
                    <div className="flex gap-2 items-center">
                      {deleteConfirm === `book:${bookDraft.id}` ? (
                        <>
                          <span className="text-xs text-red-600 font-bold">Confirm delete?</span>
                          <button onClick={handleDeleteBook} className="px-4 py-3 bg-red-600 text-white flex items-center gap-2 text-xs uppercase tracking-widest">Yes, delete</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setDeleteConfirm(`book:${bookDraft.id}`)} className="px-4 py-3 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-xs uppercase tracking-widest">
                            <Trash2 size={14} />
                            Delete
                          </button>
                          <button onClick={handleSaveBook} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                            {savingKey === `book:${bookDraft.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save
                          </button>
                        </>
                      )}
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
                    <LF label="ID (slug)" hint="Auto-generated, change only if needed">
                      <input value={bookDraft.id} onChange={e => setBookDraft(prev => prev ? { ...prev, id: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" />
                    </LF>
                    <LF label="Release date">
                      <input type="date" value={bookDraft.releaseDate} onChange={e => setBookDraft(prev => prev ? { ...prev, releaseDate: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Title">
                      <input value={bookDraft.title} onChange={e => setBookDraft(prev => prev ? { ...prev, title: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Author">
                      <input value={bookDraft.author} onChange={e => setBookDraft(prev => prev ? { ...prev, author: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Price (€)">
                      <input type="number" min={0} step={0.01} value={bookDraft.price} onChange={e => setBookDraft(prev => prev ? { ...prev, price: Number(e.target.value) } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Stock (0 = out of stock)">
                      <input type="number" min={0} value={bookDraft.stock} onChange={e => setBookDraft(prev => prev ? { ...prev, stock: Number(e.target.value) } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Type">
                      <select value={bookDraft.type || 'publisher'} onChange={e => setBookDraft(prev => prev ? { ...prev, type: e.target.value as Book['type'] } : prev)} className="w-full border border-gray-300 px-4 py-3 bg-white">
                        <option value="publisher">Publisher edition</option>
                        <option value="self">Self-published</option>
                      </select>
                    </LF>
                    <LF label="Age rating">
                      <select value={bookDraft.ageRating || '16+'} onChange={e => setBookDraft(prev => prev ? { ...prev, ageRating: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3 bg-white">
                        {['0+','6+','12+','16+','18+'].map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </LF>
                    <LF label="Series">
                      <input value={bookDraft.series || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, series: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Publisher">
                      <input value={bookDraft.details.publisher || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, publisher: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Genres (comma-separated)" className="md:col-span-2">
                      <input value={bookDraft.genre.join(', ')} onChange={e => setBookDraft(prev => prev ? { ...prev, genre: e.target.value.split(',').map(item => item.trim()).filter(Boolean) } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="fiction, literary, historical" />
                    </LF>
                    <LF label="Amazon URL" className="md:col-span-2">
                      <input value={bookDraft.purchaseLinks?.amazon || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, purchaseLinks: { ...(prev.purchaseLinks || {}), amazon: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://amazon.de/dp/..." />
                    </LF>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-2">Badges & flags</p>
                    <div className="flex flex-wrap gap-3">
                      {(['new','bestseller','preorder','exclusive'] as const).map(badge => (
                        <label key={badge} className="flex items-center gap-2 border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                          <input type="checkbox" checked={(bookDraft.badges || []).includes(badge)} onChange={e => setBookDraft(prev => {
                            if (!prev) return prev;
                            const next = e.target.checked ? [...(prev.badges || []), badge] : (prev.badges || []).filter(b => b !== badge);
                            return { ...prev, badges: next as Book['badges'] };
                          })} />
                          {badge}
                        </label>
                      ))}
                      <label className="flex items-center gap-2 border border-gray-200 px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm">
                        <input type="checkbox" checked={!!bookDraft.isPreorder} onChange={e => setBookDraft(prev => prev ? { ...prev, isPreorder: e.target.checked } : prev)} />
                        Pre-order mode
                      </label>
                    </div>
                  </div>

                  <ImageField
                    label="Cover image"
                    value={bookDraft.coverUrl}
                    onChange={value => setBookDraft(prev => prev ? { ...prev, coverUrl: value } : prev)}
                    filenamePrefix={`cover-${bookDraft.id || 'book'}`}
                  />

                  <LF label="Short description (catalog card)">
                    <textarea value={bookDraft.description} onChange={e => setBookDraft(prev => prev ? { ...prev, description: e.target.value } : prev)} rows={4} className="w-full border border-gray-300 px-4 py-3" />
                  </LF>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    <LF label="Pages">
                      <input type="number" min={0} value={bookDraft.details.pages} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, pages: Number(e.target.value) } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Year">
                      <input type="number" min={1900} max={2100} value={bookDraft.details.year} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, year: Number(e.target.value) } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Weight">
                      <input value={bookDraft.details.weight || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, weight: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="320 g" />
                    </LF>
                    <LF label="Dimensions">
                      <input value={bookDraft.details.dimensions || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, details: { ...prev.details, dimensions: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="21×14 cm" />
                    </LF>
                  </div>

                  <div className="space-y-5">
                    <h4 className="font-serif text-2xl border-t border-gray-100 pt-6">Story Page</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <LF label="Opening quote">
                        <input value={bookDraft.story?.quote || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, quote: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="«...»" />
                      </LF>
                      <LF label="Quote source">
                        <input value={bookDraft.story?.quoteSource || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, quoteSource: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" placeholder="— Name, Title" />
                      </LF>
                    </div>
                    <LF label="External detail page URL (leave empty to use internal /catalog/id)">
                      <input value={bookDraft.story?.detailPageUrl || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, detailPageUrl: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
                    </LF>
                    <ImageField
                      label="Story feature image (large banner on book page)"
                      value={bookDraft.story?.featureImageUrl || ''}
                      onChange={value => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, featureImageUrl: value } } : prev)}
                      filenamePrefix={`story-${bookDraft.id || 'book'}`}
                    />
                    <LF label="About (paragraphs separated by blank line)">
                      <textarea value={(bookDraft.story?.about || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, about: parseParagraphs(e.target.value) } } : prev)} rows={6} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Excerpt (paragraphs separated by blank line)">
                      <textarea value={(bookDraft.story?.excerpt || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, excerpt: parseParagraphs(e.target.value) } } : prev)} rows={6} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Author bio (paragraphs separated by blank line)">
                      <textarea value={(bookDraft.story?.authorBio || []).join('\n\n')} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, authorBio: parseParagraphs(e.target.value) } } : prev)} rows={5} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Order note (shown on book page near the buy button)">
                      <textarea value={bookDraft.story?.orderNote || ''} onChange={e => setBookDraft(prev => prev ? { ...prev, story: { ...prev.story!, orderNote: e.target.value } } : prev)} rows={3} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                    <LF label="Variants JSON (price/format options)" hint={bookJsonErrors.variants}>
                      <textarea value={bookJsonDrafts.variants} onChange={e => setBookJsonDrafts(prev => ({ ...prev, variants: e.target.value }))} rows={8} className={`w-full border px-4 py-3 font-mono text-sm ${bookJsonErrors.variants ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`} />
                    </LF>
                    <LF label="Themes JSON" hint={bookJsonErrors.themes}>
                      <textarea value={bookJsonDrafts.themes} onChange={e => setBookJsonDrafts(prev => ({ ...prev, themes: e.target.value }))} rows={8} className={`w-full border px-4 py-3 font-mono text-sm ${bookJsonErrors.themes ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`} />
                    </LF>
                    <LF label="Reviews JSON" hint={bookJsonErrors.reviews}>
                      <textarea value={bookJsonDrafts.reviews} onChange={e => setBookJsonDrafts(prev => ({ ...prev, reviews: e.target.value }))} rows={8} className={`w-full border px-4 py-3 font-mono text-sm ${bookJsonErrors.reviews ? 'border-red-400 bg-red-50/40' : 'border-gray-300'}`} />
                    </LF>
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
                    <div>
                      <h3 className="text-3xl font-serif">News Editor</h3>
                      {newsDirty && <span className="text-[10px] font-mono text-amber-600 uppercase tracking-widest">● Unsaved changes · Ctrl+S to save</span>}
                    </div>
                    <div className="flex gap-2 items-center">
                      {deleteConfirm === `news:${newsDraft.id}` ? (
                        <>
                          <span className="text-xs text-red-600 font-bold">Confirm delete?</span>
                          <button onClick={handleDeleteNews} className="px-4 py-3 bg-red-600 text-white flex items-center gap-2 text-xs uppercase tracking-widest">Yes, delete</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setDeleteConfirm(`news:${newsDraft.id}`)} className="px-4 py-3 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-xs uppercase tracking-widest">
                            <Trash2 size={14} />
                            Delete
                          </button>
                          <button onClick={handleSaveNews} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                            {savingKey === `news:${newsDraft.id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            Save
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {newsRequiredErrors.length ? (
                    <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      {newsRequiredErrors.map(item => <div key={item}>{item}</div>)}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <LF label="ID (slug)">
                      <input value={newsDraft.id} onChange={e => setNewsDraft(prev => prev ? { ...prev, id: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" />
                    </LF>
                    <LF label="Date">
                      <input type="date" value={newsDraft.date} onChange={e => setNewsDraft(prev => prev ? { ...prev, date: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                    </LF>
                  </div>
                  <LF label="Title">
                    <input value={newsDraft.title} onChange={e => setNewsDraft(prev => prev ? { ...prev, title: e.target.value } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                  </LF>
                  <LF label="Preview text">
                    <textarea value={newsDraft.preview} onChange={e => setNewsDraft(prev => prev ? { ...prev, preview: e.target.value } : prev)} rows={5} className="w-full border border-gray-300 px-4 py-3" />
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
                  <h3 className="text-3xl font-serif">Our Authors</h3>
                  <p className="mt-2 text-sm text-gray-500">Manage the featured author block and the showcase cards that appear on the homepage and the dedicated authors page.</p>
                </div>
                <button onClick={handleSaveAuthors} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                  {savingKey === 'authors' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save authors section
                </button>
              </div>

              {featuredAuthorDraft ? (
                <div className="space-y-8">
                  <div className="border border-primary/10 p-6 bg-[#F8F8F5]">
                    <h4 className="font-serif text-2xl mb-6">Featured author</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <input value={featuredAuthorDraft.label} onChange={e => setFeaturedAuthorDraft(prev => prev ? { ...prev, label: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Label" />
                      <input value={featuredAuthorDraft.nameMain} onChange={e => setFeaturedAuthorDraft(prev => prev ? { ...prev, nameMain: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Main name" />
                      <input value={featuredAuthorDraft.nameAccent} onChange={e => setFeaturedAuthorDraft(prev => prev ? { ...prev, nameAccent: e.target.value } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Accent name" />
                      <input value={featuredAuthorDraft.tags.join(', ')} onChange={e => setFeaturedAuthorDraft(prev => prev ? { ...prev, tags: e.target.value.split(',').map(item => item.trim()).filter(Boolean) } : prev)} className="border border-gray-300 px-4 py-3" placeholder="Tags, comma separated" />
                    </div>
                    <textarea value={featuredAuthorDraft.intro} onChange={e => setFeaturedAuthorDraft(prev => prev ? { ...prev, intro: e.target.value } : prev)} rows={3} className="w-full mt-5 border border-gray-300 px-4 py-3" placeholder="Intro" />
                    <textarea value={featuredAuthorDraft.body.join('\n\n')} onChange={e => setFeaturedAuthorDraft(prev => prev ? { ...prev, body: parseParagraphs(e.target.value) } : prev)} rows={6} className="w-full mt-5 border border-gray-300 px-4 py-3" placeholder="Body paragraphs, separated by empty line" />
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-2xl">Showcase cards</h4>
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
                        Add author
                      </button>
                    </div>

                    {showcaseDraft.map((item, index) => (
                      <div key={item.id} className="border border-primary/10 p-6 bg-white">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-5">
                          <h5 className="font-serif text-xl">Card {index + 1}</h5>
                          <button
                            onClick={() => setShowcaseDraft(prev => prev.filter(entry => entry.id !== item.id))}
                            className="px-3 py-2 border border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-2 text-xs uppercase tracking-widest"
                          >
                            <Trash2 size={12} />
                            Remove
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <input value={item.id} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, id: e.target.value } : entry))} className="border border-gray-300 px-4 py-3" placeholder="ID" />
                          <input value={item.initial} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, initial: e.target.value.slice(0, 1).toUpperCase() } : entry))} className="border border-gray-300 px-4 py-3" placeholder="Initial" />
                          <input value={item.nameMain} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, nameMain: e.target.value } : entry))} className="border border-gray-300 px-4 py-3" placeholder="Main name" />
                          <input value={item.nameAccent} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, nameAccent: e.target.value } : entry))} className="border border-gray-300 px-4 py-3" placeholder="Accent name" />
                          <input value={item.years} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, years: e.target.value } : entry))} className="border border-gray-300 px-4 py-3" placeholder="Years" />
                          <input value={item.knownFor} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, knownFor: e.target.value } : entry))} className="border border-gray-300 px-4 py-3" placeholder="Known for" />
                        </div>
                        <div className="mt-5">
                          <ImageField
                            label="Author image"
                            value={item.imageUrl}
                            onChange={value => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, imageUrl: value } : entry))}
                          />
                        </div>
                        <textarea value={item.bio} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, bio: e.target.value } : entry))} rows={4} className="w-full mt-5 border border-gray-300 px-4 py-3" placeholder="Bio" />
                        <input value={item.tags.join(', ')} onChange={e => setShowcaseDraft(prev => prev.map(entry => entry.id === item.id ? { ...entry, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean) } : entry))} className="w-full mt-5 border border-gray-300 px-4 py-3" placeholder="Tags, comma separated" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {activeTab === 'site' && siteDraft ? (
          <section className="bg-white border border-primary/10 p-6 md:p-8 space-y-10">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-3xl font-serif">Site, Header &amp; Footer</h3>
                <p className="mt-2 text-sm text-gray-500">Edit menu items, social links, contacts and bottom footer links. Labels reference translation keys from the «Site Copy» tab (e.g. <code>nav.catalog</code>).</p>
              </div>
              <button onClick={handleSaveSiteSettings} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                {savingKey === 'site-settings' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save site settings
              </button>
            </div>

            {/* Brand */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-4">Brand</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Brand name (footer)</label>
                  <input value={siteDraft.brand.name} onChange={e => setSiteDraft(prev => prev ? { ...prev, brand: { ...prev.brand, name: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Brand short label (header)</label>
                  <input value={siteDraft.brand.short} onChange={e => setSiteDraft(prev => prev ? { ...prev, brand: { ...prev.brand, short: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-4">Contacts (shown in footer)</h4>
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
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Address line 1</label>
                  <input value={siteDraft.contacts.addressLine1} onChange={e => setSiteDraft(prev => prev ? { ...prev, contacts: { ...prev.contacts, addressLine1: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-2">Address line 2</label>
                  <input value={siteDraft.contacts.addressLine2} onChange={e => setSiteDraft(prev => prev ? { ...prev, contacts: { ...prev.contacts, addressLine2: e.target.value } } : prev)} className="w-full border border-gray-300 px-4 py-3" />
                </div>
              </div>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-4">Social links (leave empty to hide)</h4>
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
                headerNav: 'Header menu',
                footerNav: 'Footer link column',
                footerLegal: 'Footer bottom strip (legal)',
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
                      <Plus size={12} /> Add link
                    </button>
                  </div>
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={item.id} className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-3 items-center bg-[#F8F8F5] border border-gray-200 p-3">
                        <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest">
                          <input
                            type="checkbox"
                            checked={item.enabled !== false}
                            onChange={e => updateSiteNav(section, list => list.map(it => it.id === item.id ? { ...it, enabled: e.target.checked } : it))}
                          />
                          On
                        </label>
                        <input
                          value={item.labelKey}
                          onChange={e => updateSiteNav(section, list => list.map(it => it.id === item.id ? { ...it, labelKey: e.target.value } : it))}
                          className="border border-gray-300 px-3 py-2 font-mono text-xs"
                          placeholder="translation key (e.g. nav.catalog)"
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
                          title="Move up"
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
                          title="Move down"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() => updateSiteNav(section, list => list.filter(it => it.id !== item.id))}
                          className="px-2 py-2 border border-red-300 text-red-600 hover:bg-red-50"
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {items.length === 0 ? <p className="text-xs text-gray-400 font-mono">No items.</p> : null}
                  </div>
                </div>
              );
            })}

            {/* Newsletter toggle */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-4">Footer newsletter block</h4>
              <label className="flex items-center gap-3 border border-gray-200 px-4 py-4 max-w-md">
                <input
                  type="checkbox"
                  checked={siteDraft.showNewsletter}
                  onChange={e => setSiteDraft(prev => prev ? { ...prev, showNewsletter: e.target.checked } : prev)}
                />
                <span className="text-sm">Show «Subscribe to newsletter» block in footer</span>
              </label>
            </div>

            {/* Admin password setup */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-[0.22em] text-gray-400 mb-1">Admin Password</h4>
              <p className="text-xs text-gray-500 mb-4">Set or change the password used to log in at /admin. Your current session token (GitHub PAT) is encrypted with this password and stored in the repo.</p>
              <form onSubmit={handleSetPassword} className="max-w-md space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-1">New password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="min 8 chars" autoComplete="new-password" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-widest mb-1">Confirm password</label>
                  <input type="password" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} minLength={8} required className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="repeat password" autoComplete="new-password" />
                </div>
                <button type="submit" disabled={savingPassword} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                  {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save password
                </button>
              </form>
            </div>
          </section>
        ) : null}

        {activeTab === 'payments' ? (
          <section className="bg-white border border-primary/10 p-6 md:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="text-3xl font-serif">Payments and Invoice Flow</h3>
                <p className="mt-2 text-sm text-gray-500">Set the card / transfer details customers will see during checkout and configure where they can send payment proof.</p>
              </div>
              <button onClick={handleSavePaymentSettings} className="px-4 py-3 bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2 text-xs uppercase tracking-widest">
                {savingKey === 'payment-settings' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save payment setup
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <LF label="Recipient / brand name">
                <input value={paymentSettings.recipientName} onChange={e => setPaymentSettings(prev => ({ ...prev, recipientName: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="Invoice prefix (e.g. AM → AM-0001)">
                <input value={paymentSettings.invoicePrefix} onChange={e => setPaymentSettings(prev => ({ ...prev, invoicePrefix: e.target.value.toUpperCase() }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Visa payment URL">
                <input value={paymentSettings.visaPaymentUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, visaPaymentUrl: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
              </LF>
              <LF label="Mastercard payment URL">
                <input value={paymentSettings.mastercardPaymentUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, mastercardPaymentUrl: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
              </LF>
              <LF label="Card cardholder (Visa/MC)">
                <input value={paymentSettings.cardholder} onChange={e => setPaymentSettings(prev => ({ ...prev, cardholder: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="Card number (Visa/MC)">
                <input value={paymentSettings.cardNumber} onChange={e => setPaymentSettings(prev => ({ ...prev, cardNumber: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Bank name">
                <input value={paymentSettings.bankName} onChange={e => setPaymentSettings(prev => ({ ...prev, bankName: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="IBAN / account number">
                <input value={paymentSettings.iban} onChange={e => setPaymentSettings(prev => ({ ...prev, iban: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" />
              </LF>
              <LF label="MIR cardholder">
                <input value={paymentSettings.mirCardholder} onChange={e => setPaymentSettings(prev => ({ ...prev, mirCardholder: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="MIR card number">
                <input value={paymentSettings.mirCardNumber} onChange={e => setPaymentSettings(prev => ({ ...prev, mirCardNumber: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="MIR bank / issuer" className="md:col-span-2">
                <input value={paymentSettings.mirBankName} onChange={e => setPaymentSettings(prev => ({ ...prev, mirBankName: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="WhatsApp (international format, e.g. +49…)">
                <input value={paymentSettings.whatsappNumber} onChange={e => setPaymentSettings(prev => ({ ...prev, whatsappNumber: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Telegram username (without @)">
                <input value={paymentSettings.telegramUsername} onChange={e => setPaymentSettings(prev => ({ ...prev, telegramUsername: e.target.value.replace(/^@/, '') }))} className="w-full border border-gray-300 px-4 py-3 font-mono" />
              </LF>
              <LF label="Contact email" className="md:col-span-2">
                <input type="email" value={paymentSettings.contactEmail} onChange={e => setPaymentSettings(prev => ({ ...prev, contactEmail: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="Webhook label">
                <input value={paymentSettings.webhookLabel} onChange={e => setPaymentSettings(prev => ({ ...prev, webhookLabel: e.target.value }))} className="w-full border border-gray-300 px-4 py-3" />
              </LF>
              <LF label="Webhook URL (Make / n8n / Telegram bridge)" className="md:col-span-2">
                <input value={paymentSettings.webhookUrl} onChange={e => setPaymentSettings(prev => ({ ...prev, webhookUrl: e.target.value }))} className="w-full border border-gray-300 px-4 py-3 font-mono text-sm" placeholder="https://..." />
              </LF>
            </div>

            <LF label="Payment note shown to the customer during checkout">
              <textarea value={paymentSettings.paymentNote} onChange={e => setPaymentSettings(prev => ({ ...prev, paymentNote: e.target.value }))} rows={4} className="w-full border border-gray-300 px-4 py-3" />
            </LF>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 border border-gray-200 px-4 py-4">
                <input type="checkbox" checked={paymentSettings.notifyOnOrderCreated} onChange={e => setPaymentSettings(prev => ({ ...prev, notifyOnOrderCreated: e.target.checked }))} />
                <span className="text-sm">Send webhook on new order</span>
              </label>
              <label className="flex items-center gap-3 border border-gray-200 px-4 py-4">
                <input type="checkbox" checked={paymentSettings.notifyOnPaymentConfirmed} onChange={e => setPaymentSettings(prev => ({ ...prev, notifyOnPaymentConfirmed: e.target.checked }))} />
                <span className="text-sm">Send webhook when payment is marked paid</span>
              </label>
            </div>

            <div className="border border-primary/10 bg-[#F8F8F5] p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gray-400 mb-4">Recommended flow</p>
              <div className="space-y-3 text-sm text-gray-700">
                <p>1. Customer places the order with `Visa`, `Mastercard`, `Invoice`, or `MIR`.</p>
                <p>2. The order is created first and forwarded to your webhook immediately.</p>
                <p>3. For Visa / Mastercard the customer continues to your external payment link.</p>
                <p>4. For Invoice / MIR the customer pays manually and sends proof to WhatsApp, Telegram, or email.</p>
                <p>5. You confirm the payment in the `Orders` tab by changing `payment status` to `paid`.</p>
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
                <h3 className="text-3xl font-serif">Orders</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={refreshOrders} className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
                    <RefreshCw size={14} />
                    Refresh
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await contentStore.loadOrdersFromGitHub();
                        refreshOrders();
                        showToast('Orders loaded from GitHub', 'success');
                      } catch (e) {
                        showToast('Failed to load from GitHub', 'error');
                      }
                    }}
                    className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download size={14} />
                    Load from GitHub
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await contentStore.syncOrdersToGitHub();
                        showToast('Orders synced to GitHub', 'success');
                      } catch (e) {
                        showToast('Sync failed — check PAT', 'error');
                      }
                    }}
                    className="px-4 py-3 text-xs uppercase tracking-widest border border-primary bg-primary text-white hover:bg-accent hover:text-primary flex items-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Sync to GitHub
                  </button>
                  <button onClick={() => exportOrdersCSV(filteredOrders)} className="px-4 py-3 text-xs uppercase tracking-widest border border-gray-300 hover:bg-gray-50 flex items-center gap-2">
                    <Download size={14} />
                    CSV
                  </button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Search by ID, name or email…" className="flex-1 border border-gray-300 px-4 py-2 text-sm" />
                <div className="flex gap-1 flex-wrap">
                  {['all','pending','processing','shipped','delivered','cancelled'].map(s => (
                    <button key={s} onClick={() => setOrderStatusFilter(s)} className={`px-3 py-2 text-[10px] uppercase tracking-widest border ${orderStatusFilter === s ? 'bg-primary text-white border-primary' : 'border-gray-200 hover:bg-gray-50'}`}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-1">
                  {['all','pending','paid','failed','refunded'].map(s => (
                    <button key={s} onClick={() => setOrderPaymentFilter(s)} className={`px-3 py-2 text-[10px] uppercase tracking-widest border ${orderPaymentFilter === s ? 'bg-accent text-primary border-accent' : 'border-gray-200 hover:bg-gray-50'}`}>{s === 'all' ? '€ all' : s}</button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex gap-6 text-sm text-gray-500">
                <span><span className="font-bold text-primary">{filteredOrders.length}</span> orders</span>
                {paidRevenue > 0 && <span>Paid revenue: <span className="font-bold text-green-700">€{paidRevenue.toFixed(2)}</span></span>}
              </div>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F4F4F0]">
                  <tr className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                    <th className="p-4">Order</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Items</th>
                    <th className="p-4">Total</th>
                    <th className="p-4">Flow</th>
                    <th className="p-4">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map(order => (
                    <React.Fragment key={order.id}>
                    <tr className="border-t border-gray-100 align-top">
                      <td className="p-4">
                        <div className="font-bold">{order.id}</div>
                        <div className="text-xs text-gray-400">{new Date(order.date).toLocaleString()}</div>
                      </td>
                      <td className="p-4">
                        <div>{order.customer.name}</div>
                        <div className="text-xs text-gray-400">{order.customer.email}</div>
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
                            Payment: <span className="text-primary">{order.paymentStatus}</span>
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
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <select
                            value={order.paymentStatus}
                            onChange={e => handlePaymentStatusChange(order.id, e.target.value as PaymentStatus)}
                            className="border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="pending">Payment pending</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                          </select>
                          {(savingKey === `order:${order.id}` || savingKey === `payment:${order.id}`) ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} className="text-green-600" />}
                        </div>
                      </td>
                    </tr>
                    {order.diagnostics ? (
                      <tr className="border-t border-dashed border-gray-100 bg-[#F8F8F4]">
                        <td colSpan={6} className="p-4">
                          <details className="text-xs">
                            <summary className="cursor-pointer font-mono uppercase tracking-[0.2em] text-gray-500 hover:text-primary">
                              Diagnostics · {order.diagnostics.ip || 'IP n/a'}
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
      </main>
    </div>
  );
};
