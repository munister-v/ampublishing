import { Book, BookVariant } from '../types';
import { getIntegrations, peekIntegrations } from './integrations';
import type { AnalyticsIntegration } from '../types';

/**
 * ANALYTICS CORE
 * Один вызов track() рассылает событие во все включённые счётчики
 * (GA4, Plausible, Umami, Meta Pixel) и, если разрешено, пишет его в
 * локальный журнал — по нему в админке строится сводка.
 *
 * Скрипты счётчиков грузятся лениво и только после согласия на cookie,
 * если в настройках включено «требовать согласие» (GDPR-режим).
 */

type EventName =
  | 'page_view'
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search'
  | 'view_services'
  | 'service_enquiry_click'
  | 'lead_submit'
  | 'shopify_buy_click'
  | 'dhl_tracking_click';

type LogEntry = { name: EventName; params: Record<string, any>; ts: number };

const LOG_KEY = 'am-analytics-log-v1';
const LOG_MAX = 500;
const CONSENT_KEY = 'cookie-consent';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    plausible?: (event: string, options?: { props?: Record<string, any> }) => void;
    umami?: { track: (event: string, data?: Record<string, any>) => void };
    fbq?: (...args: any[]) => void;
  }
}

const injectScript = (src: string, attrs: Record<string, string> = {}) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    Object.entries(attrs).forEach(([key, value]) => script.setAttribute(key, value));
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    document.head.appendChild(script);
  });

class AnalyticsService {
  private debug = import.meta.env.DEV;
  private settings: AnalyticsIntegration | null = null;
  private loaded = false;
  private queue: LogEntry[] = [];

  /** Согласие на cookie, выданное баннером. */
  public hasConsent(): boolean {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /** Вызывается из баннера cookie после «Принять». */
  public grantConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, 'true');
    } catch { /* приватный режим */ }
    void this.init();
  }

  /** Загружает настройки и, если можно, подключает счётчики. */
  public async init(): Promise<void> {
    this.settings = (await getIntegrations()).analytics;
    if (!this.settings.enabled) return;
    if (this.settings.requireConsent && !this.hasConsent()) return;
    if (this.loaded) return;

    const { ga4MeasurementId, cloudflareWebAnalyticsToken, plausibleDomain, umamiWebsiteId, umamiScriptUrl, metaPixelId } = this.settings;

    try {
      if (ga4MeasurementId) {
        await injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4MeasurementId)}`);
        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function gtag() { window.dataLayer!.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', ga4MeasurementId, { anonymize_ip: true });
      }

      if (cloudflareWebAnalyticsToken) {
        await injectScript('https://static.cloudflareinsights.com/beacon.min.js', {
          type: 'module',
          defer: 'true',
          'data-cf-beacon': JSON.stringify({ token: cloudflareWebAnalyticsToken }),
        });
      }

      if (plausibleDomain) {
        await injectScript('https://plausible.io/js/script.js', { 'data-domain': plausibleDomain, defer: 'true' });
      }

      if (umamiWebsiteId && umamiScriptUrl) {
        await injectScript(umamiScriptUrl, { 'data-website-id': umamiWebsiteId, defer: 'true' });
      }

      if (metaPixelId && !window.fbq) {
        await injectScript('https://connect.facebook.net/en_US/fbevents.js');
        window.fbq?.('init', metaPixelId);
        window.fbq?.('track', 'PageView');
      }
    } catch (error) {
      console.warn('[analytics] provider script failed', error);
    }

    this.loaded = true;
    // Досылаем всё, что накопилось до согласия/загрузки.
    const pending = [...this.queue];
    this.queue = [];
    pending.forEach(entry => this.dispatch(entry.name, entry.params));
  }

  private currentSettings(): AnalyticsIntegration | null {
    return this.settings || peekIntegrations()?.analytics || null;
  }

  private writeLog(entry: LogEntry) {
    const settings = this.currentSettings();
    if (settings && !settings.keepLocalLog) return;
    try {
      const raw = localStorage.getItem(LOG_KEY);
      const log: LogEntry[] = raw ? JSON.parse(raw) : [];
      log.unshift(entry);
      localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, LOG_MAX)));
    } catch { /* переполнено — не критично */ }
  }

  private dispatch(name: EventName, params: Record<string, any>) {
    window.gtag?.('event', name, params);
    window.plausible?.(name, { props: params });
    window.umami?.track(name, params);
    if (name === 'purchase') window.fbq?.('track', 'Purchase', params);
    if (name === 'lead_submit') window.fbq?.('track', 'Lead', params);
  }

  public track(name: EventName, params: Record<string, any> = {}) {
    if (this.debug) {
      console.groupCollapsed(`📊 Event: ${name}`);
      console.table(params);
      console.groupEnd();
    }

    this.writeLog({ name, params, ts: Date.now() });

    if (!this.loaded) {
      this.queue.push({ name, params, ts: Date.now() });
      if (this.queue.length > 100) this.queue.shift();
      return;
    }
    this.dispatch(name, params);
  }

  /** Журнал событий для панели аналитики в админке. */
  public getLog(): LogEntry[] {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      return raw ? (JSON.parse(raw) as LogEntry[]) : [];
    } catch {
      return [];
    }
  }

  public clearLog() {
    try { localStorage.removeItem(LOG_KEY); } catch { /* noop */ }
  }

  /** Статус для админки: что реально подключилось в этом браузере. */
  public status() {
    const settings = this.currentSettings();
    return {
      enabled: Boolean(settings?.enabled),
      consent: this.hasConsent(),
      loaded: this.loaded,
      providers: {
        ga4: Boolean(window.gtag && settings?.ga4MeasurementId),
        cloudflare: Boolean(document.querySelector('script[src="https://static.cloudflareinsights.com/beacon.min.js"]')),
        plausible: Boolean(window.plausible),
        umami: Boolean(window.umami),
        metaPixel: Boolean(window.fbq),
      },
    };
  }

  // --- Хелперы событий ---

  public pageView(path: string) {
    this.track('page_view', { page_path: path });
  }

  public viewItem(book: Book) {
    this.track('view_item', {
      currency: 'EUR',
      value: book.price,
      items: [{ item_id: book.id, item_name: book.title, item_category: book.genre[0], price: book.price }],
    });
  }

  public addToCart(book: Book, variant: BookVariant, quantity: number) {
    this.track('add_to_cart', {
      currency: 'EUR',
      value: variant.price * quantity,
      items: [{ item_id: variant.id, item_name: book.title, item_variant: variant.format, quantity }],
    });
  }

  public beginCheckout(cartTotal: number, itemCount: number) {
    this.track('begin_checkout', { currency: 'EUR', value: cartTotal, item_count: itemCount });
  }

  public purchase(orderId: string, total: number, currency: string) {
    this.track('purchase', { transaction_id: orderId, value: total, currency });
  }

  public viewServices(language: string) {
    this.track('view_services', { language });
  }

  public serviceEnquiryClick(serviceId: string, serviceTitle: string) {
    this.track('service_enquiry_click', { service_id: serviceId, service_title: serviceTitle });
  }

  public leadSubmit(serviceId: string, delivered: boolean) {
    this.track('lead_submit', { service_id: serviceId, delivered });
  }

  public shopifyBuyClick(bookId: string, destination: string, source = 'product_page') {
    this.track('shopify_buy_click', { book_id: bookId, destination, source });
  }

  public dhlTrackingClick(orderId: string) {
    this.track('dhl_tracking_click', { order_id: orderId });
  }
}

export const analytics = new AnalyticsService();
void analytics.init();
