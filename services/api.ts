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
  TranslationOverrides,
} from '../types';
import { contentStore, verifyPAT } from './contentStore';
import { notifyOrderChannels } from './orderNotifications';

// Admin auth is now GitHub PAT-based. The "email" field is informational only;
// the PAT (entered in the password field) is what authenticates writes to the repo.
const ADMIN_EMAIL = 'admin@ampublishing.org';

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
    pat: string,
  ): Promise<{ token: string; user: { name: string; role: string } }> => {
    const state = readLoginState();
    const now = Date.now();
    if (state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60000);
      throw new Error(`Too many failed attempts. Try again in ~${minutes} min.`);
    }

    const trimmed = (pat || '').trim();
    if (!trimmed) throw new Error('GitHub Personal Access Token is required.');

    // Light client-side delay to discourage rapid guessing.
    await new Promise(resolve => setTimeout(resolve, Math.min(400 + state.failures * 400, 3000)));

    const account = await verifyPAT(trimmed);
    const emailOk = (email || '').trim().toLowerCase() === ADMIN_EMAIL;

    if (account && emailOk) {
      contentStore.setPAT(trimmed, false);
      writeLoginState({ failures: 0, lockedUntil: 0 });
      return {
        token: trimmed,
        user: { name: account.login, role: 'superadmin' },
      };
    }

    const failures = state.failures + 1;
    const lockedUntil = failures >= LOGIN_MAX_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : 0;
    writeLoginState({ failures, lockedUntil });
    if (lockedUntil) {
      throw new Error(`Too many failed attempts. Locked for 15 minutes.`);
    }
    if (!emailOk) throw new Error('Invalid admin email.');
    throw new Error('GitHub token rejected (check token scope: needs `contents: write` on this repo).');
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
