import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, Save, Loader2, Copy, ArrowUp, ArrowDown, Eye, EyeOff,
  ClipboardPaste, ExternalLink, RefreshCw, Languages, GripVertical,
} from 'lucide-react';
import { api } from '../services/api';
import type { Language, ServiceItem, ServicesContent } from '../types';

const LANGS: Language[] = ['ru', 'en', 'de'];
const LANG_LABEL: Record<Language, string> = { ru: 'Русский', en: 'English', de: 'Deutsch' };

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'service';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode; className?: string }> = ({
  label, hint, children, className,
}) => (
  <div className={className}>
    <label className="block text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-1">{label}</label>
    {children}
    {hint ? <p className="mt-1 text-[10px] text-gray-400">{hint}</p> : null}
  </div>
);

const inputCls = 'w-full border border-gray-300 px-4 py-3 text-sm outline-none focus:border-primary bg-white';

/**
 * Редактор списка строк: добавление, удаление, перестановка, массовая вставка.
 * Используется и для «что входит», и для чек-листа письма.
 */
const LineListEditor: React.FC<{
  lines: string[];
  onChange: (lines: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}> = ({ lines, onChange, placeholder = 'Строка…', addLabel = 'Добавить строку' }) => {
  const [bulk, setBulk] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);

  const set = (index: number, value: string) =>
    onChange(lines.map((line, i) => (i === index ? value : line)));
  const remove = (index: number) => onChange(lines.filter((_, i) => i !== index));
  const move = (index: number, delta: number) => {
    const next = [...lines];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div key={index} className="flex items-start gap-2 group">
          <span className="mt-3 text-gray-300"><GripVertical size={14} /></span>
          <textarea
            value={line}
            rows={1}
            placeholder={placeholder}
            onChange={e => set(index, e.target.value)}
            onInput={e => {
              const el = e.target as HTMLTextAreaElement;
              el.style.height = 'auto';
              el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
            }}
            className="flex-1 border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary resize-none bg-white"
          />
          <div className="flex flex-col md:flex-row gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0}
              className="p-2 border border-gray-200 hover:bg-gray-50 disabled:opacity-30" title="Выше">
              <ArrowUp size={12} />
            </button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === lines.length - 1}
              className="p-2 border border-gray-200 hover:bg-gray-50 disabled:opacity-30" title="Ниже">
              <ArrowDown size={12} />
            </button>
            <button type="button" onClick={() => remove(index)}
              className="p-2 border border-red-200 text-red-600 hover:bg-red-50" title="Удалить строку">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => onChange([...lines, ''])}
          className="inline-flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-primary hover:bg-primary hover:text-white">
          <Plus size={12} /> {addLabel}
        </button>
        <button type="button" onClick={() => setBulkOpen(v => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-50">
          <ClipboardPaste size={12} /> Вставить списком
        </button>
      </div>

      {bulkOpen ? (
        <div className="border border-dashed border-primary/40 p-3 bg-[#F8F8F5] space-y-2">
          <textarea
            value={bulk}
            onChange={e => setBulk(e.target.value)}
            rows={5}
            placeholder={'Каждая строка — отдельный пункт.\nМожно вставить сразу весь список из Word.'}
            className="w-full border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary bg-white"
          />
          <div className="flex gap-2">
            <button type="button"
              onClick={() => {
                const parsed = bulk.split('\n').map(l => l.replace(/^[-–—•*\d.)\s]+/, '').trim()).filter(Boolean);
                if (parsed.length) onChange([...lines.filter(Boolean), ...parsed]);
                setBulk(''); setBulkOpen(false);
              }}
              className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary">
              Добавить {bulk.split('\n').filter(l => l.trim()).length} пунктов
            </button>
            <button type="button" onClick={() => { setBulk(''); setBulkOpen(false); }}
              className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300">Отмена</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const emptyService = (index: number): ServiceItem => ({
  id: `service-${index + 1}-${Date.now().toString(36).slice(-4)}`,
  title: 'Новая услуга',
  summary: '',
  includes: [''],
  note: '',
  priceNote: 'Расчёт индивидуальный',
  enabled: true,
});

export const ServicesEditor: React.FC<{
  language: Language;
  onToast: (message: string, type?: 'success' | 'error') => void;
  /** Дать AdminPage знать, что есть несохранённые правки (для индикатора). */
  onDirtyChange?: (dirty: boolean) => void;
}> = ({ language, onToast, onDirtyChange }) => {
  const [all, setAll] = useState<Record<Language, ServicesContent> | null>(null);
  const [dirty, setDirty] = useState<Record<Language, boolean>>({ ru: false, en: false, de: false });
  const [selectedId, setSelectedId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageOpen, setPageOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const skipDirtyRef = useRef(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getAllServices();
      skipDirtyRef.current = true;
      setAll(data);
      setDirty({ ru: false, en: false, de: false });
      if (!selectedId && data[language].items[0]) setSelectedId(data[language].items[0].id);
    } catch (e: any) {
      onToast(`Не удалось загрузить услуги: ${e?.message || e}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { onDirtyChange?.(Object.values(dirty).some(Boolean)); }, [dirty]);

  const content = all?.[language] || null;
  const items = content?.items || [];
  const selected = useMemo(
    () => items.find(item => item.id === selectedId) || items[0] || null,
    [items, selectedId],
  );

  const patch = (updater: (draft: ServicesContent) => void) => {
    if (!all) return;
    const next = clone(all);
    updater(next[language]);
    setAll(next);
    setDirty(prev => ({ ...prev, [language]: true }));
  };

  const patchItem = (id: string, updater: (item: ServiceItem) => void) =>
    patch(draft => {
      const item = draft.items.find(entry => entry.id === id);
      if (item) updater(item);
    });

  const moveItem = (id: string, delta: number) =>
    patch(draft => {
      const index = draft.items.findIndex(entry => entry.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= draft.items.length) return;
      [draft.items[index], draft.items[target]] = [draft.items[target], draft.items[index]];
    });

  const addItem = () => {
    if (!all) return;
    const created = emptyService(items.length);
    patch(draft => { draft.items.push(created); });
    setSelectedId(created.id);
  };

  const duplicateItem = (id: string) => {
    const source = items.find(item => item.id === id);
    if (!source) return;
    const copy: ServiceItem = { ...clone(source), id: `${source.id}-copy-${Date.now().toString(36).slice(-3)}` };
    patch(draft => {
      const index = draft.items.findIndex(entry => entry.id === id);
      draft.items.splice(index + 1, 0, copy);
    });
    setSelectedId(copy.id);
  };

  const deleteItem = (id: string) => {
    patch(draft => { draft.items = draft.items.filter(entry => entry.id !== id); });
    setSelectedId('');
  };

  const save = async () => {
    if (!content) return;
    setSaving(true);
    try {
      const cleaned: ServicesContent = {
        ...content,
        orderChecklist: content.orderChecklist.map(l => l.trim()).filter(Boolean),
        items: content.items.map(item => ({
          ...item,
          id: item.id || slugify(item.title),
          includes: item.includes.map(l => l.trim()).filter(Boolean),
        })),
      };
      const saved = await api.saveServices(language, cleaned);
      setAll(prev => (prev ? { ...prev, [language]: saved } : prev));
      setDirty(prev => ({ ...prev, [language]: false }));
      onToast(`Услуги (${LANG_LABEL[language]}) сохранены и опубликованы`);
    } catch (e: any) {
      onToast(`Ошибка сохранения: ${e?.message || e}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  /** Перенести структуру (список услуг, порядок, e-mail) в другой язык, не трогая уже переведённые тексты. */
  const copyStructureTo = (target: Language, withText: boolean) => {
    if (!all || target === language) return;
    const source = all[language];
    const next = clone(all);
    next[target] = withText
      ? { ...clone(source) }
      : {
          ...next[target],
          contactEmail: source.contactEmail,
          emailSubject: source.emailSubject,
          items: source.items.map(sourceItem => {
            const existing = next[target].items.find(entry => entry.id === sourceItem.id);
            return existing
              ? { ...existing, enabled: sourceItem.enabled, priceNote: existing.priceNote || sourceItem.priceNote }
              : clone(sourceItem);
          }),
        };
    setAll(next);
    setDirty(prev => ({ ...prev, [target]: true }));
    onToast(
      withText
        ? `Всё содержимое скопировано в ${LANG_LABEL[target]} — не забудьте перевести и сохранить`
        : `Структура перенесена в ${LANG_LABEL[target]} — проверьте и сохраните`,
    );
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (loading || !content) {
    return (
      <div className="bg-white border border-primary/10 p-12 flex items-center gap-3 text-gray-500">
        <Loader2 size={18} className="animate-spin" /> Загружаем услуги…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Панель действий ── */}
      <div className="bg-white border border-primary/10 p-5 flex flex-col xl:flex-row xl:items-center gap-4 justify-between sticky top-0 z-20">
        <div>
          <h3 className="text-3xl font-serif leading-none">Услуги</h3>
          <p className="mt-2 text-xs text-gray-500">
            Страница <span className="font-mono">/services</span> · язык редактирования:{' '}
            <b>{LANG_LABEL[language]}</b>
            {dirty[language] ? <span className="ml-2 text-amber-600 font-mono">● несохранённые изменения · CTRL+S</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/services" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest hover:bg-gray-50">
            <ExternalLink size={14} /> Открыть страницу
          </a>
          <button onClick={() => setPreviewOpen(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest hover:bg-gray-50">
            {previewOpen ? <EyeOff size={14} /> : <Eye size={14} />} Предпросмотр
          </button>
          <button onClick={load} disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-3 border border-gray-300 text-xs uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw size={14} /> Обновить
          </button>
          <button onClick={save} disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-white text-xs uppercase tracking-widest hover:bg-accent hover:text-primary disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Сохранить {language.toUpperCase()}
          </button>
        </div>
      </div>

      {/* ── Перенос между языками ── */}
      <div className="bg-[#F8F8F5] border border-primary/10 p-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-gray-500">
          <Languages size={14} /> Перенести в другой язык
        </span>
        {LANGS.filter(lang => lang !== language).map(lang => (
          <React.Fragment key={lang}>
            <button onClick={() => copyStructureTo(lang, false)}
              className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-primary hover:bg-primary hover:text-white"
              title="Перенести только структуру: список услуг, порядок, e-mail. Существующие переводы сохранятся.">
              Структуру → {lang.toUpperCase()}
            </button>
            <button onClick={() => copyStructureTo(lang, true)}
              className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-50"
              title="Скопировать всё содержимое, включая тексты (перезапишет перевод).">
              Всё → {lang.toUpperCase()}
            </button>
          </React.Fragment>
        ))}
        {LANGS.filter(lang => dirty[lang] && lang !== language).length ? (
          <span className="ml-auto text-[11px] text-amber-700 font-mono">
            Не сохранено: {LANGS.filter(lang => dirty[lang] && lang !== language).map(l => l.toUpperCase()).join(', ')} —
            переключите язык слева и нажмите «Сохранить».
          </span>
        ) : null}
      </div>

      {/* ── Шапка страницы ── */}
      <section className="bg-white border border-primary/10">
        <button onClick={() => setPageOpen(v => !v)}
          className="w-full flex items-center justify-between p-5 border-b border-gray-100 text-left">
          <span className="font-serif text-2xl">Тексты страницы</span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
            {pageOpen ? 'свернуть' : 'развернуть'}
          </span>
        </button>
        {pageOpen ? (
          <div className="p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Заголовок раздела">
              <input className={inputCls} value={content.title}
                onChange={e => patch(d => { d.title = e.target.value; })} />
            </Field>
            <Field label="Подзаголовок">
              <input className={inputCls} value={content.subtitle}
                onChange={e => patch(d => { d.subtitle = e.target.value; })} />
            </Field>
            <Field label="Вступительный абзац" className="md:col-span-2">
              <textarea rows={3} className={inputCls} value={content.intro}
                onChange={e => patch(d => { d.intro = e.target.value; })} />
            </Field>

            <Field label="E-mail для заказов" hint="Показывается внизу страницы и подставляется в кнопки «написать».">
              <input className={inputCls} value={content.contactEmail}
                onChange={e => patch(d => { d.contactEmail = e.target.value; })} />
            </Field>
            <Field label="Тема письма" hint="{service} подставится названием услуги, на которую нажали.">
              <input className={inputCls} value={content.emailSubject}
                onChange={e => patch(d => { d.emailSubject = e.target.value; })} />
            </Field>

            <Field label="Заголовок блока «как заказать»">
              <input className={inputCls} value={content.orderTitle}
                onChange={e => patch(d => { d.orderTitle = e.target.value; })} />
            </Field>
            <Field label="Надпись на кнопке">
              <input className={inputCls} value={content.ctaLabel}
                onChange={e => patch(d => { d.ctaLabel = e.target.value; })} />
            </Field>
            <Field label="Вводная фраза блока заказа" className="md:col-span-2">
              <textarea rows={2} className={inputCls} value={content.orderIntro}
                onChange={e => patch(d => { d.orderIntro = e.target.value; })} />
            </Field>
            <Field label="Что указать в письме" className="md:col-span-2"
              hint="Пункты, которые клиент должен перечислить, когда пишет вам.">
              <LineListEditor
                lines={content.orderChecklist}
                onChange={lines => patch(d => { d.orderChecklist = lines; })}
                placeholder="Например: жанр и объём рукописи"
                addLabel="Добавить пункт"
              />
            </Field>
            <Field label="Заключительная строка" className="md:col-span-2">
              <input className={inputCls} value={content.outro}
                onChange={e => patch(d => { d.outro = e.target.value; })} />
            </Field>
          </div>
        ) : null}
      </section>

      {/* ── Список услуг + редактор ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <section className="bg-white border border-primary/10 self-start">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-xl font-serif">Список услуг</h4>
            <button onClick={addItem}
              className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] bg-primary text-white hover:bg-accent hover:text-primary inline-flex items-center gap-2">
              <Plus size={12} /> Добавить
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <div key={item.id}
                className={`flex items-center gap-2 p-3 ${selected?.id === item.id ? 'bg-[#F4F4F0]' : 'hover:bg-gray-50'}`}>
                <button onClick={() => setSelectedId(item.id)} className="flex-1 text-left min-w-0">
                  <p className={`font-serif text-lg leading-tight truncate ${item.enabled === false ? 'text-gray-400 line-through' : ''}`}>
                    {item.title || item.id}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400">
                    {String(index + 1).padStart(2, '0')} · {item.includes.filter(Boolean).length} пунктов
                  </p>
                </button>
                <div className="flex flex-col gap-1">
                  <button onClick={() => moveItem(item.id, -1)} disabled={index === 0}
                    className="p-1.5 border border-gray-200 hover:bg-white disabled:opacity-30"><ArrowUp size={11} /></button>
                  <button onClick={() => moveItem(item.id, 1)} disabled={index === items.length - 1}
                    className="p-1.5 border border-gray-200 hover:bg-white disabled:opacity-30"><ArrowDown size={11} /></button>
                </div>
              </div>
            ))}
            {!items.length ? <p className="p-6 text-sm text-gray-400">Пока ни одной услуги — нажмите «Добавить».</p> : null}
          </div>
        </section>

        <section className="bg-white border border-primary/10 p-5 md:p-6">
          {selected ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <h4 className="text-2xl font-serif">Услуга</h4>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => patchItem(selected.id, item => { item.enabled = item.enabled === false; })}
                    className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2">
                    {selected.enabled === false ? <><EyeOff size={12} /> Скрыта</> : <><Eye size={12} /> Видна</>}
                  </button>
                  <button onClick={() => duplicateItem(selected.id)}
                    className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-2">
                    <Copy size={12} /> Копия
                  </button>
                  <button onClick={() => deleteItem(selected.id)}
                    className="px-3 py-2 text-[10px] uppercase tracking-[0.18em] border border-red-300 text-red-600 hover:bg-red-50 inline-flex items-center gap-2">
                    <Trash2 size={12} /> Удалить
                  </button>
                </div>
              </div>

              <Field label="Название услуги">
                <input className={`${inputCls} font-serif text-xl`} value={selected.title}
                  onChange={e => patchItem(selected.id, item => { item.title = e.target.value; })} />
              </Field>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Короткое описание" hint="Одна строка под названием.">
                  <input className={inputCls} value={selected.summary || ''}
                    onChange={e => patchItem(selected.id, item => { item.summary = e.target.value; })} />
                </Field>
                <Field label="Подпись вместо цены" hint="Например: «Расчёт индивидуальный».">
                  <input className={inputCls} value={selected.priceNote || ''}
                    onChange={e => patchItem(selected.id, item => { item.priceNote = e.target.value; })} />
                </Field>
              </div>

              <Field label="Что входит в услугу">
                <LineListEditor
                  lines={selected.includes}
                  onChange={lines => patchItem(selected.id, item => { item.includes = lines; })}
                  placeholder="Например: редактура и корректура"
                  addLabel="Добавить пункт"
                />
              </Field>

              <Field label="Примечание" hint="Сроки, условия, любые оговорки. Можно оставить пустым.">
                <textarea rows={2} className={inputCls} value={selected.note || ''}
                  onChange={e => patchItem(selected.id, item => { item.note = e.target.value; })} />
              </Field>

              <Field label="ID (техническое)" hint="Связывает услугу между языками. Меняйте, только если понимаете зачем.">
                <input className={`${inputCls} font-mono text-xs`} value={selected.id}
                  onChange={e => patchItem(selected.id, item => { item.id = e.target.value; })} />
              </Field>
            </div>
          ) : (
            <p className="text-gray-400">Выберите услугу слева или создайте новую.</p>
          )}
        </section>
      </div>

      {/* ── Предпросмотр ── */}
      {previewOpen ? (
        <section className="bg-[#F4F4F0] border border-primary/20 p-6 md:p-10 space-y-6">
          <div>
            <h2 className="font-serif text-4xl">{content.title}</h2>
            <p className="text-gray-500 mt-2">{content.subtitle}</p>
            <p className="mt-4 font-serif text-lg max-w-3xl">{content.intro}</p>
          </div>
          {items.filter(item => item.enabled !== false).map((item, index) => (
            <div key={item.id} className="bg-white border border-primary/15 p-6">
              <span className="font-mono text-[10px] tracking-[0.28em] text-gray-400">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="font-serif text-2xl mt-2">{item.title}</h3>
              {item.summary ? <p className="text-gray-500 mt-1">{item.summary}</p> : null}
              <ul className="mt-4 space-y-2">
                {item.includes.filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-3"><span className="mt-2 w-1.5 h-1.5 bg-accent shrink-0" />{line}</li>
                ))}
              </ul>
              {item.note ? <p className="mt-4 text-sm italic text-gray-500">{item.note}</p> : null}
              {item.priceNote ? (
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em]">{item.priceNote}</p>
              ) : null}
            </div>
          ))}
          <div className="bg-primary text-white p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">{content.orderTitle}</p>
            <p className="font-serif text-2xl mt-3">{content.orderIntro}</p>
            <ol className="mt-4 space-y-2 text-gray-200">
              {content.orderChecklist.filter(Boolean).map((line, i) => (
                <li key={i}>{String(i + 1).padStart(2, '0')} — {line}</li>
              ))}
            </ol>
            <p className="font-serif text-2xl mt-6">{content.contactEmail}</p>
            <p className="text-sm text-gray-300 mt-2">{content.outro}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
};
