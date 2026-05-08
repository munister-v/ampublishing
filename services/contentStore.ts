import { DATABASE, MOCK_ORDERS } from '../constants';
import { Book, Language, LocalizedCatalogData, NewsItem, Order, OrderPayload, PaymentSettings, PaymentStatus, TranslationOverrides } from '../types';

const DB_KEY = 'am-editable-database-v1';
const OVERRIDES_KEY = 'am-translation-overrides-v1';
const ORDERS_KEY = 'am-orders-v1';
const PAYMENT_SETTINGS_KEY = 'am-payment-settings-v1';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const getStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const computeMetadata = (books: Book[]) => {
  const genres = Array.from(new Set(books.flatMap(book => book.genre))).filter(Boolean).sort();
  const authors = Array.from(new Set(books.map(book => book.author))).filter(Boolean).sort();
  const series = Array.from(new Set(books.map(book => book.series).filter(Boolean) as string[])).sort();
  return { genres, authors, series };
};

const normalizeLanguageData = (data: LocalizedCatalogData): LocalizedCatalogData => {
  const metadata = computeMetadata(data.books);
  return {
    books: data.books,
    news: data.news,
    genres: metadata.genres,
    authors: metadata.authors,
    series: metadata.series,
  };
};

const normalizeDatabase = (database: Record<Language, LocalizedCatalogData>) => ({
  ru: normalizeLanguageData(database.ru),
  en: normalizeLanguageData(database.en),
  de: normalizeLanguageData(database.de),
});

const sanitizeTranslationOverrides = (overrides: TranslationOverrides): TranslationOverrides => {
  const next: TranslationOverrides = {
    ru: { ...(overrides.ru || {}) },
    en: { ...(overrides.en || {}) },
    de: { ...(overrides.de || {}) },
  };

  if (next.ru['home.hero_title_1'] === 'Книги в дорогу') {
    next.ru['home.hero_title_1'] = 'Книги с собой';
  }

  return next;
};

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  recipientName: 'AM Publishing',
  cardholder: '',
  cardNumber: '',
  bankName: '',
  iban: '',
  whatsappNumber: '',
  telegramUsername: '',
  contactEmail: 'am.hybridpublishing@gmail.com',
  paymentNote: 'После оплаты отправьте подтверждение перевода, чтобы мы могли вручную подтвердить заказ.',
  invoicePrefix: 'AM',
};

const sanitizePaymentSettings = (settings?: Partial<PaymentSettings>): PaymentSettings => ({
  ...DEFAULT_PAYMENT_SETTINGS,
  ...(settings || {}),
});

