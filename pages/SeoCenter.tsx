import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle, ExternalLink, Globe, Info, Loader2, RotateCcw, Save, Search, Share2, ShieldCheck, XCircle,
} from 'lucide-react';
import type { Book, EntrySeo, Language, LocalizedCatalogData, NewsItem, SeoSettings } from '../types';
import { getSeoSettings, saveSeoSettings } from '../services/seoSettings';
import {
  SITE_URL,
  ROUTE_SEO,
  absoluteUrl,
  auditMeta,
  mergeSeoSettings,
  resolveBookMeta,
  resolveNewsMeta,
  resolveRouteMeta,
} from '../seo/core.mjs';

const LANGS: Language[] = ['ru', 'en', 'de'];
const inputCls = 'w-full border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary';

const PAGE_LABELS: Record<string, string> = {
  '/': 'Главная',
  '/catalog': 'Каталог',
  '/our-authors': 'Наши авторы',
  '/authors': 'Авторам',
  '/about': 'О нас',
  '/media': 'Мероприятия',
  '/radio': 'Радио',
  '/services': 'Услуги',
  '/services/order': 'Заявка на услуги',
  '/tracking': 'Отслеживание',
  '/privacy': 'Конфиденциальность',
  '/terms': 'Условия',
  '/impressum': 'Impressum',
};

const ISSUE_TEXT: Record<string, (value?: number) => string> = {
  'title-missing': () => 'Нет заголовка',
  'title-long': value => `Заголовок длинный (${value} симв.) — Google обрежет после ~60`,
  'title-short': value => `Заголовок короткий (${value} симв.)`,
  'description-missing': () => 'Нет описания',
  'description-short': value => `Описание короткое (${value} симв.) — лучше 120–160`,
  'image-missing': () => 'Нет картинки для превью в соцсетях',
  noindex: () => 'Скрыто от поисковиков (noindex)',
  isbn: () => 'Нет ISBN — Google Книги и магазины не свяжут издание',
  alt: () => 'Нет alt-текста обложки',
};

type Issue = { level: 'error' | 'warn' | 'info'; code: string; value?: number };

/** Character counter coloured by the range search engines actually display. */
export const LengthMeter: React.FC<{ value: string; min: number; max: number }> = ({ value, min, max }) => {
  const length = value.length;
  const tone = length === 0 ? 'text-gray-400' : length < min ? 'text-amber-600' : length > max ? 'text-red-600' : 'text-emerald-700';
  const width = Math.min(100, (length / max) * 100);
  return (
    <div className="mt-1.5 flex items-center gap-3">
      <div className="h-1 flex-1 overflow-hidden bg-gray-100">
        <div className={`h-full transition-all ${length > max ? 'bg-red-500' : length < min ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${width}%` }} />
      </div>
      <span className={`font-mono text-[10px] tabular-nums ${tone}`}>{length}/{max}</span>
    </div>
  );
};

