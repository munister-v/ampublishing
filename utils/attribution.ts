/**
 * Источник визита: utm-метки и реферер первой страницы сессии.
 * Пишем один раз за сессию, чтобы в заявке был виден канал,
 * даже если человек до формы успел походить по сайту.
 */

const KEY = 'am-attribution-v1';

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  referrer?: string;
  landingPage?: string;
};

export const captureAttribution = (): Attribution => {
  if (typeof window === 'undefined') return {};
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Attribution;

    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer && !document.referrer.includes(window.location.host)
      ? document.referrer
      : '';

    const attribution: Attribution = {
      source: params.get('utm_source') || (referrer ? new URL(referrer).hostname : 'direct'),
      medium: params.get('utm_medium')
        || (params.get('utm_source') ? 'campaign' : referrer ? 'referral' : 'none'),
      campaign: params.get('utm_campaign') || '',
      referrer,
      landingPage: window.location.pathname + window.location.search,
    };
    sessionStorage.setItem(KEY, JSON.stringify(attribution));
    return attribution;
  } catch {
    return {};
  }
};

export const getAttribution = (): Attribution => captureAttribution();
