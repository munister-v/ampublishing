import {
  Book,
  NewsItem,
  Language,
  OrderPayload,
  ApiResponse,
  OrderResponse,
  Order,
  OrderStatus,
  LocalizedCatalogData,
  PaymentSettings,
  PaymentStatus,
  SiteSettings,
  TranslationOverrides,
} from '../types';
import { contentStore, verifyPAT } from './contentStore';
import { notifyOrderChannels } from './orderNotifications';
import { decryptPAT, encryptPAT, type AdminAuthConfig } from './adminAuth';

const ADMIN_EMAIL = 'admin@ampublishing.org';
const ADMIN_AUTH_FILE = 'public/content/admin-auth.json';

/** Fetch and return the stored AdminAuthConfig, or null if not yet set up. */
async function fetchAuthConfig(): Promise<AdminAuthConfig | null> {
  try {
    const res = await fetch(`/content/admin-auth.json?_=${Date.now()}`);
    if (!res.ok) return null;
    return await res.json() as AdminAuthConfig;
  } catch {
    return null;
  }
}

/** Write the AdminAuthConfig to the repo via the GitHub API. Requires a valid PAT already stored. */
async function saveAuthConfig(config: AdminAuthConfig): Promise<void> {
  await contentStore.ghWritePublicFile(
    ADMIN_AUTH_FILE,
    config,
    'admin: store encrypted credentials',
  );
}

const LOGIN_ATTEMPTS_KEY = 'am_auth_state';
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

type LoginState = { failures: number; lockedUntil: number };

const readLoginState = (): LoginState => {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return { failures: 0, lockedUntil: 0 };
    const parsed = JSON.parse(raw);
    return {
      failures: Number(parsed.failures) || 0,
      lockedUntil: Number(parsed.lockedUntil) || 0,
    };
  } catch {
    return { failures: 0, lockedUntil: 0 };
  }
};

