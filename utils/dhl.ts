import type { CartItem, DhlIntegration, DhlShippingRate, Order } from '../types';

/** Ссылка на отслеживание посылки DHL по номеру. */
export const buildDhlTrackingUrl = (dhl: DhlIntegration, tracking: string): string | null => {
  const code = (tracking || '').trim();
  if (!code) return null;
  const template = dhl.trackingUrlTemplate || 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={tracking}';
  return template.replace('{tracking}', encodeURIComponent(code));
};

/** Вес заказа: вес книг (из details.weight, если он в граммах) + упаковка. */
export const estimateWeightGrams = (
  dhl: DhlIntegration,
  items: { quantity: number; weightGrams?: number }[],
): number => {
  const itemsWeight = items.reduce(
    (sum, item) => sum + item.quantity * (item.weightGrams || dhl.defaultItemWeightGrams),
    0,
  );
  return itemsWeight + dhl.packagingWeightGrams;
};

/** Парсит «450g», «0,45 kg», «450» → граммы. Возвращает null, если это не вес. */
export const parseWeightGrams = (raw?: string): number | null => {
  if (!raw) return null;
  const text = raw.trim().toLowerCase().replace(',', '.');
  const match = text.match(/([\d.]+)\s*(kg|g|гр|г)?/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2] === 'kg' ? Math.round(value * 1000) : Math.round(value);
};

const matchesCountry = (rate: DhlShippingRate, country: string) => {
  const list = (rate.countries || '')
    .split(',')
    .map(code => code.trim().toUpperCase())
    .filter(Boolean);
  if (!list.length) return true; // пустой список = «весь остальной мир»
  return list.includes((country || '').trim().toUpperCase());
};

/**
 * Подбирает тариф DHL: самая дешёвая строка, которая покрывает страну и вес.
 * Строки «весь мир» (пустой список стран) используются как запасной вариант.
 */
export const findDhlRate = (
  dhl: DhlIntegration,
  country: string,
  weightGrams: number,
): DhlShippingRate | null => {
  const candidates = (dhl.rates || []).filter(rate => rate.maxWeightGrams >= weightGrams);
  const specific = candidates.filter(rate => (rate.countries || '').trim() && matchesCountry(rate, country));
  const fallback = candidates.filter(rate => !(rate.countries || '').trim());
  const pool = specific.length ? specific : fallback;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => a.price - b.price || a.maxWeightGrams - b.maxWeightGrams)[0];
};

export const calculateShipping = (
  dhl: DhlIntegration,
  country: string,
  weightGrams: number,
  orderTotal: number,
): { rate: DhlShippingRate | null; price: number; free: boolean } => {
  const rate = findDhlRate(dhl, country, weightGrams);
  const free = dhl.freeShippingThreshold > 0 && orderTotal >= dhl.freeShippingThreshold;
  return { rate, price: free ? 0 : rate?.price ?? 0, free };
};

export const cartItemsForShipping = (cart: CartItem[]) =>
  cart.map(item => ({
    quantity: item.quantity,
    weightGrams: parseWeightGrams((item as any).weight) ?? undefined,
  }));

const csvEscape = (value: unknown) => {
  const text = String(value ?? '');
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * CSV для импорта в DHL Geschäftskundenportal (Sendungen → Import).
 * Колонки соответствуют стандартному шаблону получателя; при первом импорте
 * в портале один раз сопоставляются столбцы, дальше профиль запоминается.
 */
export const ordersToDhlCsv = (orders: Order[], dhl: DhlIntegration): string => {
  const header = [
    'EKP', 'Produkt', 'Empfaenger Name', 'Empfaenger Strasse', 'Empfaenger PLZ',
    'Empfaenger Ort', 'Empfaenger Land', 'Empfaenger Email', 'Empfaenger Telefon',
    'Gewicht (kg)', 'Referenz', 'Absender Name', 'Absender Strasse', 'Absender PLZ',
    'Absender Ort', 'Absender Land',
  ];

  const rows = orders.map(order => {
    const weight = estimateWeightGrams(
      dhl,
      order.items.map(item => ({ quantity: item.quantity })),
    );
    const country = order.customer.country || order.customer.location?.split(',').pop()?.trim() || 'DE';
    const rate = findDhlRate(dhl, country, weight);
    return [
      dhl.accountNumber,
      rate?.product || 'DHL Paket',
      order.customer.name,
      order.customer.addressLine || '',
      order.customer.zip || '',
      order.customer.location?.split(',')[0]?.trim() || '',
      country,
      order.customer.email,
      order.customer.phone || '',
      (weight / 1000).toFixed(2),
      order.id,
      dhl.senderName,
      dhl.senderStreet,
      dhl.senderZip,
      dhl.senderCity,
      dhl.senderCountry,
    ];
  });

  return [header, ...rows].map(row => row.map(csvEscape).join(';')).join('\n');
};