/** Google-style result snippet + social card, so editors see what readers will see. */
export const SeoPreview: React.FC<{ title: string; description: string; path: string; image?: string }> = ({ title, description, path, image }) => {
  const url = `${SITE_URL}${path}`;
  const crumbs = path.split('/').filter(Boolean);
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
      <div className="border border-primary/10 bg-white p-5">
        <p className="mb-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400"><Search size={11} /> Google</p>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white"><img src="/icons/icon-32.png" alt="" className="h-4 w-4" /></span>
          <div className="min-w-0 leading-tight">
            <p className="text-[13px] text-[#202124]">AM Publishing Berlin</p>
            <p className="truncate text-[11px] text-[#4d5156]">ampublishing.org{crumbs.length ? ` › ${crumbs.map(decodeURIComponent).join(' › ')}` : ''}</p>
          </div>
        </div>
        <p className="mt-2 line-clamp-1 text-[19px] leading-snug text-[#1a0dab]">{title || 'Без заголовка'}</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[#4d5156]">{description || 'Описание не задано — Google подставит случайный фрагмент страницы.'}</p>
      </div>
      <div className="overflow-hidden border border-primary/10 bg-white">
        <p className="flex items-center gap-2 px-4 pt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-gray-400"><Share2 size={11} /> Telegram / Facebook</p>
        <div className="m-3 border-l-[3px] border-[#3390ec] bg-[#f4f8fc] p-3">
          <p className="text-[12px] font-semibold text-[#3390ec]">AM Publishing Berlin</p>
          <p className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-[#0f1419]">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] text-[#536471]">{description}</p>
          {image ? <img src={absoluteUrl(image).replace(SITE_URL, '')} alt="" className="mt-2 aspect-[1.91/1] w-full bg-gray-100 object-cover" loading="lazy" /> : null}
        </div>
        <p className="truncate px-4 pb-3 font-mono text-[10px] text-gray-400">{url}</p>
      </div>
    </div>
  );
};

const IssueBadges: React.FC<{ issues: Issue[] }> = ({ issues }) => {
  const visible = issues.filter(issue => issue.level !== 'info');
  if (!visible.length) {
    return <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-emerald-700"><CheckCircle size={12} /> OK</span>;
  }
  return (
    <ul className="space-y-1">
      {visible.map(issue => (
        <li key={issue.code} className={`flex items-start gap-1.5 text-xs ${issue.level === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
          {issue.level === 'error' ? <XCircle size={13} className="mt-0.5 shrink-0" /> : <AlertTriangle size={13} className="mt-0.5 shrink-0" />}
          {ISSUE_TEXT[issue.code]?.(issue.value) || issue.code}
        </li>
      ))}
    </ul>
  );
};

type AuditRow = {
  kind: 'page' | 'book' | 'news';
  id: string;
  label: string;
  path: string;
  issues: Issue[];
};

export const SeoCenter: React.FC<{
  database: Record<Language, LocalizedCatalogData>;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenBook: (id: string) => void;
  onOpenNews: (id: string) => void;
}> = ({ database, onToast, onOpenBook, onOpenNews }) => {
  const [settings, setSettings] = useState<SeoSettings | null>(null);
  const [saved, setSaved] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<'audit' | 'pages' | 'global' | 'tools'>('audit');
  const [pageLang, setPageLang] = useState<Language>('ru');
  const [selectedPage, setSelectedPage] = useState('/');

  useEffect(() => {
    getSeoSettings(true).then(value => {
      setSettings(value);
      setSaved(JSON.stringify(value));
    }).catch(() => onToast('Не удалось загрузить SEO-настройки', 'error'));
  }, []);

  const dirty = settings ? JSON.stringify(settings) !== saved : false;

  const audit = useMemo<AuditRow[]>(() => {
    if (!settings) return [];
    const rows: AuditRow[] = [];
    Object.keys(ROUTE_SEO).forEach(path => {
      const meta = resolveRouteMeta(path, 'ru', settings);
      if (meta.robots.startsWith('noindex')) return;
      rows.push({ kind: 'page', id: path, label: PAGE_LABELS[path] || path, path, issues: auditMeta(meta) as Issue[] });
    });
    database.ru.books.forEach((book: Book) => {
      const meta = resolveBookMeta(book, settings);
      const issues = auditMeta(meta, { hasImage: Boolean(book.coverUrl) }) as Issue[];
      if (!book.variants?.some(variant => variant.isbn)) issues.push({ level: 'warn', code: 'isbn' });
      if (!book.coverAlt) issues.push({ level: 'warn', code: 'alt' });
      rows.push({ kind: 'book', id: book.id, label: book.title || book.id, path: meta.path, issues });
    });
    database.ru.news.forEach((item: NewsItem) => {
      const meta = resolveNewsMeta(item, settings);
      const issues = auditMeta(meta, { hasImage: Boolean(item.imageUrl) }) as Issue[];
      rows.push({ kind: 'news', id: item.id, label: item.title || item.id, path: meta.path, issues });
    });
    return rows;
  }, [database, settings]);

  const errorCount = audit.reduce((sum, row) => sum + row.issues.filter(issue => issue.level === 'error').length, 0);
  const warnCount = audit.reduce((sum, row) => sum + row.issues.filter(issue => issue.level === 'warn').length, 0);
  const cleanCount = audit.filter(row => !row.issues.some(issue => issue.level !== 'info')).length;
  const score = audit.length ? Math.max(0, Math.round(100 - (errorCount * 12 + warnCount * 3) / Math.max(1, audit.length) * 4)) : 100;

  if (!settings) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  const update = (patch: Partial<SeoSettings>) => setSettings(prev => prev ? { ...prev, ...patch } : prev);
  const pageEntry = settings.pages[selectedPage] || {};
  const pageLocale = pageEntry[pageLang] || {};
  const builtIn = (ROUTE_SEO as Record<string, any>)[selectedPage]?.[pageLang] || {};
  const setPage = (patch: Record<string, unknown>) =>
    update({ pages: { ...settings.pages, [selectedPage]: { ...pageEntry, ...patch } } });
  const setPageLocale = (patch: { title?: string; description?: string }) =>
    setPage({ [pageLang]: { ...pageLocale, ...patch } });
  const resolved = resolveRouteMeta(selectedPage, pageLang, settings);

  const handleSave = async () => {
    setSaving(true);
    try {
      const next = await saveSeoSettings(settings);
      setSettings(next);
      setSaved(JSON.stringify(next));
      onToast('SEO сохранено — сайт пересоберётся за ~1 минуту');
    } catch (error) {
      onToast(error instanceof Error ? error.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  const liveUrl = (path: string) => `${SITE_URL}${path}`;
  const encoded = (path: string) => encodeURIComponent(liveUrl(path));

  return (
    <section className="space-y-6 pb-16">
      {/* Score strip */}
      <div className="grid gap-px border border-primary/10 bg-primary/10 md:grid-cols-4">
        <div className="relative overflow-hidden bg-primary p-6 text-white">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">SEO-здоровье</p>
          <p className="mt-3 font-serif text-6xl leading-none text-accent">{score}<span className="text-xl text-white/40">/100</span></p>
          <div className="mt-4 h-1 bg-white/10"><div className="h-full bg-accent" style={{ width: `${score}%` }} /></div>
        </div>
        {[
          { label: 'Без замечаний', value: cleanCount, sub: `из ${audit.length} страниц`, tone: 'text-emerald-700' },
          { label: 'Ошибки', value: errorCount, sub: 'критично для выдачи', tone: errorCount ? 'text-red-600' : 'text-primary' },
          { label: 'Предупреждения', value: warnCount, sub: 'стоит улучшить', tone: warnCount ? 'text-amber-600' : 'text-primary' },
        ].map(card => (
          <div key={card.label} className="bg-white p-6">
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">{card.label}</p>
            <p className={`mt-3 font-serif text-5xl leading-none ${card.tone}`}>{card.value}</p>
            <p className="mt-2 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Section switch + save */}
      <div className="sticky top-0 z-10 flex flex-col gap-3 border border-primary/10 bg-white/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist">
          {([
            ['audit', 'Аудит'],
            ['pages', 'Страницы'],
            ['global', 'Общие настройки'],
            ['tools', 'Инструменты'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={section === id}
              onClick={() => setSection(id)}
              className={`min-h-[40px] px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${section === id ? 'bg-primary text-white' : 'text-gray-500 hover:bg-[#F4F4F0] hover:text-primary'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {dirty ? <span className="font-mono text-[10px] uppercase tracking-widest text-amber-700">Есть изменения</span> : null}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex min-h-[40px] items-center gap-2 bg-primary px-5 text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-accent hover:text-primary disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить SEO
          </button>
        </div>
      </div>

      {section === 'audit' ? (
        <div className="border border-primary/10 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-primary/10 p-6">
            <div>
              <h2 className="font-serif text-3xl">Аудит страниц</h2>
              <p className="mt-1 text-sm text-gray-500">Заголовки, описания, картинки превью, ISBN и alt-тексты — по русской версии, которую видят поисковики и Telegram.</p>
            </div>
          </div>
          <div className="divide-y divide-primary/10">
            {audit
              .slice()
              .sort((a, b) => b.issues.filter(i => i.level === 'error').length * 10 + b.issues.length - (a.issues.filter(i => i.level === 'error').length * 10 + a.issues.length))
              .map(row => (
                <div key={`${row.kind}-${row.id}`} className="grid gap-3 p-4 md:grid-cols-[110px_1fr_1.2fr_auto] md:items-center md:px-6">
                  <span className={`w-fit px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-widest ${row.kind === 'book' ? 'bg-accent/20 text-primary' : row.kind === 'news' ? 'bg-sky-50 text-sky-800' : 'bg-gray-100 text-gray-600'}`}>
                    {row.kind === 'book' ? 'Книга' : row.kind === 'news' ? 'Материал' : 'Страница'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{row.label}</p>
                    <p className="truncate font-mono text-[10px] text-gray-400">{row.path}</p>
                  </div>
                  <IssueBadges issues={row.issues} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (row.kind === 'book') onOpenBook(row.id);
                        else if (row.kind === 'news') onOpenNews(row.id);
                        else { setSelectedPage(row.id); setSection('pages'); }
                      }}
                      className="min-h-[36px] border border-primary/20 px-3 text-[10px] font-bold uppercase tracking-widest hover:border-primary"
                    >
                      Исправить
                    </button>
                    <a href={row.path} target="_blank" rel="noopener noreferrer" className="flex min-h-[36px] items-center border border-primary/20 px-2 hover:border-primary" aria-label="Открыть на сайте"><ExternalLink size={13} /></a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {section === 'pages' ? (
        <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
          <nav className="border border-primary/10 bg-white" aria-label="Страницы">
            {Object.keys(ROUTE_SEO).map(path => {
              const overridden = Boolean(settings.pages[path] && Object.values(settings.pages[path]).some(value => value && (typeof value !== 'object' || Object.values(value).some(Boolean))));
              return (
                <button
                  key={path}
                  onClick={() => setSelectedPage(path)}
                  className={`flex w-full items-center justify-between border-l-2 px-4 py-3 text-left text-sm transition-colors ${selectedPage === path ? 'border-accent bg-[#F4F4F0] font-semibold' : 'border-transparent hover:bg-[#FAFAF7]'}`}
                >
                  <span>{PAGE_LABELS[path] || path}</span>
                  {overridden ? <span className="h-1.5 w-1.5 rounded-full bg-accent" title="Есть свои настройки" /> : null}
                </button>
              );
            })}
          </nav>

          <div className="space-y-6">
            <div className="border border-primary/10 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-400">{selectedPage}</p>
                  <h2 className="mt-1 font-serif text-3xl">{PAGE_LABELS[selectedPage]}</h2>
                </div>
                <div className="flex border border-primary/15">
                  {LANGS.map(lang => (
                    <button key={lang} onClick={() => setPageLang(lang)} className={`min-h-[36px] px-4 font-mono text-[11px] uppercase ${pageLang === lang ? 'bg-primary text-white' : 'hover:bg-[#F4F4F0]'}`}>{lang}</button>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Заголовок (title)</label>
                  <input className={inputCls} value={pageLocale.title || ''} placeholder={builtIn.title} onChange={e => setPageLocale({ title: e.target.value })} />
                  <LengthMeter value={resolved.title} min={30} max={60} />
                  <p className="mt-1 text-[10px] text-gray-400">Пусто — используется стандартный. К заголовку добавится «{settings.titleTemplate.replace('%s', '').trim()}».</p>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Описание (meta description)</label>
                  <textarea rows={3} className={inputCls} value={pageLocale.description || ''} placeholder={builtIn.description} onChange={e => setPageLocale({ description: e.target.value })} />
                  <LengthMeter value={resolved.description} min={120} max={160} />
                </div>
                <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Картинка превью (все языки)</label>
                    <input className={inputCls} value={pageEntry.image || ''} placeholder={settings.defaultImage} onChange={e => setPage({ image: e.target.value })} />
                  </div>
                  <label className="flex min-h-[46px] cursor-pointer items-center gap-2 border border-gray-300 px-4 text-sm">
                    <input type="checkbox" checked={Boolean(pageEntry.noindex)} onChange={e => setPage({ noindex: e.target.checked })} />
                    Скрыть от поиска
                  </label>
                </div>
                {settings.pages[selectedPage] ? (
                  <button
                    onClick={() => {
                      const next = { ...settings.pages };
                      delete next[selectedPage];
                      update({ pages: next });
                    }}
                    className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-red-600"
                  >
                    <RotateCcw size={12} /> Сбросить к стандартным для всех языков
                  </button>
                ) : null}
              </div>
            </div>
            <SeoPreview title={resolved.title} description={resolved.description} path={selectedPage} image={resolved.image} />
          </div>
        </div>
      ) : null}

      {section === 'global' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-5 border border-primary/10 bg-white p-6">
            <h2 className="flex items-center gap-2 font-serif text-3xl"><Globe size={20} className="text-accent" /> Сайт</h2>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Название сайта</label>
              <input className={inputCls} value={settings.siteName} onChange={e => update({ siteName: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Шаблон заголовка</label>
              <input className={inputCls} value={settings.titleTemplate} onChange={e => update({ titleTemplate: e.target.value })} />
              <p className="mt-1 text-[10px] text-gray-400">%s заменяется на название страницы. Пример: «{settings.titleTemplate.replace('%s', 'Каталог книг')}»</p>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Картинка превью по умолчанию</label>
              <input className={inputCls} value={settings.defaultImage} onChange={e => update({ defaultImage: e.target.value })} />
              <p className="mt-1 text-[10px] text-gray-400">Лучше 1200×630. Используется, если у страницы нет своей.</p>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Ключевые слова</label>
              <textarea rows={3} className={inputCls} value={settings.keywords} onChange={e => update({ keywords: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">X / Twitter (@handle)</label>
              <input className={inputCls} value={settings.twitterHandle} placeholder="@ampublishing" onChange={e => update({ twitterHandle: e.target.value })} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-5 border border-primary/10 bg-white p-6">
              <h2 className="flex items-center gap-2 font-serif text-3xl"><Info size={20} className="text-accent" /> Организация</h2>
              <p className="-mt-2 text-xs text-gray-500">Попадает в карточку знаний Google (schema.org Organization). Email и соцсети берутся из «Навигация и футер».</p>
              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ['legalName', 'Юридическое название'],
                  ['foundingDate', 'Год основания'],
                  ['city', 'Город'],
                  ['country', 'Страна (код, напр. DE)'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</label>
                    <input className={inputCls} value={settings.organization[key]} onChange={e => update({ organization: { ...settings.organization, [key]: e.target.value } })} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5 border border-primary/10 bg-white p-6">
              <h2 className="flex items-center gap-2 font-serif text-3xl"><ShieldCheck size={20} className="text-accent" /> Подтверждение владения</h2>
              <p className="-mt-2 text-xs text-gray-500">Вставьте только код из meta-тега (content="…"). Тег появится на всех страницах после сборки.</p>
              {([
                ['google', 'Google Search Console'],
                ['bing', 'Bing Webmaster'],
                ['yandex', 'Яндекс.Вебмастер'],
                ['pinterest', 'Pinterest'],
                ['facebookDomain', 'Meta / Facebook домен'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</label>
                  <input className={`${inputCls} font-mono`} value={settings.verification[key]} onChange={e => update({ verification: { ...settings.verification, [key]: e.target.value.replace(/^.*content="([^"]+)".*$/, '$1').trim() } })} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {section === 'tools' ? (
        <div className="grid gap-px border border-primary/10 bg-primary/10 md:grid-cols-2 xl:grid-cols-3">
          {[
            { title: 'Google Search Console', text: 'Индексация, запросы, клики и ошибки.', href: 'https://search.google.com/search-console?resource_id=sc-domain%3Aampublishing.org' },
            { title: 'Проверка расширенных результатов', text: 'Как Google видит разметку книг, событий и хлебных крошек.', href: `https://search.google.com/test/rich-results?url=${encoded('/catalog')}` },
            { title: 'PageSpeed Insights', text: 'Скорость и Core Web Vitals главной.', href: `https://pagespeed.web.dev/analysis?url=${encoded('/')}` },
            { title: 'Sitemap', text: 'Карта сайта, которую читают поисковики.', href: `${SITE_URL}/sitemap.xml` },
            { title: 'Отладчик Facebook', text: 'Сбросить кэш превью ссылки в Facebook/Instagram.', href: `https://developers.facebook.com/tools/debug/?q=${encoded('/')}` },
            { title: 'Превью в Telegram', text: 'Отправьте ссылку боту @WebpageBot, чтобы обновить карточку.', href: 'https://t.me/WebpageBot' },
            { title: 'Bing Webmaster', text: 'Индексация в Bing, ChatGPT-поиске и DuckDuckGo.', href: 'https://www.bing.com/webmasters' },
            { title: 'Яндекс.Вебмастер', text: 'Для русскоязычной аудитории.', href: 'https://webmaster.yandex.com/' },
            { title: 'Schema validator', text: 'Полная проверка schema.org разметки.', href: `https://validator.schema.org/#url=${encoded('/')}` },
          ].map(tool => (
            <a key={tool.title} href={tool.href} target="_blank" rel="noopener noreferrer" className="group flex min-h-[150px] flex-col justify-between bg-white p-6 hover:bg-[#FAFAF7]">
              <div>
                <p className="font-serif text-2xl">{tool.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-gray-500">{tool.text}</p>
              </div>
              <span className="mt-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-primary">Открыть <ExternalLink size={12} /></span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
};

/**
 * Per-entry SEO block for the book and news editors: optional title and
 * description overrides with live Google / Telegram previews.
 */
export const EntrySeoEditor: React.FC<{
  kind: 'book' | 'news';
  entry: Book | NewsItem;
  onChange: (seo: EntrySeo) => void;
}> = ({ kind, entry, onChange }) => {
  const [settings, setSettings] = useState<SeoSettings>(() => mergeSeoSettings(null) as SeoSettings);
  useEffect(() => { getSeoSettings().then(setSettings).catch(() => {}); }, []);
  const seo = entry.seo || {};
  const meta = kind === 'book' ? resolveBookMeta(entry as Book, settings) : resolveNewsMeta(entry as NewsItem, settings);
  const fallback = kind === 'book'
    ? resolveBookMeta({ ...(entry as Book), seo: {} }, settings)
    : resolveNewsMeta({ ...(entry as NewsItem), seo: {} }, settings);
  const set = (patch: Partial<EntrySeo>) => onChange({ ...seo, ...patch });
  const issues = auditMeta(meta, { hasImage: Boolean(meta.image) }) as Issue[];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">SEO-заголовок</label>
          <input className={inputCls} value={seo.title || ''} placeholder={fallback.title.replace(/ \|.*$/, '')} onChange={e => set({ title: e.target.value })} />
          <LengthMeter value={meta.title} min={30} max={60} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">Картинка для соцсетей</label>
          <input className={inputCls} value={seo.image || ''} placeholder="Пусто — обложка" onChange={e => set({ image: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-500">SEO-описание</label>
        <textarea rows={3} className={inputCls} value={seo.description || ''} placeholder={fallback.description} onChange={e => set({ description: e.target.value })} />
        <LengthMeter value={meta.description} min={120} max={160} />
        <p className="mt-1 text-[10px] text-gray-400">Пусто — берётся начало описания. Своё описание лучше: 1–2 фразы с жанром и интригой.</p>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={Boolean(seo.noindex)} onChange={e => set({ noindex: e.target.checked })} /> Скрыть страницу от поисковиков
      </label>
      <IssueBadges issues={issues} />
      <SeoPreview title={meta.title} description={meta.description} path={meta.path} image={meta.image} />
    </div>
  );
};
