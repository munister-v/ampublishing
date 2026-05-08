
export type Language = 'ru' | 'en' | 'de';

export type Format = 'hardcover' | 'paperback' | 'digital' | 'special_edition';

export interface BookVariant {
  id: string; // SKU
  format: Format;
  language: string;
  price: number;
  stock: number;
  isbn: string;
}

export interface BookTheme {
  title: string;
  text: string;
}

export interface BookReview {
  quote: string;
  author: string;
}

export interface BookStory {
  quote?: string;
  quoteSource?: string;
  about: string[];
  excerpt: string[];
  authorBio: string[];
  themes: BookTheme[];
  reviews: BookReview[];
  orderNote?: string;
  featureImageUrl?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  // Base price for catalog display
  price: number;
  oldPrice?: number;
  coverUrl: string;
  badges: ('new' | 'bestseller' | '18+' | 'preorder' | 'last_copy')[];
  type: 'publisher' | 'author_project'; 
  isPreorder: boolean;
  // Total stock across variants or main stock
  stock: number;
  description: string;
  details: {
    pages: number;
    year: number;
    publisher?: string;
    weight?: string; // e.g. "450g"
    dimensions?: string; // e.g. "140 x 210 mm"
  };
  genre: string[];
  series?: string; 
  ageRating: '6+' | '12+' | '16+' | '18+';
  variants: BookVariant[];
  releaseDate: string; // ISO date for sorting
  story?: BookStory;
}

export interface CartItem {
  bookId: string;
  variantId: string; // Specific SKU
  title: string;
  author: string;
  coverUrl: string;
  variant: BookVariant;
  quantity: number;
}

export interface FilterState {
  search: string;
  inStock: boolean;
  genres: string[];
  authors: string[];
  priceRange: [number, number];
  formats: Format[];
  years: string[];
}

export type SortOption = 'default' | 'newest' | 'price_asc' | 'price_desc' | 'alpha_asc';

export interface Region {
  id: string;
  name: string;
  currency: string;
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  preview: string;
}

export interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  zip: string;
  country: string;
  shippingMethod: 'standard' | 'express';
  paymentMethod: 'card' | 'paypal' | 'invoice';
}

// --- ADMIN & ORDER TYPES ---

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface OrderItem {
  variantId: string;
  bookTitle: string;
  quantity: number;
  priceAtPurchase: number;
}

export interface Order {
  id: string;
  date: string; // ISO
  customer: {
    name: string;
    email: string;
    location: string; // City, Country
  };
  items: OrderItem[];
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  trackingNumber?: string;
}

// --- BACKEND INTEGRATION TYPES ---

export interface OrderPayload {
  customer: CheckoutFormData;
  items: {
    variantId: string;
    quantity: number;
  }[];
  regionId: string;
  totalAmount: number;
  currency: string;
}

export interface OrderResponse {
  orderId: string;
  status: OrderStatus;
  paymentUrl?: string; 
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError; 
}

export interface ApiError {
  code: string; 
  message: string; 
  details?: any; 
}
