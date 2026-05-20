import { Book, Language, LocalizedCatalogData, NewsItem, Order, OrderPayload, PaymentSettings, PaymentStatus, SiteSettings, TranslationOverrides } from '../types';
import { DATABASE, MOCK_ORDERS } from '../constants';

const GH_OWNER = 'munister-v';
const GH_REPO = 'ampublishing';
const GH_BRANCH = 'main';
const GH_API = 'https://api.github.com';

const CONTENT_BASE = `${import.meta.env.BASE_URL}content/`;
const PAT_KEY = 'gh_pat';

const ORDERS_KEY = 'am-orders-v1';
const ORDER_DRAFTS_KEY = 'am-pending-publish-v1';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// ----------------- GitHub Contents API helpers -----------------

const getPAT = (): string | null => {
  try {
    return sessionStorage.getItem(PAT_KEY) || localStorage.getItem(PAT_KEY);
  } catch {
    return null;
  }
};

const utf8ToBase64 = (text: string): string => {
  // Browsers' btoa() handles only Latin-1; encode UTF-8 first.
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const ghHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

export const verifyPAT = async (token: string): Promise<{ login: string } | null> => {
  try {
    const res = await fetch(`${GH_API}/user`, { headers: ghHeaders(token) });
    if (!res.ok) return null;
    const data = await res.json();
    return { login: data.login };
  } catch {
    return null;
  }
};

const ghGetFileSha = async (path: string): Promise<string | null> => {
  const token = getPAT();
  if (!token) return null;
  try {
    const res = await fetch(
      `${GH_API}/repos/${GH_OWNER}/${GH_REPO}/contents/${path}?ref=${GH_BRANCH}`,
      { headers: ghHeaders(token) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha as string;
  } catch {
    return null;
  }
};

const ghWriteFile = async (path: string, jsonContent: any, message: string): Promise<void> => {
  const token = getPAT();
  if (!token) throw new Error('Admin not authenticated (no GitHub PAT)');
  const sha = await ghGetFileSha(path);
  const body: Record<string, any> = {
    message,
    content: utf8ToBase64(JSON.stringify(jsonContent, null, 2) + '\n'),
    branch: GH_BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${GH_API}/repos/${GH_OWNER}/${GH_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub write failed (${res.status}): ${errText.slice(0, 300)}`);
  }
};

// ----------------- Public JSON fetch (no auth) -----------------

const fetchContent = async <T,>(filename: string, fallback: T): Promise<T> => {
  try {
    const res = await fetch(`${CONTENT_BASE}${filename}`, { cache: 'no-cache' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
};

// ----------------- In-memory cache -----------------

type CacheState = {
  database: Record<Language, LocalizedCatalogData> | null;
  overrides: TranslationOverrides | null;
  paymentSettings: PaymentSettings | null;
  siteSettings: SiteSettings | null;
  loaded: boolean;
  loadingPromise: Promise<void> | null;
};

const cache: CacheState = {
  database: null,
  overrides: null,
  paymentSettings: null,
  siteSettings: null,
  loaded: false,
  loadingPromise: null,
};

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  social: {
    telegramUrl: 'https://t.me/ampublishingberlin',
    instagramUrl: 'https://www.instagram.com/am.publishing?igsh=b2JoMDZqdDJzMXdj',
    facebookUrl: '',
    youtubeUrl: '',
    twitterUrl: '',
  },
  contacts: {
    email: 'am.hybridpublishing@gmail.com',
    phone: '',
    addressLine1: 'AM Publishing Berlin',
    addressLine2: '',
  },
  headerNav: [
    { id: 'h-catalog', labelKey: 'nav.catalog', path: '/catalog', enabled: true },
    { id: 'h-our-authors', labelKey: 'nav.our_authors', path: '/our-authors', enabled: true },
    { id: 'h-authors', labelKey: 'nav.authors', path: '/authors', enabled: true },
    { id: 'h-about', labelKey: 'nav.about', path: '/about', enabled: true },
    { id: 'h-media', labelKey: 'nav.media', path: '/media', enabled: true },
  ],
  footerNav: [
    { id: 'f-catalog', labelKey: 'nav.catalog', path: '/catalog', enabled: true },
    { id: 'f-our-authors', labelKey: 'nav.our_authors', path: '/our-authors', enabled: true },
    { id: 'f-authors', labelKey: 'nav.authors', path: '/authors', enabled: true },
    { id: 'f-about', labelKey: 'nav.about', path: '/about', enabled: true },
    { id: 'f-media', labelKey: 'nav.media', path: '/media', enabled: true },
  ],
  footerLegal: [
    { id: 'l-impressum', labelKey: 'footer.links.impressum', path: '/impressum', enabled: true },
    { id: 'l-privacy', labelKey: 'footer.links.privacy', path: '/privacy', enabled: true },
    { id: 'l-terms', labelKey: 'footer.links.terms', path: '/terms', enabled: true },
  ],
  showNewsletter: true,
  brand: {
    name: 'AM Publishing',
    short: 'AM Pub.',
  },
};

const mergeSiteSettings = (incoming: Partial<SiteSettings> | null | undefined): SiteSettings => {
  if (!incoming) return clone(DEFAULT_SITE_SETTINGS);
  return {
    social: { ...DEFAULT_SITE_SETTINGS.social, ...(incoming.social || {}) },
    contacts: { ...DEFAULT_SITE_SETTINGS.contacts, ...(incoming.contacts || {}) },
    headerNav: Array.isArray(incoming.headerNav) && incoming.headerNav.length
      ? incoming.headerNav.map(item => ({ enabled: true, ...item }))
      : clone(DEFAULT_SITE_SETTINGS.headerNav),
    footerNav: Array.isArray(incoming.footerNav) && incoming.footerNav.length
      ? incoming.footerNav.map(item => ({ enabled: true, ...item }))
      : clone(DEFAULT_SITE_SETTINGS.footerNav),
    footerLegal: Array.isArray(incoming.footerLegal) && incoming.footerLegal.length
      ? incoming.footerLegal.map(item => ({ enabled: true, ...item }))
      : clone(DEFAULT_SITE_SETTINGS.footerLegal),
    showNewsletter: typeof incoming.showNewsletter === 'boolean' ? incoming.showNewsletter : DEFAULT_SITE_SETTINGS.showNewsletter,
    brand: { ...DEFAULT_SITE_SETTINGS.brand, ...(incoming.brand || {}) },
  };
};

const computeMetadata = (books: Book[]) => ({
  genres: Array.from(new Set(books.flatMap(book => book.genre))).filter(Boolean).sort(),
  authors: Array.from(new Set(books.map(book => book.author))).filter(Boolean).sort(),
  series: Array.from(new Set(books.map(book => book.series).filter(Boolean) as string[])).sort(),
});

const normalizeLanguageData = (
  books: Book[],
  news: NewsItem[],
): LocalizedCatalogData => {
  const meta = computeMetadata(books);
  return { books, news, ...meta };
};

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  recipientName: 'AM Publishing',
  visaPaymentUrl: '',
  mastercardPaymentUrl: '',
  cardholder: 'AM PUBLISHING',
  cardNumber: '',
  bankName: 'Revolut Bank UAB · BIC REVOLT21',
  iban: 'LT47 3250 0072 6895 2728',
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
};

const ensureLoaded = async (): Promise<void> => {
  if (cache.loaded) return;
  if (cache.loadingPromise) return cache.loadingPromise;

  cache.loadingPromise = (async () => {
    const fallbackBooks = (lang: Language): Book[] => clone(DATABASE[lang].books);
    const fallbackNews = (lang: Language): NewsItem[] => clone(DATABASE[lang].news);

    const [bru, ben, bde, nru, nen, nde, oru, oen, ode, pay, site] = await Promise.all([
      fetchContent<Book[]>('books.ru.json', fallbackBooks('ru')),
      fetchContent<Book[]>('books.en.json', fallbackBooks('en')),
      fetchContent<Book[]>('books.de.json', fallbackBooks('de')),
      fetchContent<NewsItem[]>('news.ru.json', fallbackNews('ru')),
      fetchContent<NewsItem[]>('news.en.json', fallbackNews('en')),
      fetchContent<NewsItem[]>('news.de.json', fallbackNews('de')),
      fetchContent<Record<string, any>>('translation-overrides.ru.json', {}),
      fetchContent<Record<string, any>>('translation-overrides.en.json', {}),
      fetchContent<Record<string, any>>('translation-overrides.de.json', {}),
      fetchContent<PaymentSettings>('payment-settings.json', DEFAULT_PAYMENT_SETTINGS),
      fetchContent<Partial<SiteSettings> | null>('site-settings.json', null),
    ]);

    cache.database = {
      ru: normalizeLanguageData(bru, nru),
      en: normalizeLanguageData(ben, nen),
      de: normalizeLanguageData(bde, nde),
    };
    cache.overrides = { ru: oru || {}, en: oen || {}, de: ode || {} };
    cache.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS, ...(pay || {}) };
    cache.siteSettings = mergeSiteSettings(site);
    cache.loaded = true;
  })();

  return cache.loadingPromise;
};

const resetMetadata = (lang: Language) => {
  if (!cache.database) return;
  const data = cache.database[lang];
  cache.database[lang] = normalizeLanguageData(data.books, data.news);
};

// ----------------- Orders (localStorage-only for now; Phase 5 redirects to email) -----------------

const getOrdersStorage = (): Order[] => {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return clone(MOCK_ORDERS);
    return JSON.parse(raw);
  } catch {
    return clone(MOCK_ORDERS);
  }
};

const saveOrdersStorage = (orders: Order[]) => {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // ignore quota errors
  }
  return orders;
};

// ----------------- Public store API -----------------

export const contentStore = {
  isAuthenticated(): boolean {
    return !!getPAT();
  },

  setPAT(token: string, persist = false) {
    try {
      sessionStorage.setItem(PAT_KEY, token);
      if (persist) localStorage.setItem(PAT_KEY, token);
      else localStorage.removeItem(PAT_KEY);
    } catch {
      // ignore
    }
  },

  clearPAT() {
    try {
      sessionStorage.removeItem(PAT_KEY);
      localStorage.removeItem(PAT_KEY);
    } catch {
      // ignore
    }
  },

  async getDatabase(): Promise<Record<Language, LocalizedCatalogData>> {
    await ensureLoaded();
    return clone(cache.database!);
  },

  async refresh() {
    cache.loaded = false;
    cache.loadingPromise = null;
    await ensureLoaded();
  },

  async upsertBook(language: Language, book: Book) {
    await ensureLoaded();
    const langBooks = cache.database![language].books;
    const idx = langBooks.findIndex(b => b.id === book.id);
    if (idx >= 0) langBooks[idx] = book;
    else langBooks.unshift(book);
    resetMetadata(language);

    await ghWriteFile(
      `public/content/books.${language}.json`,
      langBooks,
      `admin: upsert book ${book.id} (${language})`,
    );
    return clone(cache.database!);
  },

  async deleteBook(language: Language, bookId: string) {
    await ensureLoaded();
    cache.database![language].books = cache.database![language].books.filter(b => b.id !== bookId);
    resetMetadata(language);

    await ghWriteFile(
      `public/content/books.${language}.json`,
      cache.database![language].books,
      `admin: delete book ${bookId} (${language})`,
    );
    return clone(cache.database!);
  },

  async upsertNewsItem(language: Language, item: NewsItem) {
    await ensureLoaded();
    const langNews = cache.database![language].news;
    const idx = langNews.findIndex(n => n.id === item.id);
    if (idx >= 0) langNews[idx] = item;
    else langNews.unshift(item);

    await ghWriteFile(
      `public/content/news.${language}.json`,
      langNews,
      `admin: upsert news ${item.id} (${language})`,
    );
    return clone(cache.database!);
  },

  async deleteNewsItem(language: Language, itemId: string) {
    await ensureLoaded();
    cache.database![language].news = cache.database![language].news.filter(n => n.id !== itemId);

    await ghWriteFile(
      `public/content/news.${language}.json`,
      cache.database![language].news,
      `admin: delete news ${itemId} (${language})`,
    );
    return clone(cache.database!);
  },

  async getTranslationOverrides(): Promise<TranslationOverrides> {
    await ensureLoaded();
    return clone(cache.overrides!);
  },

  async setTranslationValue(language: Language, key: string, value: any) {
    await ensureLoaded();
    cache.overrides![language] = cache.overrides![language] || {};
    cache.overrides![language][key] = value;

    await ghWriteFile(
      `public/content/translation-overrides.${language}.json`,
      cache.overrides![language],
      `admin: set ${key} (${language})`,
    );
    return clone(cache.overrides!);
  },

  async resetTranslationValue(language: Language, key: string) {
    await ensureLoaded();
    if (cache.overrides![language]) {
      delete cache.overrides![language][key];
    }
    await ghWriteFile(
      `public/content/translation-overrides.${language}.json`,
      cache.overrides![language] || {},
      `admin: reset ${key} (${language})`,
    );
    return clone(cache.overrides!);
  },

  async getSiteSettings(): Promise<SiteSettings> {
    await ensureLoaded();
    return clone(cache.siteSettings!);
  },

  async saveSiteSettings(settings: SiteSettings): Promise<SiteSettings> {
    await ensureLoaded();
    cache.siteSettings = mergeSiteSettings(settings);
    await ghWriteFile(
      `public/content/site-settings.json`,
      cache.siteSettings,
      `admin: update site settings (header/footer/menu/contacts)`,
    );
    return clone(cache.siteSettings);
  },

  async getPaymentSettings(): Promise<PaymentSettings> {
    await ensureLoaded();
    return clone(cache.paymentSettings!);
  },

  async savePaymentSettings(settings: PaymentSettings) {
    await ensureLoaded();
    cache.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS, ...settings };
    await ghWriteFile(
      `public/content/payment-settings.json`,
      cache.paymentSettings,
      `admin: update payment settings`,
    );
    return clone(cache.paymentSettings);
  },

  async exportContent() {
    await ensureLoaded();
    return {
      database: clone(cache.database!),
      overrides: clone(cache.overrides!),
      orders: getOrdersStorage(),
      paymentSettings: clone(cache.paymentSettings!),
      siteSettings: clone(cache.siteSettings!),
      exportedAt: new Date().toISOString(),
      version: 4,
    };
  },

  async importContent(payload: {
    database?: Record<Language, LocalizedCatalogData>;
    overrides?: TranslationOverrides;
    orders?: Order[];
    paymentSettings?: PaymentSettings;
    siteSettings?: SiteSettings;
  }) {
    await ensureLoaded();
    const commits: Promise<void>[] = [];

    if (payload.database) {
      for (const lang of ['ru', 'en', 'de'] as Language[]) {
        const data = payload.database[lang];
        if (!data) continue;
        cache.database![lang] = normalizeLanguageData(data.books, data.news);
        commits.push(
          ghWriteFile(`public/content/books.${lang}.json`, data.books, `admin: import books (${lang})`),
        );
        commits.push(
          ghWriteFile(`public/content/news.${lang}.json`, data.news, `admin: import news (${lang})`),
        );
      }
    }
    if (payload.overrides) {
      for (const lang of ['ru', 'en', 'de'] as Language[]) {
        cache.overrides![lang] = payload.overrides[lang] || {};
        commits.push(
          ghWriteFile(
            `public/content/translation-overrides.${lang}.json`,
            cache.overrides![lang],
            `admin: import overrides (${lang})`,
          ),
        );
      }
    }
    if (payload.paymentSettings) {
      cache.paymentSettings = { ...DEFAULT_PAYMENT_SETTINGS, ...payload.paymentSettings };
      commits.push(
        ghWriteFile(
          `public/content/payment-settings.json`,
          cache.paymentSettings,
          `admin: import payment settings`,
        ),
      );
    }
    if (payload.siteSettings) {
      cache.siteSettings = mergeSiteSettings(payload.siteSettings);
      commits.push(
        ghWriteFile(
          `public/content/site-settings.json`,
          cache.siteSettings,
          `admin: import site settings`,
        ),
      );
    }
    if (payload.orders) {
      saveOrdersStorage(payload.orders);
    }

    await Promise.all(commits);
    return this.exportContent();
  },

  // --- Orders: local-only until Phase 5 ---

  getOrders(): Order[] {
    return clone(getOrdersStorage());
  },

  saveOrders(orders: Order[]) {
    return saveOrdersStorage(clone(orders));
  },

  createOrder(payload: OrderPayload): Order {
    if (!cache.loaded) {
      // Should be loaded by the time checkout runs; fallback to bundled DB.
    }
    const db = cache.database || DATABASE;
    const books = [...db.ru.books, ...db.en.books, ...db.de.books];
    const paymentPrefix =
      payload.customer.paymentMethod === 'amazon'
        ? 'AMZ'
        : payload.customer.paymentMethod === 'mir'
          ? 'MIR'
          : payload.customer.paymentMethod === 'visa'
            ? 'VIS'
            : payload.customer.paymentMethod === 'mastercard'
              ? 'MCR'
              : 'INV';
    const paymentReference = `${paymentPrefix}-${Date.now().toString().slice(-6)}`;
    const items = payload.items.map(item => {
      const book = books.find(entry => entry.variants.some(variant => variant.id === item.variantId));
      const variant = book?.variants.find(entry => entry.id === item.variantId);
      return {
        variantId: item.variantId,
        bookTitle: book?.title || item.variantId,
        quantity: item.quantity,
        priceAtPurchase: variant?.price || 0,
      };
    });

    const invoicePrefix = cache.paymentSettings?.invoicePrefix || 'AM';
    const nextOrder: Order = {
      id: `${invoicePrefix}-${Math.floor(Math.random() * 100000)}`,
      date: new Date().toISOString(),
      customer: {
        name: `${payload.customer.firstName} ${payload.customer.lastName}`.trim(),
        email: payload.customer.email,
        phone: payload.customer.phone,
        location: [payload.customer.city, payload.customer.country].filter(Boolean).join(', '),
        addressLine: payload.customer.address,
        zip: payload.customer.zip,
        country: payload.customer.country,
      },
      items,
      total: payload.totalAmount,
      currency: payload.currency,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: payload.customer.paymentMethod,
      paymentReference,
      diagnostics: payload.diagnostics,
    };
    const orders = getOrdersStorage();
    orders.unshift(nextOrder);
    saveOrdersStorage(orders);
    return nextOrder;
  },

  updateOrderStatus(orderId: string, status: Order['status']) {
    const orders = getOrdersStorage().map(o => (o.id === orderId ? { ...o, status } : o));
    return saveOrdersStorage(orders);
  },

  updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
    const orders = getOrdersStorage().map(o =>
      o.id === orderId ? { ...o, paymentStatus } : o,
    );
    return saveOrdersStorage(orders);
  },
};
