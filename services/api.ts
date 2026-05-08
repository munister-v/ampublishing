
import { Book, NewsItem, Language, OrderPayload, ApiResponse, OrderResponse, Order, OrderStatus, LocalizedCatalogData, TranslationOverrides } from '../types';
import { DATABASE, MOCK_ORDERS } from '../constants';
import { contentStore } from './contentStore';

// --- CONFIGURATION ---

const getBaseUrl = () => localStorage.getItem('api_url') || 'http://localhost:3000/api/v1';
const isMockMode = () => localStorage.getItem('use_mock_api') !== 'false'; // Default to true

// --- SUPABASE PREPARATION ---
/* 
   To enable Supabase:
   1. npm install @supabase/supabase-js
   2. Uncomment lines below and set keys in .env
   
   import { createClient } from '@supabase/supabase-js';
   const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
   const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
   export const supabase = createClient(supabaseUrl, supabaseKey);
*/

// --- HTTP CLIENT HELPER ---

class ApiRequestError extends Error {
  public code?: string;
  public status?: number;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;
  const token = localStorage.getItem('auth_token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  if (options.body instanceof FormData) {
    // @ts-ignore
    delete headers['Content-Type'];
  }

  if (token) {
    // @ts-ignore
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`📡 [API] ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
      localStorage.removeItem('auth_token');
      throw new ApiRequestError('Session expired', 401, 'UNAUTHORIZED');
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new ApiRequestError(
        data.error?.message || `API Error: ${response.statusText}`, 
        response.status, 
        data.error?.code
      );
    }

    return data.data as T;
  } catch (err) {
    console.error('❌ [API Error]', err);
    throw err;
  }
}

// --- MOCK HELPER ---
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  
  /**
   * Check if backend is alive
   */
  healthCheck: async (): Promise<boolean> => {
    if (isMockMode()) return true;
    try {
      await fetch(`${getBaseUrl()}/health`, { method: 'HEAD' });
      return true;
    } catch (e) {
      return false;
    }
  },

  // --- PUBLIC ENDPOINTS ---

  getBooks: async (lang: Language): Promise<Book[]> => {
    if (!isMockMode()) return request<Book[]>(`/books?lang=${lang}`);
    
    await mockDelay(600);
    return JSON.parse(JSON.stringify(contentStore.getDatabase()[lang].books));
  },

  getNews: async (lang: Language): Promise<NewsItem[]> => {
    if (!isMockMode()) return request<NewsItem[]>(`/news?lang=${lang}`);
    
    await mockDelay(400);
    return JSON.parse(JSON.stringify(contentStore.getDatabase()[lang].news));
  },

  getMetadata: async (lang: Language) => {
    if (!isMockMode()) return request<{ genres: string[], authors: string[], series: string[] }>(`/metadata?lang=${lang}`);
    
    await mockDelay(300);
    const database = contentStore.getDatabase();
    return {
        genres: database[lang].genres,
        authors: database[lang].authors,
        series: database[lang].series,
    };
  },

  getContentDatabase: async (): Promise<Record<Language, LocalizedCatalogData>> => {
    await mockDelay(200);
    return contentStore.getDatabase();
  },

  upsertBook: async (lang: Language, book: Book): Promise<Record<Language, LocalizedCatalogData>> => {
    await mockDelay(200);
    return contentStore.upsertBook(lang, book);
  },

  deleteBook: async (lang: Language, bookId: string): Promise<Record<Language, LocalizedCatalogData>> => {
    await mockDelay(150);
    return contentStore.deleteBook(lang, bookId);
  },

  upsertNewsItem: async (lang: Language, item: NewsItem): Promise<Record<Language, LocalizedCatalogData>> => {
    await mockDelay(150);
    return contentStore.upsertNewsItem(lang, item);
  },

  deleteNewsItem: async (lang: Language, itemId: string): Promise<Record<Language, LocalizedCatalogData>> => {
    await mockDelay(150);
    return contentStore.deleteNewsItem(lang, itemId);
  },

  getTranslationOverrides: async (): Promise<TranslationOverrides> => {
    await mockDelay(100);
    return contentStore.getTranslationOverrides();
  },

  setTranslationValue: async (lang: Language, key: string, value: any): Promise<TranslationOverrides> => {
    await mockDelay(120);
    return contentStore.setTranslationValue(lang, key, value);
  },

  resetTranslationValue: async (lang: Language, key: string): Promise<TranslationOverrides> => {
    await mockDelay(120);
    return contentStore.resetTranslationValue(lang, key);
  },

  submitOrder: async (payload: OrderPayload): Promise<ApiResponse<OrderResponse>> => {
    if (!isMockMode()) {
        return request<ApiResponse<OrderResponse>>(`/orders`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    console.log('📦 [Mock] Submitting Order:', payload);
    await mockDelay(2000); 
    
    return {
        success: true,
        data: {
            orderId: `AM-${Math.floor(Math.random() * 100000)}`,
            status: 'processing'
        }
    };
  },

  submitServiceApplication: async (formData: FormData): Promise<ApiResponse<null>> => {
      if (!isMockMode()) {
          const url = `${getBaseUrl()}/services`;
          const token = localStorage.getItem('auth_token');
          const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
          const response = await fetch(url, { method: 'POST', body: formData, headers });
          return response.json();
      }

      console.log('📄 [Mock] Service Application:', formData.get('email'));
      await mockDelay(1500);
      return { success: true };
  },

  // --- ADMIN ENDPOINTS (SECURE) ---

  login: async (email: string, password: string): Promise<{ token: string, user: { name: string, role: string } }> => {
      if (!isMockMode()) {
          return request('/auth/login', {
              method: 'POST',
              body: JSON.stringify({ email, password })
          });
      }

      await mockDelay(1000);
      if (email === 'admin@ampublishing.de' && password === 'admin') {
          return {
              token: 'mock-jwt-token-' + Date.now(),
              user: { name: 'Admin User', role: 'superadmin' }
          };
      }
      throw new Error('Invalid credentials');
  },

  getOrders: async (): Promise<Order[]> => {
      if (!isMockMode()) return request<Order[]>('/admin/orders');
      
      await mockDelay(800);
      return MOCK_ORDERS;
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus): Promise<boolean> => {
      if (!isMockMode()) {
          await request(`/admin/orders/${orderId}`, {
              method: 'PATCH',
              body: JSON.stringify({ status })
          });
          return true;
      }

      await mockDelay(500);
      console.log(`📝 [Mock] Order ${orderId} status changed to ${status}`);
      return true;
  },

  updateInventory: async (bookId: string, stock: number): Promise<boolean> => {
      if (!isMockMode()) {
          await request(`/admin/inventory/${bookId}`, {
              method: 'PATCH',
              body: JSON.stringify({ stock })
          });
          return true;
      }

      await mockDelay(600);
      console.log(`📦 [Mock] Stock for ${bookId} set to ${stock}`);
      return true;
  }
};
