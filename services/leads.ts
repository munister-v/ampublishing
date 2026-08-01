import type { Language, Lead, LeadsIntegration, LeadStatus } from '../types';
import { getIntegrations } from './integrations';

/**
 * Заявки на услуги. Сайт статический, поэтому заявка уходит на внешний
 * эндпоинт (Formspree / Getform / Make / n8n — любой POST-приёмник), а
 * копия всегда остаётся в этом браузере, чтобы ничего не потерялось,
 * если сеть или эндпоинт подвели. Если эндпоинта нет — открывается письмо.
 */

const LOG_KEY = 'am-leads-v1';
const LOG_MAX = 200;

export type LeadDraft = {
  name: string;
  email: string;
  phone?: string;
  service: string;
  serviceTitle?: string;
  message: string;
  language: Language;
};

export type LeadResult = {
  lead: Lead;
  delivered: boolean;
  /** Готовая mailto-ссылка — показываем, если доставить не удалось. */
  mailtoUrl: string;
  error?: string;
};

const readLog = (): Lead[] => {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? (JSON.parse(raw) as Lead[]) : [];
  } catch {
    return [];
  }
};

const writeLog = (leads: Lead[]) => {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(leads.slice(0, LOG_MAX)));
  } catch {
    /* приватный режим / переполненное хранилище — не критично */
  }
};

export const getLeadLog = (): Lead[] => readLog();

export const updateLeadStatus = (id: string, status: LeadStatus): Lead[] => {
  const next = readLog().map(lead => (lead.id === id ? { ...lead, status } : lead));
  writeLog(next);
  return next;
};

export const deleteLead = (id: string): Lead[] => {
  const next = readLog().filter(lead => lead.id !== id);
  writeLog(next);
  return next;
};

export const clearLeadLog = (): Lead[] => {
  writeLog([]);
  return [];
};

export const leadsToCsv = (leads: Lead[]): string => {
  const header = ['ID', 'Дата', 'Имя', 'Email', 'Телефон', 'Услуга', 'Язык', 'Статус', 'Доставлена', 'Сообщение'];
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = leads.map(lead => [
    lead.id,
    new Date(lead.createdAt).toLocaleString(),
    lead.name,
    lead.email,
    lead.phone || '',
    lead.serviceTitle || lead.service,
    lead.language,
    lead.status,
    lead.delivered ? 'да' : 'нет',
    lead.message,
  ]);
  return [header, ...rows].map(row => row.map(escape).join(';')).join('\n');
};

export const buildLeadMailto = (lead: Lead, email: string): string => {
  const subject = `Заявка на услугу: ${lead.serviceTitle || lead.service}`;
  const body = [
    `Услуга: ${lead.serviceTitle || lead.service}`,
    `Имя: ${lead.name}`,
    `E-mail: ${lead.email}`,
    lead.phone ? `Телефон: ${lead.phone}` : '',
    '',
    lead.message,
  ]
    .filter(Boolean)
    .join('\n');
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const postLead = async (lead: Lead, settings: LeadsIntegration): Promise<boolean> => {
  if (!settings.endpointUrl) return false;

  const payload = {
    source: 'ampublishing',
    type: 'service_lead',
    ...lead,
    // Formspree/Getform показывают эти поля в письме первой строкой
    _subject: `Заявка на услугу: ${lead.serviceTitle || lead.service}`,
  };

  if (settings.mode === 'webhook') {
    // Мосты вроде Make/n8n часто без CORS — шлём fire-and-forget.
    await fetch(settings.endpointUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return true;
  }

  const res = await fetch(settings.endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Эндпоинт ответил ${res.status}`);
  return true;
};

const notifyBridge = async (lead: Lead, url: string) => {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'ampublishing',
        event: 'service_lead',
        lead,
        message: [
          'Новая заявка на услугу',
          `Услуга: ${lead.serviceTitle || lead.service}`,
          `Имя: ${lead.name}`,
          `E-mail: ${lead.email}`,
          lead.phone ? `Телефон: ${lead.phone}` : '',
          lead.message,
        ]
          .filter(Boolean)
          .join('\n'),
        sentAt: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.warn('[leads] bridge webhook failed', error);
  }
};

export const submitLead = async (draft: LeadDraft): Promise<LeadResult> => {
  const settings = (await getIntegrations()).leads;

  const lead: Lead = {
    id: `LEAD-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    name: draft.name.trim(),
    email: draft.email.trim(),
    phone: draft.phone?.trim() || '',
    service: draft.service,
    serviceTitle: draft.serviceTitle || draft.service,
    message: draft.message.trim(),
    language: draft.language,
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    status: 'new',
    delivered: false,
  };

  let error: string | undefined;
  try {
    lead.delivered = await postLead(lead, settings);
  } catch (e: any) {
    error = e?.message || String(e);
  }

  await notifyBridge(lead, settings.notifyWebhookUrl);
  writeLog([lead, ...readLog()]);

  return {
    lead,
    delivered: lead.delivered,
    mailtoUrl: buildLeadMailto(lead, settings.fallbackEmail || 'info@ampublishing.org'),
    error,
  };
};