const writeLoginState = (state: LoginState) => {
  try {
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
};

export const api = {
  healthCheck: async (): Promise<boolean> => true,

  // --- PUBLIC ENDPOINTS ---

  getBooks: async (lang: Language): Promise<Book[]> => {
    const db = await contentStore.getDatabase();
    return db[lang].books;
  },

  getNews: async (lang: Language): Promise<NewsItem[]> => {
    const db = await contentStore.getDatabase();
    return db[lang].news;
  },

  getMetadata: async (lang: Language) => {
    const db = await contentStore.getDatabase();
    return {
      genres: db[lang].genres,
      authors: db[lang].authors,
      series: db[lang].series,
    };
  },

  getContentDatabase: async (): Promise<Record<Language, LocalizedCatalogData>> => {
    return contentStore.getDatabase();
  },

  upsertBook: async (lang: Language, book: Book) => contentStore.upsertBook(lang, book),

  deleteBook: async (lang: Language, bookId: string) => contentStore.deleteBook(lang, bookId),

  upsertNewsItem: async (lang: Language, item: NewsItem) => contentStore.upsertNewsItem(lang, item),

  deleteNewsItem: async (lang: Language, itemId: string) =>
    contentStore.deleteNewsItem(lang, itemId),

  getTranslationOverrides: async (): Promise<TranslationOverrides> =>
    contentStore.getTranslationOverrides(),

  setTranslationValue: async (lang: Language, key: string, value: any) =>
    contentStore.setTranslationValue(lang, key, value),

  resetTranslationValue: async (lang: Language, key: string) =>
    contentStore.resetTranslationValue(lang, key),

  exportContentBundle: async () => contentStore.exportContent(),

  importContentBundle: async (payload: {
    database?: Record<Language, LocalizedCatalogData>;
    overrides?: TranslationOverrides;
  }) => contentStore.importContent(payload),

  getPaymentSettings: async (): Promise<PaymentSettings> => contentStore.getPaymentSettings(),

  savePaymentSettings: async (settings: PaymentSettings): Promise<PaymentSettings> =>
    contentStore.savePaymentSettings(settings),

  getSiteSettings: async (): Promise<SiteSettings> => contentStore.getSiteSettings(),

  saveSiteSettings: async (settings: SiteSettings): Promise<SiteSettings> =>
    contentStore.saveSiteSettings(settings),

  submitOrder: async (payload: OrderPayload): Promise<ApiResponse<OrderResponse>> => {
    const createdOrder = contentStore.createOrder(payload);
    const paymentSettings = await contentStore.getPaymentSettings();
    await notifyOrderChannels('order_created', createdOrder, paymentSettings);

    return {
      success: true,
      data: {
        orderId: createdOrder.id,
        status: createdOrder.status,
      },
    };
  },

  submitServiceApplication: async (formData: FormData): Promise<ApiResponse<null>> => {
    console.log('📄 Service Application:', formData.get('email'));
    return { success: true };
  },

  // --- ADMIN ENDPOINTS (GitHub PAT auth) ---

  login: async (
    email: string,
    password: string,
  ): Promise<{ token: string; user: { name: string; role: string } }> => {
    const state = readLoginState();
    const now = Date.now();
    if (state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60000);
      throw new Error(`Too many failed attempts. Try again in ~${minutes} min.`);
    }

    if (!password.trim()) throw new Error('Password is required.');

    // Artificial delay to slow brute-force.
    await new Promise(resolve => setTimeout(resolve, Math.min(400 + state.failures * 400, 3000)));

    const recordFailure = () => {
      const failures = state.failures + 1;
      const lockedUntil = failures >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : 0;
      writeLoginState({ failures, lockedUntil });
      if (lockedUntil) throw new Error('Too many failed attempts. Locked for 15 minutes.');
    };

    const emailNorm = (email || '').trim().toLowerCase();
    if (emailNorm !== ADMIN_EMAIL) {
      recordFailure();
      throw new Error('Invalid admin email.');
    }

    const authConfig = await fetchAuthConfig();

    if (authConfig) {
      // --- Password mode: decrypt stored PAT with the supplied password ---
      let pat: string;
      try {
        pat = await decryptPAT(authConfig, password, emailNorm);
      } catch (err) {
        recordFailure();
        throw new Error(err instanceof Error ? err.message : 'Invalid credentials.');
      }
      const account = await verifyPAT(pat);
      if (!account) {
        recordFailure();
        throw new Error('Stored credentials are invalid — please re-run setup.');
      }
      contentStore.setPAT(pat, false);
      writeLoginState({ failures: 0, lockedUntil: 0 });
      return { token: pat, user: { name: account.login, role: 'superadmin' } };
    }

    // --- Fallback / Setup mode: treat the password field as a raw PAT ---
    // This is used once to log in and then set a proper password via the admin.
    const trimmed = password.trim();
    if (!trimmed.startsWith('ghp_') && !trimmed.startsWith('github_pat_')) {
      recordFailure();
      throw new Error('No password has been configured yet. Enter your GitHub PAT to log in for the first time, then set a password in Admin → Settings.');
    }
    const account = await verifyPAT(trimmed);
    if (!account) {
      recordFailure();
      throw new Error('GitHub PAT is invalid or lacks `contents: write` access.');
    }
    contentStore.setPAT(trimmed, false);
    writeLoginState({ failures: 0, lockedUntil: 0 });
    return { token: trimmed, user: { name: account.login, role: 'superadmin' } };
  },

  /** Save a new password for the admin. Encrypts the current session PAT and stores it. */
  setupAdminPassword: async (email: string, newPassword: string, pat: string): Promise<void> => {
    if (!newPassword || newPassword.length < 8) throw new Error('Password must be at least 8 characters.');
    const config = await encryptPAT(pat, newPassword, email.trim().toLowerCase());
    await saveAuthConfig(config);
  },

  logout: () => {
    contentStore.clearPAT();
  },

  getOrders: async (): Promise<Order[]> => contentStore.getOrders(),

  updateOrderStatus: async (orderId: string, status: OrderStatus): Promise<boolean> => {
    contentStore.updateOrderStatus(orderId, status);
    return true;
  },

  updatePaymentStatus: async (orderId: string, paymentStatus: PaymentStatus): Promise<boolean> => {
    contentStore.updatePaymentStatus(orderId, paymentStatus);
    if (paymentStatus === 'paid') {
      const paymentSettings = await contentStore.getPaymentSettings();
      const order = contentStore.getOrders().find(entry => entry.id === orderId);
      if (order) {
        await notifyOrderChannels('payment_confirmed', order, paymentSettings);
      }
    }
    return true;
  },

  updateInventory: async (bookId: string, stock: number): Promise<boolean> => {
    // Inventory is now per-book per-language in the JSON files.
    // Admin should update via upsertBook from the books tab. Kept as no-op stub
    // so the dashboard inventory shortcut doesn't crash.
    console.log(`Inventory update requested for ${bookId} → ${stock}. Use Books tab to persist.`);
    return true;
  },
};