export const contentStore = {
  getDatabase(): Record<Language, LocalizedCatalogData> {
    const storage = getStorage();
    if (!storage) return clone(normalizeDatabase(DATABASE));

    try {
      const raw = storage.getItem(DB_KEY);
      if (!raw) return clone(normalizeDatabase(DATABASE));
      return normalizeDatabase(JSON.parse(raw));
    } catch {
      return clone(normalizeDatabase(DATABASE));
    }
  },

  saveDatabase(database: Record<Language, LocalizedCatalogData>) {
    const storage = getStorage();
    const normalized = normalizeDatabase(database);
    if (storage) {
      storage.setItem(DB_KEY, JSON.stringify(normalized));
    }
    return clone(normalized);
  },

  upsertBook(language: Language, book: Book) {
    const database = this.getDatabase();
    const existingIndex = database[language].books.findIndex(item => item.id === book.id);

    if (existingIndex >= 0) {
      database[language].books[existingIndex] = book;
    } else {
      database[language].books.unshift(book);
    }

    return this.saveDatabase(database);
  },

  deleteBook(language: Language, bookId: string) {
    const database = this.getDatabase();
    database[language].books = database[language].books.filter(book => book.id !== bookId);
    return this.saveDatabase(database);
  },

  upsertNewsItem(language: Language, item: NewsItem) {
    const database = this.getDatabase();
    const existingIndex = database[language].news.findIndex(entry => entry.id === item.id);

    if (existingIndex >= 0) {
      database[language].news[existingIndex] = item;
    } else {
      database[language].news.unshift(item);
    }

    return this.saveDatabase(database);
  },

  deleteNewsItem(language: Language, itemId: string) {
    const database = this.getDatabase();
    database[language].news = database[language].news.filter(item => item.id !== itemId);
    return this.saveDatabase(database);
  },

  getTranslationOverrides(): TranslationOverrides {
    const storage = getStorage();
    if (!storage) return { ru: {}, en: {}, de: {} };

    try {
      const raw = storage.getItem(OVERRIDES_KEY);
      if (!raw) return { ru: {}, en: {}, de: {} };
      const parsed = JSON.parse(raw);
      return sanitizeTranslationOverrides({
        ru: parsed.ru || {},
        en: parsed.en || {},
        de: parsed.de || {},
      });
    } catch {
      return { ru: {}, en: {}, de: {} };
    }
  },

  saveTranslationOverrides(overrides: TranslationOverrides) {
    const storage = getStorage();
    const normalized = sanitizeTranslationOverrides({
      ru: overrides.ru || {},
      en: overrides.en || {},
      de: overrides.de || {},
    });
    if (storage) {
      storage.setItem(OVERRIDES_KEY, JSON.stringify(normalized));
    }
    return normalized;
  },

  setTranslationValue(language: Language, key: string, value: any) {
    const overrides = this.getTranslationOverrides();
    overrides[language] = overrides[language] || {};
    overrides[language][key] = value;
    return this.saveTranslationOverrides(overrides);
  },

  resetTranslationValue(language: Language, key: string) {
    const overrides = this.getTranslationOverrides();
    if (overrides[language]) {
      delete overrides[language][key];
    }
    return this.saveTranslationOverrides(overrides);
  },

  exportContent() {
    return {
      database: this.getDatabase(),
      overrides: this.getTranslationOverrides(),
      orders: this.getOrders(),
      paymentSettings: this.getPaymentSettings(),
      exportedAt: new Date().toISOString(),
      version: 2,
    };
  },

  importContent(payload: { database?: Record<Language, LocalizedCatalogData>; overrides?: TranslationOverrides; orders?: Order[]; paymentSettings?: PaymentSettings }) {
    if (payload.database) {
      this.saveDatabase(payload.database);
    }
    if (payload.overrides) {
      this.saveTranslationOverrides(payload.overrides);
    }
    if (payload.orders) {
      this.saveOrders(payload.orders);
    }
    if (payload.paymentSettings) {
      this.savePaymentSettings(payload.paymentSettings);
    }
    return this.exportContent();
  },

  getOrders(): Order[] {
    const storage = getStorage();
    if (!storage) return clone(MOCK_ORDERS);

    try {
      const raw = storage.getItem(ORDERS_KEY);
      if (!raw) return clone(MOCK_ORDERS);
      return clone(JSON.parse(raw));
    } catch {
      return clone(MOCK_ORDERS);
    }
  },

  saveOrders(orders: Order[]) {
    const storage = getStorage();
    const normalized = clone(orders);
    if (storage) {
      storage.setItem(ORDERS_KEY, JSON.stringify(normalized));
    }
    return normalized;
  },

  createOrder(payload: OrderPayload) {
    const database = this.getDatabase();
    const books = [...database.ru.books, ...database.en.books, ...database.de.books];
    const status = payload.customer.paymentMethod === 'invoice' ? 'pending' : 'processing';
    const paymentReference = `${payload.customer.paymentMethod === 'invoice' ? 'INV' : 'PAY'}-${Date.now().toString().slice(-6)}`;
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

    const nextOrder: Order = {
      id: `${this.getPaymentSettings().invoicePrefix || 'AM'}-${Math.floor(Math.random() * 100000)}`,
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
      status,
      paymentStatus: 'pending',
      paymentMethod: payload.customer.paymentMethod,
      paymentReference,
    };

    const orders = this.getOrders();
    orders.unshift(nextOrder);
    this.saveOrders(orders);
    return nextOrder;
  },

  updateOrderStatus(orderId: string, status: Order['status']) {
    const orders = this.getOrders().map(order => (order.id === orderId ? { ...order, status } : order));
    this.saveOrders(orders);
    return true;
  },

  updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus) {
    const orders = this.getOrders().map(order => (order.id === orderId ? { ...order, paymentStatus } : order));
    this.saveOrders(orders);
    return true;
  },

  getPaymentSettings(): PaymentSettings {
    const storage = getStorage();
    if (!storage) return clone(DEFAULT_PAYMENT_SETTINGS);

    try {
      const raw = storage.getItem(PAYMENT_SETTINGS_KEY);
      if (!raw) return clone(DEFAULT_PAYMENT_SETTINGS);
      return clone(sanitizePaymentSettings(JSON.parse(raw)));
    } catch {
      return clone(DEFAULT_PAYMENT_SETTINGS);
    }
  },

  savePaymentSettings(settings: PaymentSettings) {
    const storage = getStorage();
    const normalized = sanitizePaymentSettings(settings);
    if (storage) {
      storage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(normalized));
    }
    return clone(normalized);
  },
};
