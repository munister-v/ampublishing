import type { Lead, LeadStatus } from '../types';

/**
 * Клиент своего сервиса заявок (ampublishing-leads на VPS).
 * Токен админа живёт только в этом браузере — в репозиторий он не попадает,
 * потому что integrations.json публичный.
 */

const TOKEN_KEY = 'am-leads-token';

export const getLeadsToken = (): string => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setLeadsToken = (token: string) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* приватный режим */
  }
};

const authHeaders = () => ({ 'X-Admin-Token': getLeadsToken(), 'Content-Type': 'application/json' });

const normalize = (raw: any): Lead => ({
  id: raw.public_id || raw.id,
  createdAt: raw.created_at,
  name: raw.name,
  email: raw.email,
  phone: raw.phone || '',
  service: raw.service || '',
  serviceTitle: raw.service_title || raw.service || '',
  message: raw.message || '',
  language: raw.language || 'ru',
  pageUrl: raw.page_url || '',
  status: (raw.status || 'new') as LeadStatus,
  delivered: true,
  consent: Boolean(raw.consent),
  attribution: raw.attribution || {},
});

export const serverHealth = async (baseUrl: string): Promise<{ ok: boolean; leads: number }> => {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
  return res.json();
};

export const fetchServerLeads = async (baseUrl: string): Promise<Lead[]> => {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/leads?limit=500`, { headers: authHeaders() });
  if (res.status === 401) throw new Error('Неверный токен доступа');
  if (!res.ok) throw new Error(`Сервис ответил ${res.status}`);
  const payload = await res.json();
  return (payload.leads || []).map(normalize);
};

export const setServerLeadStatus = async (baseUrl: string, id: string, status: LeadStatus): Promise<void> => {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/leads/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Не удалось сменить статус (${res.status})`);
};

export const deleteServerLead = async (baseUrl: string, id: string): Promise<void> => {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/leads/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Не удалось удалить (${res.status})`);
};

export const serverCsvUrl = (baseUrl: string): string =>
  `${baseUrl.replace(/\/$/, '')}/leads.csv?token=${encodeURIComponent(getLeadsToken())}`;
