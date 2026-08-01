import { contentStore } from './contentStore';
import type { IntegrationSettings } from '../types';

/**
 * Настройки интеграций (Shopify / DHL / заявки / аналитика).
 * Хранятся в public/content/integrations.json, редактируются в админке
 * и пишутся тем же путём (GitHub Contents API), что и остальной контент.
 */

const CONTENT_URL = `${import.meta.env.BASE_URL}content/integrations.json`;
const REPO_PATH = 'public/content/integrations.json';

export const DEFAULT_INTEGRATIONS: IntegrationSettings = {
  shopify: {
    enabled: false,
    domain: '',
    storefrontToken: '',
    redirectToShopifyCheckout: true,
    refTag: 'ampublishing-site',
    products: [],
  },
  dhl: {
    enabled: false,
    accountNumber: '',
    senderName: 'AM Publishing',
    senderStreet: 'Mehrower Allee 71',
    senderZip: '12687',
    senderCity: 'Berlin',
    senderCountry: 'DE',
    defaultItemWeightGrams: 450,
    packagingWeightGrams: 120,
    freeShippingThreshold: 50,
    expressSurcharge: 9.9,
    trackingUrlTemplate: 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={tracking}',
    rates: [
      { id: 'de-2000', label: 'Германия', countries: 'DE', maxWeightGrams: 2000, price: 4.99, product: 'DHL Paket', deliveryDays: '1–2' },
      { id: 'de-5000', label: 'Германия', countries: 'DE', maxWeightGrams: 5000, price: 6.99, product: 'DHL Paket', deliveryDays: '1–2' },
      { id: 'eu-2000', label: 'Европейский Союз', countries: 'AT,BE,CZ,DK,EE,FI,FR,GR,HU,IE,IT,LT,LU,LV,NL,PL,PT,RO,SE,SI,SK,ES,BG,HR,CY,MT', maxWeightGrams: 2000, price: 12.99, product: 'DHL Paket International', deliveryDays: '3–6' },
      { id: 'eu-5000', label: 'Европейский Союз', countries: 'AT,BE,CZ,DK,EE,FI,FR,GR,HU,IE,IT,LT,LU,LV,NL,PL,PT,RO,SE,SI,SK,ES,BG,HR,CY,MT', maxWeightGrams: 5000, price: 18.99, product: 'DHL Paket International', deliveryDays: '3–6' },
      { id: 'world-2000', label: 'Весь мир', countries: '', maxWeightGrams: 2000, price: 21.99, product: 'DHL Paket International', deliveryDays: '5–14' },
      { id: 'world-5000', label: 'Весь мир', countries: '', maxWeightGrams: 5000, price: 34.99, product: 'DHL Paket International', deliveryDays: '5–14' },
    ],
  },
  leads: {
    enabled: true,
    endpointUrl: '',
    mode: 'form',
    fallbackEmail: 'info@ampublishing.org',
    notifyWebhookUrl: '',
    successMessage: '',
  },
  analytics: {
    enabled: false,
    requireConsent: true,
    ga4MeasurementId: '',
    plausibleDomain: '',
    umamiWebsiteId: '',
    umamiScriptUrl: '',
    metaPixelId: '',
    keepLocalLog: true,
  },
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const merge = (incoming: Partial<IntegrationSettings> | null): IntegrationSettings => {
  const base = clone(DEFAULT_INTEGRATIONS);
  if (!incoming) return base;
  return {
    shopify: {
      ...base.shopify,
      ...(incoming.shopify || {}),
      products: Array.isArray(incoming.shopify?.products) ? incoming.shopify!.products : base.shopify.products,
    },
    dhl: {
      ...base.dhl,
      ...(incoming.dhl || {}),
      rates: Array.isArray(incoming.dhl?.rates) ? incoming.dhl!.rates : base.dhl.rates,
    },
    leads: { ...base.leads, ...(incoming.leads || {}) },
    analytics: { ...base.analytics, ...(incoming.analytics || {}) },
  };
};

let cached: IntegrationSettings | null = null;
let loading: Promise<IntegrationSettings> | null = null;

export const getIntegrations = async (force = false): Promise<IntegrationSettings> => {
  if (cached && !force) return clone(cached);
  if (loading && !force) return loading.then(clone);

  loading = (async () => {
    try {
      const res = await fetch(CONTENT_URL, { cache: 'no-cache' });
      cached = merge(res.ok ? await res.json() : null);
    } catch (e) {
      console.warn('[integrations] falling back to defaults', e);
      cached = merge(null);
    }
    return cached;
  })();

  const result = await loading;
  loading = null;
  return clone(result);
};

/** Синхронный доступ для мест, где ждать нельзя (аналитика в конструкторе). */
export const peekIntegrations = (): IntegrationSettings | null => (cached ? clone(cached) : null);

export const saveIntegrations = async (settings: IntegrationSettings): Promise<IntegrationSettings> => {
  cached = merge(settings);
  await contentStore.ghWritePublicFile(REPO_PATH, cached, 'admin: update integrations (shopify/dhl/leads/analytics)');
  return clone(cached);
};
