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

// ----------------- Write log (for admin StatusPanel) -----------------

export type WriteLogEntry = {
  ts: number;
  path: string;
  message: string;
  status: 'ok' | 'error' | 'retry';
  error?: string;
  durationMs?: number;
  sha?: string;
};

const writeLog: WriteLogEntry[] = [];
const WRITE_LOG_MAX = 30;

const pushLog = (entry: WriteLogEntry) => {
  writeLog.unshift(entry);
  if (writeLog.length > WRITE_LOG_MAX) writeLog.pop();
};

// ----------------- GitHub Contents API helpers -----------------

// SHA cache: after a successful write, cache the response SHA so the next
// write to the same file skips the extra GET (avoids 409 stale-SHA conflict)
const shaCache = new Map<string, string>();

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

const ghGetFileSha = async (path: string, token: string): Promise<string | null> => {
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

/**
 * Write a JSON file to the repo via the GitHub Contents API.
 * - Uses a SHA cache populated from previous write responses to avoid a
 *   redundant GET before each PUT (and to prevent 409 stale-SHA conflicts
 *   when writes happen in rapid succession).
 * - On a 409 conflict it clears the cache, re-fetches the live SHA, and
 *   retries once automatically — so the user never has to click twice.
 */
const ghWriteFile = async (path: string, jsonContent: any, message: string, _attempt = 0): Promise<void> => {
  const token = getPAT();
  if (!token) throw new Error('Admin not authenticated (no GitHub PAT)');

  const t0 = Date.now();

  // Prefer the SHA we got from our last successful write (avoids extra GET
  // and guarantees we have the up-to-date SHA even for rapid back-to-back writes).
  let sha: string | null;
  if (shaCache.has(path)) {
    sha = shaCache.get(path)!;
    shaCache.delete(path);
  } else {
    sha = await ghGetFileSha(path, token);
  }

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

  // 409 = SHA conflict (stale cache or concurrent write) — retry once with a fresh SHA
  if (res.status === 409 && _attempt === 0) {
    pushLog({ ts: Date.now(), path, message, status: 'retry', durationMs: Date.now() - t0, error: '409 conflict — retrying with fresh SHA' });
    shaCache.delete(path);
    return ghWriteFile(path, jsonContent, message, 1);
  }

  if (!res.ok) {
    const errText = await res.text();
    const err = `GitHub write failed (${res.status}): ${errText.slice(0, 200)}`;
    pushLog({ ts: Date.now(), path, message, status: 'error', durationMs: Date.now() - t0, error: err });
    throw new Error(err);
  }

  // Cache the new SHA from the response so the next write to this file can
  // skip the GET entirely (important for delete-EN + delete-DE chains).
  try {
    const data = await res.json();
    const newSha: string | undefined = data.content?.sha;
    if (newSha) shaCache.set(path, newSha);
    pushLog({ ts: Date.now(), path, message, status: 'ok', durationMs: Date.now() - t0, sha: newSha?.slice(0, 7) });
  } catch {
    pushLog({ ts: Date.now(), path, message, status: 'ok', durationMs: Date.now() - t0 });
  }
};

const ghWriteBinaryFile = async (path: string, base64Content: string, message: string): Promise<string> => {
  const token = getPAT();
  if (!token) throw new Error('Admin not authenticated (no GitHub PAT)');
  const sha = shaCache.get(path) || await ghGetFileSha(path, token);
  shaCache.delete(path);
  const body: Record<string, any> = { message, content: base64Content, branch: GH_BRANCH };
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
  const data = await res.json();
  return data.content?.download_url || `https://raw.githubusercontent.com/${GH_OWNER}/${GH_REPO}/${GH_BRANCH}/${path}`;
};

// ----------------- Public JSON fetch (no auth) -----------------

const fetchContent = async <T,>(filename: string, fallback: T): Promise<T> => {
  try {
    const res = await fetch(`${CONTENT_BASE}${filename}`, { cache: 'no-cache' });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch (e) {
    // A malformed JSON file (e.g. an auto-translate pipeline emitting an
    // unescaped quote) used to fail silently here, quietly dropping every
    // override/entry for that language back to the fallback. Surface it so
    // a broken translate run doesn't look like "this language has no data".
    console.error(`[contentStore] Failed to load/parse ${filename} — falling back.`, e);
    return fallback;
  }
};

const keepFallbackWhenEmpty = <T,>(items: T[], fallback: T[]): T[] =>
  items.length > 0 ? items : fallback;

// ----------------- Override warm-cache (survives page refresh, bridges CDN lag) -----------------
// After each write, the latest overrides are persisted to localStorage so that on the next
// page load they take precedence over a potentially stale CDN response.

const OVERRIDE_WARM_KEY = 'am-override-warm-v1';
const OVERRIDE_WARM_TTL = 60 * 60 * 1000; // 1 hour

type OverrideWarmEntry = { ts: number; data: TranslationOverrides };

const saveOverrideWarmCache = (overrides: TranslationOverrides) => {
  try {
    const entry: OverrideWarmEntry = { ts: Date.now(), data: overrides };
    localStorage.setItem(OVERRIDE_WARM_KEY, JSON.stringify(entry));
  } catch { /* storage full or SSR */ }
};

const loadOverrideWarmCache = (): TranslationOverrides | null => {
  try {
    const raw = localStorage.getItem(OVERRIDE_WARM_KEY);
    if (!raw) return null;
    const entry: OverrideWarmEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > OVERRIDE_WARM_TTL) {
      localStorage.removeItem(OVERRIDE_WARM_KEY);
      return null;
    }
    return entry.data;
  } catch { return null; }
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

export const computeMetadata = (books: Book[]) => ({
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

    const ruBooks = keepFallbackWhenEmpty(bru, fallbackBooks('ru'));
    const enBooks = keepFallbackWhenEmpty(ben, ruBooks);
    const deBooks = keepFallbackWhenEmpty(bde, ruBooks);

    cache.database = {
      ru: normalizeLanguageData(
        ruBooks,
        keepFallbackWhenEmpty(nru, fallbackNews('ru')),
      ),
      en: normalizeLanguageData(
        enBooks,
        keepFallbackWhenEmpty(nen, fallbackNews('en')),
      ),
      de: normalizeLanguageData(
        deBooks,
        keepFallbackWhenEmpty(nde, fallbackNews('de')),
      ),
    };
    // Merge warm-cache over CDN response so a stale CDN doesn't wipe recently-saved values
    const warm = loadOverrideWarmCache();
    cache.overrides = {
      ru: { ...(oru || {}), ...(warm?.ru || {}) },
      en: { ...(oen || {}), ...(warm?.en || {}) },
      de: { ...(ode || {}), ...(warm?.de || {}) },
    };
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

  /** Write any JSON file to the repo. Used by api.ts to save admin-auth.json. */
  async ghWritePublicFile(path: string, content: any, message: string): Promise<void> {
    return ghWriteFile(path, content, message);
  },

  /**
   * Upload an image (as base64 data URL) to the repo's public/images/uploads/ folder.
   * Returns the public path (/images/uploads/<filename>) suitable for use in content JSON.
   */
  async uploadImage(filename: string, dataUrl: string): Promise<string> {
    const base64 = dataUrl.split(',')[1];
    if (!base64) throw new Error('Invalid image data URL');
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `public/images/uploads/${safeName}`;
    const rawUrl = await ghWriteBinaryFile(path, base64, `admin: upload image ${safeName}`);
    return rawUrl;
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

  /** Returns a copy of recent GitHub write operations for the StatusPanel. */
  getWriteLog(): WriteLogEntry[] {
    return [...writeLog];
  },

  /** Fetch GitHub API rate-limit info for the current PAT. */
  async getRateLimit(): Promise<{ used: number; remaining: number; limit: number; resetsAt: number } | null> {
    const token = getPAT();
    if (!token) return null;
    try {
      const res = await fetch(`${GH_API}/rate_limit`, { headers: ghHeaders(token) });
      if (!res.ok) return null;
      const data = await res.json();
      const core = data.resources?.core;
      if (!core) return null;
      return {
        used: core.used,
        remaining: core.remaining,
        limit: core.limit,
        resetsAt: core.reset * 1000, // convert Unix seconds to ms
      };
    } catch {
      return null;
    }
  },

  /** Quick snapshot of cache contents — books/news counts per language. */
  getCacheSnapshot(): { loaded: boolean; ru: { books: number; news: number }; en: { books: number; news: number }; de: { books: number; news: number } } {
    const empty = { books: 0, news: 0 };
    if (!cache.database) return { loaded: false, ru: empty, en: empty, de: empty };
    return {
      loaded: cache.loaded,
      ru: { books: cache.database.ru.books.length, news: cache.database.ru.news.length },
      en: { books: cache.database.en.books.length, news: cache.database.en.news.length },
      de: { books: cache.database.de.books.length, news: cache.database.de.news.length },
    };
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
    saveOverrideWarmCache(cache.overrides!); // persist so page refresh survives CDN lag
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
    saveOverrideWarmCache(cache.overrides!); // persist so reset also survives CDN lag
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
    if (payload.overrides) saveOverrideWarmCache(cache.overrides!); // warm-cache after bulk import
    return this.exportContent();
  },

  // --- Orders ---

  getOrders(): Order[] {
    return clone(getOrdersStorage());
  },

  saveOrders(orders: Order[]) {
    return saveOrdersStorage(clone(orders));
  },

  /**
   * Sync orders from localStorage to GitHub (admin-only, requires PAT).
   * Stored at public/content/orders.json — NOT served to the public site,
   * but readable by the admin panel for cross-device order management.
   */
  async syncOrdersToGitHub(): Promise<void> {
    const orders = getOrdersStorage();
    await ghWriteFile(
      'public/content/orders.json',
      orders,
      `admin: sync ${orders.length} order(s)`,
    );
  },

  /**
   * Load orders from GitHub and merge with localStorage (admin use).
   * Takes the union, deduped by id, preferring the more recent status.
   */
  async loadOrdersFromGitHub(): Promise<Order[]> {
    try {
      const remote = await fetchContent<Order[]>('orders.json', []);
      if (!remote.length) return getOrdersStorage();
      const local = getOrdersStorage();
      const merged = [...remote];
      for (const lo of local) {
        if (!merged.find(r => r.id === lo.id)) merged.push(lo);
      }
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      saveOrdersStorage(merged);
      return clone(merged);
    } catch {
      return getOrdersStorage();
    }
  },

  createOrder(payload: OrderPayload): Order {
    if (!cache.loaded) {
      // Should be loaded by the time checkout runs; fallback to bundled DB.
    }
    const db = cache.database || DATABASE;
    const books = [...db.ru.books, ...db.en.books, ...db.de.books];
    const paymentPrefix =
      payload.customer.paymentMethod === 'mir'
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
