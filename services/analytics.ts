
import { Book, BookVariant } from '../types';

/**
 * ANALYTICS CORE
 * Abstraction layer for tracking user behavior.
 * Currently logs to console, but designed to pipe data to GA4, Plausible, or Segment.
 */

type EventName = 
  | 'page_view'
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search';

interface AnalyticsEvent {
  name: EventName;
  params?: Record<string, any>;
}

class AnalyticsService {
  private debug: boolean = import.meta.env.DEV;

  constructor() {
    if (this.debug) {
      console.log('📊 Analytics Service Initialized');
    }
  }

  /**
   * Main tracking method
   */
  public track(name: EventName, params: Record<string, any> = {}) {
    // 1. Log to Console (Dev Mode)
    if (this.debug) {
      console.groupCollapsed(`📊 Event: ${name}`);
      console.table(params);
      console.groupEnd();
    }

    // 2. Integration point for GA4 / GTM
    // if (window.gtag) { window.gtag('event', name, params); }
  }

  // --- Helper Methods for E-Commerce Events ---

  public pageView(path: string) {
    this.track('page_view', { page_path: path });
  }

  public viewItem(book: Book) {
    this.track('view_item', {
      currency: 'EUR',
      value: book.price,
      items: [{
        item_id: book.id,
        item_name: book.title,
        item_category: book.genre[0],
        price: book.price
      }]
    });
  }

  public addToCart(book: Book, variant: BookVariant, quantity: number) {
    this.track('add_to_cart', {
      currency: 'EUR',
      value: variant.price * quantity,
      items: [{
        item_id: variant.id, // SKU
        item_name: book.title,
        item_variant: variant.format,
        quantity: quantity
      }]
    });
  }

  public beginCheckout(cartTotal: number, itemCount: number) {
    this.track('begin_checkout', {
      currency: 'EUR',
      value: cartTotal,
      item_count: itemCount
    });
  }
}

export const analytics = new AnalyticsService();
