import React, { useEffect, useMemo, useState } from 'react';
import {
  Save, Loader2, Plus, Trash2, RefreshCw, ExternalLink, Download, Check, X,
  ShoppingBag, Truck, Inbox, BarChart3, AlertTriangle, Link2, Send,
} from 'lucide-react';
import { api } from '../services/api';
import { getIntegrations, saveIntegrations } from '../services/integrations';
import { analytics } from '../services/analytics';
import {
  getLeadLog, updateLeadStatus, deleteLead, clearLeadLog, leadsToCsv, buildLeadMailto,
} from '../services/leads';
import { buildShopifyCartUrl, buildShopifyProductUrl, normalizeShopifyDomain, shopifyCoverage } from '../utils/shopify';
import { buildDhlTrackingUrl, estimateWeightGrams, ordersToDhlCsv } from '../utils/dhl';
import type {
  Book, IntegrationSettings, Language, Lead, LeadStatus, Order,
} from '../types';

type Section = 'shopify' | 'dhl' | 'leads' | 'analytics';

const inputCls = 'w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary bg-white';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label, hint, children, className,
}) => (
  <div className={className}>
    <label className="block text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">{label}</label>
    {children}
    {hint ? <p className="mt-1 text-[10px] text-gray-400">{hint}</p> : null}
  </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
  checked, onChange, label, hint,
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-full flex items-center gap-4 p-4 border text-left transition-colors ${
      checked ? 'border-primary bg-[#F4F4F0]' : 'border-gray-200 hover:border-gray-300'
    }`}
  >
    <span className={`w-5 h-5 border border-primary flex items-center justify-center ${checked ? 'bg-primary text-white' : ''}`}>
      {checked ? <Check size={12} /> : null}
    </span>
    <span>
      <span className="block text-xs uppercase font-bold tracking-widest">{label}</span>
      {hint ? <span className="block text-[10px] text-gray-500 mt-1 normal-case tracking-normal">{hint}</span> : null}
    </span>
  </button>
);

const downloadFile = (filename: string, content: string, type = 'text/csv;charset=utf-8') => {
  const blob = new Blob([`﻿${content}`], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Закрыта',
  archived: 'В архиве',
};

export const IntegrationsPanel: React.FC<{
  language: Language;
  orders: Order[];
  onToast: (message: string, type?: 'success' | 'error') => void;
  onReload?: () => void;
  /** Массовое сохранение трек-номеров: id заказа → номер. */
  onBulkTracking?: (pairs: { orderId: string; tracking: string }[]) => Promise<void>;
}> = ({ language, orders, onToast, onReload, onBulkTracking }) => {
  const [section, setSection] = useState<Section>('shopify');
  const [draft, setDraft] = useState<IntegrationSettings | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadFilter, setLeadFilter] = useState<'all' | LeadStatus>('all');
  const [testing, setTesting] = useState(false);
  const [analyticsLog, setAnalyticsLog] = useState(analytics.getLog());
  const [bulkTracking, setBulkTracking] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [settings, db] = await Promise.all([getIntegrations(true), api.getContentDatabase()]);
      setDraft(settings);
      setBooks(db[language].books);
      setLeads(getLeadLog());
      setAnalyticsLog(analytics.getLog());
      setDirty(false);
    } catch (e: any) {
      onToast(`Не удалось загрузить интеграции: ${e?.message || e}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [language]);

  const patch = (updater: (next: IntegrationSettings) => void) => {
    setDraft(prev => {
      if (!prev) return prev;
      const next: IntegrationSettings = JSON.parse(JSON.stringify(prev));
      updater(next);
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveIntegrations(draft);
      setDraft(saved);
      setDirty(false);
      onReload?.();
      onToast('Настройки интеграций сохранены и опубликованы');
    } catch (e: any) {
      onToast(`Ошибка сохранения: ${e?.message || e}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const coverage = useMemo(
    () => (draft ? shopifyCoverage(draft.shopify, books) : { linked: 0, total: 0 }),
    [draft, books],
  );

  const filteredLeads = useMemo(
    () => (leadFilter === 'all' ? leads : leads.filter(lead => lead.status === leadFilter)),
    [leads, leadFilter],
  );

  const testLeadEndpoint = async () => {
    if (!draft?.leads.endpointUrl) {
      onToast('Сначала укажите адрес эндпоинта', 'error');
      return;
    }
    setTesting(true);
    try {
      const payload = { source: 'ampublishing', type: 'test', sentAt: new Date().toISOString() };
      if (draft.leads.mode === 'webhook') {
        await fetch(draft.leads.endpointUrl, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        onToast('Тестовый запрос отправлен (режим webhook — ответ не читается)');
      } else {
        const res = await fetch(draft.leads.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        });
        onToast(res.ok ? `Эндпоинт ответил ${res.status} — работает` : `Эндпоинт ответил ${res.status}`, res.ok ? 'success' : 'error');
      }
    } catch (e: any) {
      onToast(`Не удалось достучаться: ${e?.message || e}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading || !draft) {
    return (
      <div className="bg-white border border-primary/10 p-12 flex items-center gap-3 text-gray-500">
        <Loader2 size={18} className="animate-spin" /> Загружаем настройки интеграций…
      </div>
    );
  }

  const analyticsStatus = analytics.status();
  const eventCounts = analyticsLog.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.name] = (acc[entry.name] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Шапка */}
      <div className="bg-white border border-primary/10 p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-0 z-20">
        <div>
          <h3 className="text-3xl font-serif leading-none">Интеграции</h3>
          <p className="mt-2 text-xs text-gray-500">
            Shopify · DHL · заявки · аналитика
            {dirty ? <span className="ml-2 text-amber-600 font-mono">● несохранённые изменения</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={14} /> Обновить
          </button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-white text-xs uppercase tracking-widest hover:bg-accent hover:text-primary disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить
          </button>
        </div>
      </div>

      {/* Разделы */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-primary/10 border border-primary/10">
        {([
          { id: 'shopify', label: 'Shopify', icon: <ShoppingBag size={14} />, on: draft.shopify.enabled },
          { id: 'dhl', label: 'DHL', icon: <Truck size={14} />, on: draft.dhl.enabled },
          { id: 'leads', label: 'Заявки', icon: <Inbox size={14} />, on: draft.leads.enabled, badge: leads.filter(l => l.status === 'new').length },
          { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={14} />, on: draft.analytics.enabled },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setSection(tab.id as Section)}
            className={`flex items-center justify-center gap-2 py-4 text-[10px] uppercase tracking-[0.18em] font-bold transition-colors ${
              section === tab.id ? 'bg-primary text-white' : 'bg-white hover:bg-gray-50'
            }`}>
            {tab.icon}{tab.label}
            <span className={`w-1.5 h-1.5 rounded-full ${tab.on ? 'bg-green-500' : 'bg-gray-300'}`} />
            {'badge' in tab && tab.badge ? (
              <span className="bg-accent text-primary px-1.5 text-[9px]">{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ─────────── SHOPIFY ─────────── */}
      {section === 'shopify' ? (
        <section className="bg-white border border-primary/10 p-5 md:p-6 space-y-6">
          <Toggle
            checked={draft.shopify.enabled}
            onChange={value => patch(next => { next.shopify.enabled = value; })}
            label="Продавать книги через Shopify"
            hint="Кнопка «Купить» на карточке книги ведёт в корзину вашего магазина Shopify с уже добавленным товаром."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Домен магазина" hint="Например ampublishing.myshopify.com или shop.ampublishing.org">
              <input className={inputCls} value={draft.shopify.domain} placeholder="ampublishing.myshopify.com"
                onChange={e => patch(next => { next.shopify.domain = e.target.value; })} />
            </Field>
            <Field label="Метка канала (ref)" hint="Появится в аналитике Shopify как источник перехода.">
              <input className={inputCls} value={draft.shopify.refTag}
                onChange={e => patch(next => { next.shopify.refTag = e.target.value; })} />
            </Field>
            <Field label="Storefront access token" hint="Пока не обязателен — понадобится, если позже подключим Buy Button SDK." className="md:col-span-2">
              <input className={`${inputCls} font-mono text-xs`} value={draft.shopify.storefrontToken}
                onChange={e => patch(next => { next.shopify.storefrontToken = e.target.value; })} />
            </Field>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-xl font-serif">Привязка книг к товарам</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Привязано {coverage.linked} из {coverage.total} книг каталога ({language.toUpperCase()}).
                  ID варианта — это число в адресе товара в админке Shopify: …/variants/<b>1234567890</b>.
                </p>
              </div>
              <button
                onClick={() => patch(next => {
                  const missing = books.filter(book => !next.shopify.products.some(p => p.bookId === book.id));
                  missing.forEach(book => next.shopify.products.push({ bookId: book.id, variantId: '', handle: '', enabled: true }));
                })}
                className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-primary hover:bg-primary hover:text-white inline-flex items-center gap-2">
                <Plus size={12} /> Добавить все книги
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-[#F8F8F5] text-[10px] uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2">Книга</th>
                    <th className="text-left px-3 py-2">ID варианта</th>
                    <th className="text-left px-3 py-2">Handle товара</th>
                    <th className="text-left px-3 py-2">Проверка</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {draft.shopify.products.map((product, index) => {
                    const book = books.find(entry => entry.id === product.bookId);
                    const cartUrl = buildShopifyCartUrl(draft.shopify, product.variantId, 1);
                    const productUrl = buildShopifyProductUrl(draft.shopify, product.handle);
                    return (
                      <tr key={`${product.bookId}-${index}`} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2">
                          <select className="w-full border border-gray-300 px-2 py-2 text-xs bg-white"
                            value={product.bookId}
                            onChange={e => patch(next => { next.shopify.products[index].bookId = e.target.value; })}>
                            <option value="">— выберите книгу —</option>
                            {books.map(entry => <option key={entry.id} value={entry.id}>{entry.title}</option>)}
                          </select>
                          {!book && product.bookId ? (
                            <span className="text-[10px] text-amber-600">книги с таким id нет в {language.toUpperCase()}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <input className="w-full border border-gray-300 px-2 py-2 font-mono text-xs"
                            value={product.variantId} placeholder="1234567890"
                            onChange={e => patch(next => { next.shopify.products[index].variantId = e.target.value; })} />
                        </td>
                        <td className="px-3 py-2">
                          <input className="w-full border border-gray-300 px-2 py-2 font-mono text-xs"
                            value={product.handle || ''} placeholder="vse-chto-ostanetsya"
                            onChange={e => patch(next => { next.shopify.products[index].handle = e.target.value; })} />
                        </td>
                        <td className="px-3 py-2 space-y-1">
                          {cartUrl ? (
                            <a href={cartUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] underline hover:text-accent">
                              <Link2 size={10} /> корзина
                            </a>
                          ) : <span className="text-[10px] text-gray-400">нет данных</span>}
                          {productUrl ? (
                            <a href={productUrl} target="_blank" rel="noopener noreferrer"
                              className="block text-[10px] underline hover:text-accent">товар</a>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => patch(next => { next.shopify.products.splice(index, 1); })}
                            className="p-2 border border-red-200 text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {!draft.shopify.products.length ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-sm text-gray-400">Пока ничего не привязано.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => patch(next => { next.shopify.products.push({ bookId: '', variantId: '', handle: '', enabled: true }); })}
              className="mt-4 px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2">
              <Plus size={12} /> Добавить строку
            </button>

            {draft.shopify.enabled && !normalizeShopifyDomain(draft.shopify.domain) ? (
              <p className="mt-4 border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle size={14} /> Интеграция включена, но домен магазина не указан — кнопки Shopify работать не будут.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ─────────── DHL ─────────── */}
      {section === 'dhl' ? (
        <section className="bg-white border border-primary/10 p-5 md:p-6 space-y-6">
          <Toggle
            checked={draft.dhl.enabled}
            onChange={value => patch(next => { next.dhl.enabled = value; })}
            label="Считать доставку по тарифам DHL"
            hint="В корзине стоимость доставки считается по стране получателя и весу посылки вместо фиксированных 5/15 €."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Номер клиента DHL (EKP)"><input className={inputCls} value={draft.dhl.accountNumber}
              onChange={e => patch(next => { next.dhl.accountNumber = e.target.value; })} /></Field>
            <Field label="Вес одной книги, г"><input type="number" className={inputCls} value={draft.dhl.defaultItemWeightGrams}
              onChange={e => patch(next => { next.dhl.defaultItemWeightGrams = Number(e.target.value) || 0; })} /></Field>
            <Field label="Вес упаковки, г"><input type="number" className={inputCls} value={draft.dhl.packagingWeightGrams}
              onChange={e => patch(next => { next.dhl.packagingWeightGrams = Number(e.target.value) || 0; })} /></Field>
            <Field label="Бесплатная доставка от, €" hint="0 — выключить"><input type="number" className={inputCls} value={draft.dhl.freeShippingThreshold}
              onChange={e => patch(next => { next.dhl.freeShippingThreshold = Number(e.target.value) || 0; })} /></Field>
            <Field label="Наценка за экспресс, €"><input type="number" step="0.1" className={inputCls} value={draft.dhl.expressSurcharge}
              onChange={e => patch(next => { next.dhl.expressSurcharge = Number(e.target.value) || 0; })} /></Field>
            <Field label="Ссылка отслеживания" hint="{tracking} = номер посылки"><input className={`${inputCls} font-mono text-xs`} value={draft.dhl.trackingUrlTemplate}
              onChange={e => patch(next => { next.dhl.trackingUrlTemplate = e.target.value; })} /></Field>
          </div>

          <div className="border-t border-gray-100 pt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Отправитель"><input className={inputCls} value={draft.dhl.senderName}
              onChange={e => patch(next => { next.dhl.senderName = e.target.value; })} /></Field>
            <Field label="Улица, дом"><input className={inputCls} value={draft.dhl.senderStreet}
              onChange={e => patch(next => { next.dhl.senderStreet = e.target.value; })} /></Field>
            <Field label="Индекс"><input className={inputCls} value={draft.dhl.senderZip}
              onChange={e => patch(next => { next.dhl.senderZip = e.target.value; })} /></Field>
            <Field label="Город"><input className={inputCls} value={draft.dhl.senderCity}
              onChange={e => patch(next => { next.dhl.senderCity = e.target.value; })} /></Field>
            <Field label="Страна (ISO)"><input className={inputCls} value={draft.dhl.senderCountry}
              onChange={e => patch(next => { next.dhl.senderCountry = e.target.value.toUpperCase(); })} /></Field>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-serif">Тарифы</h4>
              <button onClick={() => patch(next => {
                next.dhl.rates.push({
                  id: `rate-${Date.now().toString(36)}`, label: 'Новая зона', countries: '',
                  maxWeightGrams: 2000, price: 0, product: 'DHL Paket', deliveryDays: '',
                });
              })} className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-primary hover:bg-primary hover:text-white inline-flex items-center gap-2">
                <Plus size={12} /> Тариф
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-[#F8F8F5] text-[10px] uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2">Зона</th>
                    <th className="text-left px-3 py-2">Страны (ISO, через запятую)</th>
                    <th className="text-left px-3 py-2">До, г</th>
                    <th className="text-left px-3 py-2">Цена, €</th>
                    <th className="text-left px-3 py-2">Продукт DHL</th>
                    <th className="text-left px-3 py-2">Дней</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {draft.dhl.rates.map((rate, index) => (
                    <tr key={rate.id} className="border-t border-gray-100">
                      <td className="px-3 py-2"><input className="w-full border border-gray-300 px-2 py-2 text-xs" value={rate.label}
                        onChange={e => patch(next => { next.dhl.rates[index].label = e.target.value; })} /></td>
                      <td className="px-3 py-2"><input className="w-full border border-gray-300 px-2 py-2 font-mono text-[11px]" value={rate.countries}
                        placeholder="пусто = весь остальной мир"
                        onChange={e => patch(next => { next.dhl.rates[index].countries = e.target.value.toUpperCase(); })} /></td>
                      <td className="px-3 py-2"><input type="number" className="w-24 border border-gray-300 px-2 py-2 text-xs" value={rate.maxWeightGrams}
                        onChange={e => patch(next => { next.dhl.rates[index].maxWeightGrams = Number(e.target.value) || 0; })} /></td>
                      <td className="px-3 py-2"><input type="number" step="0.01" className="w-24 border border-gray-300 px-2 py-2 text-xs" value={rate.price}
                        onChange={e => patch(next => { next.dhl.rates[index].price = Number(e.target.value) || 0; })} /></td>
                      <td className="px-3 py-2"><input className="w-full border border-gray-300 px-2 py-2 text-xs" value={rate.product}
                        onChange={e => patch(next => { next.dhl.rates[index].product = e.target.value; })} /></td>
                      <td className="px-3 py-2"><input className="w-20 border border-gray-300 px-2 py-2 text-xs" value={rate.deliveryDays}
                        onChange={e => patch(next => { next.dhl.rates[index].deliveryDays = e.target.value; })} /></td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => patch(next => { next.dhl.rates.splice(index, 1); })}
                          className="p-2 border border-red-200 text-red-600 hover:bg-red-50"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 space-y-4">
            <h4 className="text-xl font-serif">Отправка заказов</h4>
            <p className="text-xs text-gray-500">
              CSV со всеми заказами в формате получателей для импорта в DHL Geschäftskundenportal
              (Sendungen → Import). Вес считается по настройкам выше.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => downloadFile(`dhl-orders-${new Date().toISOString().slice(0, 10)}.csv`, ordersToDhlCsv(orders, draft.dhl))}
                className="inline-flex items-center gap-2 px-4 py-3 border border-primary text-xs uppercase tracking-widest hover:bg-primary hover:text-white">
                <Download size={14} /> Выгрузить {orders.length} заказов
              </button>
              <button
                onClick={() => downloadFile(
                  `dhl-orders-open-${new Date().toISOString().slice(0, 10)}.csv`,
                  ordersToDhlCsv(orders.filter(order => order.status === 'processing' || order.status === 'pending'), draft.dhl),
                )}
                className="inline-flex items-center gap-2 px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest hover:bg-gray-50">
                <Download size={14} /> Только неотправленные
              </button>
              <a href="https://geschaeftskunden.dhl.de/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest hover:bg-gray-50">
                <ExternalLink size={14} /> Портал DHL
              </a>
            </div>

            {/* Массовая вставка трек-номеров: портал DHL отдаёт список
                «номер заказа; трек-номер» — вставляем его целиком. */}
            <div className="border border-dashed border-primary/40 bg-[#F8F8F5] p-4 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                Вставить трек-номера списком
              </p>
              <textarea
                value={bulkTracking}
                onChange={e => setBulkTracking(e.target.value)}
                rows={4}
                placeholder={'AM-0001; 00340434161094042557\nAM-0002, 00340434161094042558'}
                className="w-full border border-gray-300 px-3 py-2 font-mono text-xs bg-white"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={bulkBusy || !bulkTracking.trim()}
                  onClick={async () => {
                    const pairs = bulkTracking
                      .split('\n')
                      .map(line => line.split(/[;,\t]+/).map(part => part.trim()))
                      .filter(parts => parts.length >= 2 && parts[0] && parts[1])
                      .map(parts => ({ orderId: parts[0], tracking: parts[1] }));
                    const known = pairs.filter(pair => orders.some(order => order.id === pair.orderId));
                    if (!known.length) {
                      onToast('Ни один номер заказа не совпал со списком заказов', 'error');
                      return;
                    }
                    setBulkBusy(true);
                    try {
                      await onBulkTracking?.(known);
                      onToast(`Сохранено трек-номеров: ${known.length}${known.length < pairs.length ? ` (пропущено ${pairs.length - known.length})` : ''}`);
                      setBulkTracking('');
                    } catch (e: any) {
                      onToast(`Не удалось сохранить: ${e?.message || e}`, 'error');
                    } finally {
                      setBulkBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-[10px] uppercase tracking-widest hover:bg-accent hover:text-primary disabled:opacity-50">
                  {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Сохранить номера
                </button>
                <span className="text-[10px] text-gray-500">
                  По строке на заказ: номер заказа, затем трек-номер через запятую, точку с запятой или табуляцию.
                </span>
              </div>
            </div>

            {orders.some(order => order.trackingNumber) ? (
              <div className="border border-primary/10">
                <p className="px-4 py-2 bg-[#F8F8F5] text-[10px] uppercase tracking-widest text-gray-500">Отслеживание</p>
                <ul className="divide-y divide-gray-100">
                  {orders.filter(order => order.trackingNumber).map(order => {
                    const url = buildDhlTrackingUrl(draft.dhl, order.trackingNumber!);
                    return (
                      <li key={order.id} className="px-4 py-3 flex items-center justify-between gap-4 text-sm">
                        <span className="font-mono text-xs">{order.id}</span>
                        <span className="font-mono text-xs text-gray-500">{order.trackingNumber}</span>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            onClick={() => analytics.dhlTrackingClick(order.id)}
                            className="text-xs underline hover:text-accent">открыть</a>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Номера отслеживания появятся здесь, когда вы впишете их в заказы (вкладка «Заказы»).
              </p>
            )}

            <p className="text-[11px] text-gray-500">
              Расчётный вес посылки на одну книгу:{' '}
              <b>{(estimateWeightGrams(draft.dhl, [{ quantity: 1 }]) / 1000).toFixed(2)} кг</b>
            </p>
          </div>
        </section>
      ) : null}

      {/* ─────────── ЗАЯВКИ ─────────── */}
      {section === 'leads' ? (
        <section className="bg-white border border-primary/10 p-5 md:p-6 space-y-6">
          <Toggle
            checked={draft.leads.enabled}
            onChange={value => patch(next => { next.leads.enabled = value; })}
            label="Принимать заявки с сайта"
            hint="Форма на /services/order отправляет заявку на указанный ниже адрес приёма."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Адрес приёма заявок" hint="Formspree, Getform, Make, n8n — любой URL, принимающий POST с JSON." className="md:col-span-2">
              <input className={`${inputCls} font-mono text-xs`} value={draft.leads.endpointUrl}
                placeholder="https://formspree.io/f/xxxxxxx"
                onChange={e => patch(next => { next.leads.endpointUrl = e.target.value; })} />
            </Field>
            <Field label="Режим отправки" hint="«Форма» читает ответ сервиса; «webhook» — для мостов без CORS.">
              <select className={inputCls} value={draft.leads.mode}
                onChange={e => patch(next => { next.leads.mode = e.target.value as 'form' | 'webhook'; })}>
                <option value="form">Форма (Formspree / Getform)</option>
                <option value="webhook">Webhook (Make / n8n / Zapier)</option>
              </select>
            </Field>
            <Field label="Почта для запасного письма" hint="Если отправка не удалась, клиенту откроется уже заполненное письмо на этот адрес.">
              <input className={inputCls} value={draft.leads.fallbackEmail}
                onChange={e => patch(next => { next.leads.fallbackEmail = e.target.value; })} />
            </Field>
            <Field label="Копия в Telegram/Slack (webhook)" className="md:col-span-2"
              hint="Необязательно: тот же мост, что и для уведомлений о заказах.">
              <input className={`${inputCls} font-mono text-xs`} value={draft.leads.notifyWebhookUrl}
                onChange={e => patch(next => { next.leads.notifyWebhookUrl = e.target.value; })} />
            </Field>
          </div>

          <button onClick={testLeadEndpoint} disabled={testing}
            className="inline-flex items-center gap-2 px-4 py-3 border border-primary text-xs uppercase tracking-widest hover:bg-primary hover:text-white disabled:opacity-50">
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Проверить эндпоинт
          </button>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-xl font-serif">Журнал заявок</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Копии заявок, отправленных из этого браузера. Основной список ведёт сервис приёма — журнал нужен,
                  чтобы ничего не потерялось при сбое отправки.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select className="border border-gray-300 px-3 py-2 text-xs" value={leadFilter}
                  onChange={e => setLeadFilter(e.target.value as any)}>
                  <option value="all">Все ({leads.length})</option>
                  {(Object.keys(STATUS_LABEL) as LeadStatus[]).map(status => (
                    <option key={status} value={status}>{STATUS_LABEL[status]} ({leads.filter(l => l.status === status).length})</option>
                  ))}
                </select>
                <button onClick={() => downloadFile(`leads-${new Date().toISOString().slice(0, 10)}.csv`, leadsToCsv(leads))}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-[10px] uppercase tracking-widest hover:bg-gray-50">
                  <Download size={12} /> CSV
                </button>
                <button onClick={() => { setLeads(clearLeadLog()); onToast('Журнал очищен'); }}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 text-[10px] uppercase tracking-widest hover:bg-red-50">
                  <Trash2 size={12} /> Очистить
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100 border border-primary/10">
              {filteredLeads.map(lead => (
                <div key={lead.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div>
                      <p className="font-serif text-xl leading-tight">{lead.serviceTitle || lead.service}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400">
                        {new Date(lead.createdAt).toLocaleString()} · {lead.id} · {lead.language.toUpperCase()}
                        {lead.delivered ? '' : ' · не доставлена'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <select className="border border-gray-300 px-2 py-1.5 text-[11px]" value={lead.status}
                        onChange={e => setLeads(updateLeadStatus(lead.id, e.target.value as LeadStatus))}>
                        {(Object.keys(STATUS_LABEL) as LeadStatus[]).map(status => (
                          <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                        ))}
                      </select>
                      <a href={buildLeadMailto(lead, lead.email)} className="p-2 border border-gray-200 hover:bg-gray-50" title="Ответить">
                        <Send size={12} />
                      </a>
                      <button onClick={() => setLeads(deleteLead(lead.id))}
                        className="p-2 border border-red-200 text-red-600 hover:bg-red-50"><X size={12} /></button>
                    </div>
                  </div>
                  <p className="text-sm">
                    <b>{lead.name}</b> · <a href={`mailto:${lead.email}`} className="underline hover:text-accent">{lead.email}</a>
                    {lead.phone ? ` · ${lead.phone}` : ''}
                  </p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{lead.message}</p>
                  {lead.attribution?.source ? (
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400">
                      источник: {lead.attribution.source}
                      {lead.attribution.campaign ? ` · ${lead.attribution.campaign}` : ''}
                      {lead.attribution.landingPage ? ` · ${lead.attribution.landingPage}` : ''}
                    </p>
                  ) : null}
                </div>
              ))}
              {!filteredLeads.length ? (
                <p className="p-6 text-sm text-gray-400">Заявок пока нет.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* ─────────── АНАЛИТИКА ─────────── */}
      {section === 'analytics' ? (
        <section className="bg-white border border-primary/10 p-5 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Toggle
              checked={draft.analytics.enabled}
              onChange={value => patch(next => { next.analytics.enabled = value; })}
              label="Включить счётчики"
              hint="Скрипты подключаются только к тем сервисам, у которых заполнен идентификатор."
            />
            <Toggle
              checked={draft.analytics.requireConsent}
              onChange={value => patch(next => { next.analytics.requireConsent = value; })}
              label="Требовать согласие на cookie (GDPR)"
              hint="Счётчики грузятся только после нажатия «Принять» в баннере."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="GA4 Measurement ID" hint="Формат G-XXXXXXXXXX">
              <input className={`${inputCls} font-mono text-xs`} value={draft.analytics.ga4MeasurementId} placeholder="G-XXXXXXXXXX"
                onChange={e => patch(next => { next.analytics.ga4MeasurementId = e.target.value.trim(); })} />
            </Field>
            <Field label="Plausible: домен" hint="ampublishing.org — счётчик без cookie">
              <input className={`${inputCls} font-mono text-xs`} value={draft.analytics.plausibleDomain}
                onChange={e => patch(next => { next.analytics.plausibleDomain = e.target.value.trim(); })} />
            </Field>
            <Field label="Umami: website ID">
              <input className={`${inputCls} font-mono text-xs`} value={draft.analytics.umamiWebsiteId}
                onChange={e => patch(next => { next.analytics.umamiWebsiteId = e.target.value.trim(); })} />
            </Field>
            <Field label="Umami: адрес скрипта">
              <input className={`${inputCls} font-mono text-xs`} value={draft.analytics.umamiScriptUrl}
                placeholder="https://analytics.example.com/script.js"
                onChange={e => patch(next => { next.analytics.umamiScriptUrl = e.target.value.trim(); })} />
            </Field>
            <Field label="Meta Pixel ID" hint="Только если планируется реклама в Facebook/Instagram.">
              <input className={`${inputCls} font-mono text-xs`} value={draft.analytics.metaPixelId}
                onChange={e => patch(next => { next.analytics.metaPixelId = e.target.value.trim(); })} />
            </Field>
            <Field label="Локальный журнал событий" hint="Нужен для сводки ниже; на сайт посетителя не влияет.">
              <Toggle checked={draft.analytics.keepLocalLog} label="Вести журнал"
                onChange={value => patch(next => { next.analytics.keepLocalLog = value; })} />
            </Field>
          </div>

          <div className="border-t border-gray-100 pt-6 grid grid-cols-2 md:grid-cols-4 gap-px bg-primary/10 border border-primary/10">
            {[
              { label: 'Настройки', value: analyticsStatus.enabled ? 'включены' : 'выключены' },
              { label: 'Согласие', value: analyticsStatus.consent ? 'дано' : 'нет' },
              { label: 'Скрипты', value: analyticsStatus.loaded ? 'загружены' : 'не загружены' },
              { label: 'Активны', value: Object.entries(analyticsStatus.providers).filter(([, on]) => on).map(([key]) => key).join(', ') || '—' },
            ].map(cell => (
              <div key={cell.label} className="bg-white p-4">
                <p className="text-[10px] uppercase tracking-widest text-gray-400">{cell.label}</p>
                <p className="font-mono text-sm mt-1">{cell.value}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xl font-serif">События в этом браузере</h4>
              <div className="flex gap-2">
                <button onClick={() => setAnalyticsLog(analytics.getLog())}
                  className="px-3 py-2 border border-gray-300 text-[10px] uppercase tracking-widest hover:bg-gray-50 inline-flex items-center gap-2">
                  <RefreshCw size={12} /> Обновить
                </button>
                <button
                  onClick={() => downloadFile(
                    `analytics-${new Date().toISOString().slice(0, 10)}.csv`,
                    ['Дата;Событие;Параметры', ...analyticsLog.map(entry =>
                      `${new Date(entry.ts).toLocaleString()};${entry.name};"${JSON.stringify(entry.params).replace(/"/g, '""')}"`)].join('\n'),
                  )}
                  className="px-3 py-2 border border-gray-300 text-[10px] uppercase tracking-widest hover:bg-gray-50 inline-flex items-center gap-2">
                  <Download size={12} /> CSV
                </button>
                <button onClick={() => { analytics.clearLog(); setAnalyticsLog([]); }}
                  className="px-3 py-2 border border-red-200 text-red-600 text-[10px] uppercase tracking-widest hover:bg-red-50 inline-flex items-center gap-2">
                  <Trash2 size={12} /> Очистить
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {Object.entries(eventCounts).sort(([, a], [, b]) => Number(b) - Number(a)).slice(0, 8).map(([name, count]) => (
                <div key={name} className="border border-primary/10 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 truncate">{name}</p>
                  <p className="font-serif text-2xl">{count}</p>
                </div>
              ))}
              {!analyticsLog.length ? <p className="text-sm text-gray-400 col-span-full">Событий пока нет.</p> : null}
            </div>

            <div className="max-h-64 overflow-y-auto border border-primary/10 divide-y divide-gray-100">
              {analyticsLog.slice(0, 60).map((entry, index) => (
                <div key={index} className="px-3 py-2 flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-gray-400">{new Date(entry.ts).toLocaleTimeString()}</span>
                  <span className="font-bold">{entry.name}</span>
                  <span className="text-gray-500 truncate">{JSON.stringify(entry.params)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};
