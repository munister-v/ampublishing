import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { contentStore } from '../services/contentStore';

// The admin's section for the mobile app: the events of the bill and the workshop's questions.
// Both live as JSON in public/content and are read by the app from ampublishing.org/content/.
// Saving commits the file to GitHub; the site's deploy then publishes it and the app picks it up.

type Props = { onToast: (message: string, kind?: 'success' | 'error') => void };
type Lang = 'ru' | 'en' | 'de';

type AppEvent = {
  id: string; kind: string; title: string; start: string;
  place?: string; address?: string; url?: string; summary?: string; body?: string; imageUrl?: string;
  registration?: boolean; code?: string; bookId?: string; newsId?: string; draft?: boolean;
  [k: string]: unknown;
};
type Question = { id: string; q: string; options: string[]; answer: number; note: string; skill: string };
type Level = { id: string; title: string; subtitle: string; questions: Question[] };
type Topic = { id: string; title: string; subtitle: string; icon: string; levels: Level[]; years?: string; group?: string };
type Skill = { id: string; topic: string; title: string; subtitle: string; icon: string };
type QuizFile = { topics?: Topic[]; skills?: Skill[]; writers?: Topic[]; [k: string]: unknown };

const BASE = `${import.meta.env.BASE_URL}content/`;
const TO_PASS = 7;
const input = 'w-full border border-gray-300 px-3 py-2 text-sm bg-white';
const btn = 'px-4 py-2 text-sm border border-primary/20 hover:bg-primary hover:text-white transition-colors';
const btnMain = 'px-5 py-2 text-sm bg-primary text-white hover:opacity-90 disabled:opacity-40';

/// The house uses the short dash.
const tidy = (s: string) => s.replace(/\s*—\s*/g, ' – ').replace(/[ \t]{2,}/g, ' ');

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block space-y-1">
    <span className="text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
    {children}
    {hint ? <span className="block text-xs text-gray-400">{hint}</span> : null}
  </label>
);

const download = (name: string, data: unknown) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};
const readJson = (file: File) => new Promise<unknown>((res, rej) => {
  const r = new FileReader(); r.onload = () => { try { res(JSON.parse(String(r.result))); } catch { rej(new Error('Это не JSON')); } }; r.onerror = () => rej(new Error('Не прочитать файл')); r.readAsText(file);
});
const toDataUrl = (file: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Не прочитать файл')); r.readAsDataURL(file);
});

async function load<T>(file: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${file}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

// ───────────────────────── events ─────────────────────────

const EVENT_KINDS = [['offline', 'Встреча (офлайн)'], ['online', 'Эфир (онлайн)'], ['premiere', 'Премьера книги']];

const checkEvents = (list: AppEvent[]): string[] => {
  const errors: string[] = [];
  const ids = new Set<string>();
  list.forEach((e, i) => {
    const n = `Событие ${i + 1}`;
    if (!e.id.trim()) errors.push(`${n}: нет id`);
    else if (ids.has(e.id)) errors.push(`${n}: id «${e.id}» повторяется`);
    ids.add(e.id);
    if (!e.title.trim()) errors.push(`${n}: нет названия`);
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(e.start)) errors.push(`${n}: дата должна быть вида 2026-11-20 или 2026-11-20T19:00`);
    if (e.url && !/^https?:\/\//.test(e.url)) errors.push(`${n}: ссылка должна начинаться с https://`);
  });
  return errors;
};

const EventsEditor: React.FC<Props> = ({ onToast }) => {
  const [lang, setLang] = useState<Lang>('ru');
  const [list, setList] = useState<AppEvent[] | null>(null);
  const [fileExists, setFileExists] = useState(true);
  const [sel, setSel] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    setList(null); setDirty(false); setSel(0);
    load<AppEvent[]>(`events.${lang}.json`).then(d => {
      if (off) return;
      setFileExists(d !== null);
      setList(d ?? []);
    });
    return () => { off = true; };
  }, [lang]);

  const patch = (i: number, p: Partial<AppEvent>) => {
    setList(l => l && l.map((e, k) => (k === i ? { ...e, ...p } : e)));
    setDirty(true);
  };
  const add = () => {
    setList(l => [...(l || []), { id: `event-${Date.now().toString(36)}`, kind: 'offline', title: 'Новое событие', start: new Date().toISOString().slice(0, 10), draft: true }]);
    setSel((list || []).length); setDirty(true);
  };
  const duplicate = (i: number) => {
    setList(l => l && [...l, { ...l[i], id: `${l[i].id}-copy`, title: `${l[i].title} (копия)`, draft: true }]);
    setSel((list || []).length); setDirty(true);
  };
  const sortByDate = () => { setList(l => l && [...l].sort((a, b) => a.start.localeCompare(b.start))); setSel(0); setDirty(true); };
  const upload = async (i: number, f?: File) => {
    if (!f) return;
    try {
      const url = await contentStore.uploadImage(`event-${list![i].id}-${Date.now()}.${(f.name.split('.').pop() || 'jpg').toLowerCase()}`, await toDataUrl(f));
      patch(i, { imageUrl: url }); onToast('Картинка загружена', 'success');
    } catch (e: any) { onToast(e?.message || 'Не удалось загрузить картинку', 'error'); }
  };
  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      const d = await readJson(f);
      if (!Array.isArray(d)) throw new Error('Нужен массив событий');
      setList(d as AppEvent[]); setSel(0); setDirty(true); onToast('Файл загружен, проверьте и сохраните', 'success');
    } catch (e: any) { onToast(e?.message || 'Ошибка файла', 'error'); }
  };
  const remove = (i: number) => {
    if (!window.confirm('Удалить это событие из афиши?')) return;
    setList(l => l && l.filter((_, k) => k !== i)); setSel(0); setDirty(true);
  };
  const errors = useMemo(() => (list ? checkEvents(list) : []), [list]);

  const save = async () => {
    if (!list || errors.length) return;
    setSaving(true);
    try {
      const clean = list.map(e => {
        const o: AppEvent = { ...e, title: tidy(e.title.trim()), summary: e.summary ? tidy(e.summary) : e.summary, body: e.body ? tidy(e.body) : e.body };
        (Object.keys(o) as (keyof AppEvent)[]).forEach(k => { if (o[k] === '' || o[k] === false || o[k] === undefined) delete o[k]; });
        return o;
      });
      await contentStore.ghWritePublicFile(`public/content/events.${lang}.json`, clean, `admin: events (${lang}) for the app`);
      setDirty(false); setFileExists(true);
      onToast('События сохранены. Приложение увидит их после публикации сайта.', 'success');
    } catch (e: any) {
      onToast(e?.message || 'Не удалось сохранить', 'error');
    } finally { setSaving(false); }
  };

  if (!list) return <p className="text-sm text-gray-500">Загрузка…</p>;
  const e = list[sel];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {(['ru', 'en', 'de'] as Lang[]).map(l => (
          <button key={l} onClick={() => { if (!dirty || window.confirm('Есть несохранённые правки. Перейти?')) setLang(l); }}
            className={`${btn} ${lang === l ? 'bg-primary text-white' : ''}`}>{l.toUpperCase()}</button>
        ))}
        <span className="text-xs text-gray-500">
          {fileExists ? `events.${lang}.json` : `Файла events.${lang}.json пока нет: приложение показывает русскую афишу. Сохранение создаст его.`}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {list.map((ev, i) => (
            <button key={ev.id + i} onClick={() => setSel(i)}
              className={`w-full text-left border px-4 py-3 ${i === sel ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
              <div className="text-sm font-medium">{ev.title || 'Без названия'}</div>
              <div className="text-xs text-gray-500">{ev.start}{ev.draft ? ' · черновик' : ''}{ev.start.slice(0, 10) < new Date().toISOString().slice(0, 10) ? ' · прошло' : ''}</div>
            </button>
          ))}
          <button onClick={add} className={`${btn} w-full`}>+ Добавить событие</button>
          <div className="flex gap-2 text-xs">
            <button onClick={sortByDate} className="underline text-gray-600">По дате</button>
            <button onClick={() => download(`events.${lang}.json`, list)} className="underline text-gray-600">Скачать копию</button>
            <label className="underline text-gray-600 cursor-pointer">Загрузить<input type="file" accept="application/json" className="hidden" onChange={x => { importFile(x.target.files?.[0]); x.target.value = ''; }} /></label>
          </div>
        </div>

        {e ? (
          <div className="space-y-4 border border-gray-200 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название"><input className={input} value={e.title} onChange={x => patch(sel, { title: x.target.value })} /></Field>
              <Field label="Тип">
                <select className={input} value={e.kind} onChange={x => patch(sel, { kind: x.target.value })}>
                  {EVENT_KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </Field>
              <Field label="Начало" hint="2026-11-20 или 2026-11-20T19:00, берлинское время"><input className={input} value={e.start} onChange={x => patch(sel, { start: x.target.value })} /></Field>
              <Field label="id" hint="Не менять у событий, на которые уже есть билеты"><input className={input} value={e.id} onChange={x => patch(sel, { id: x.target.value })} /></Field>
              <Field label="Место"><input className={input} value={e.place || ''} onChange={x => patch(sel, { place: x.target.value })} /></Field>
              <Field label="Адрес (для карты)"><input className={input} value={e.address || ''} onChange={x => patch(sel, { address: x.target.value })} /></Field>
              <Field label="Ссылка на эфир / запись"><input className={input} value={e.url || ''} onChange={x => patch(sel, { url: x.target.value })} /></Field>
              <Field label="Кодовое слово" hint="Произносится на событии; ввод отмечает читателя как присутствовавшего"><input className={input} value={e.code || ''} onChange={x => patch(sel, { code: x.target.value })} /></Field>
              <Field label="Картинка (URL или загрузка)">
                <div className="flex gap-2 items-center">
                  <input className={input} value={e.imageUrl || ''} onChange={x => patch(sel, { imageUrl: x.target.value })} />
                  <label className={`${btn} cursor-pointer whitespace-nowrap`}>Файл<input type="file" accept="image/*" className="hidden" onChange={x => { upload(sel, x.target.files?.[0]); x.target.value = ''; }} /></label>
                </div>
                {e.imageUrl ? <img src={e.imageUrl} alt="" className="mt-2 h-24 object-cover" /> : null}
              </Field>
              <Field label="id книги"><input className={input} value={e.bookId || ''} onChange={x => patch(sel, { bookId: x.target.value })} /></Field>
              <Field label="id новости на сайте"><input className={input} value={e.newsId || ''} onChange={x => patch(sel, { newsId: x.target.value })} /></Field>
            </div>
            <Field label="Коротко"><textarea rows={2} className={input} value={e.summary || ''} onChange={x => patch(sel, { summary: x.target.value })} /></Field>
            <Field label="Подробно"><textarea rows={5} className={input} value={e.body || ''} onChange={x => patch(sel, { body: x.target.value })} /></Field>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!e.registration} onChange={x => patch(sel, { registration: x.target.checked })} /> Запись (кнопка «Забронировать место»)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!e.draft} onChange={x => patch(sel, { draft: x.target.checked })} /> Черновик (в приложении не виден)</label>
            </div>
            <div className="flex gap-6 text-sm">
              <button onClick={() => duplicate(sel)} className="underline">Дублировать</button>
              <button onClick={() => remove(sel)} className="text-red-700 underline">Удалить событие</button>
            </div>
          </div>
        ) : <p className="text-sm text-gray-500">В афише пока ничего нет.</p>}
      </div>

      {errors.length ? <ul className="text-sm text-red-700 list-disc pl-5">{errors.map(x => <li key={x}>{x}</li>)}</ul> : null}
      <div className="flex items-center gap-4">
        <button className={btnMain} disabled={!dirty || saving || errors.length > 0} onClick={save}>{saving ? 'Сохраняю…' : 'Сохранить и опубликовать'}</button>
        {dirty ? <span className="text-xs text-amber-700">Есть несохранённые правки</span> : null}
      </div>
    </div>
  );
};

// ───────────────────────── quiz ─────────────────────────

/// The same rules the app's own check runs (Tools/check-quiz.py), the ones an editor can break.
const checkQuiz = (topics: Topic[], skills: Skill[], writers: boolean): string[] => {
  const errors: string[] = [];
  const skillIds = new Set(skills.map(s => s.id));
  const seen = new Set<string>();
  topics.forEach(t => {
    if (!t.title.trim()) errors.push(`${t.id}: нет названия`);
    t.levels.forEach((lv, li) => {
      if (lv.id !== `${t.id}-${li + 1}`) errors.push(`${lv.id}: id уровня должен быть ${t.id}-${li + 1}`);
      if (lv.questions.length < TO_PASS) errors.push(`${lv.id}: ${lv.questions.length} вопр., нужно не меньше ${TO_PASS}`);
      lv.questions.forEach(q => {
        if (seen.has(q.id)) errors.push(`${q.id}: id повторяется`);
        seen.add(q.id);
        if (!new RegExp(`^${lv.id}-\\d+$`).test(q.id)) errors.push(`${q.id}: id должен быть ${lv.id}-<номер>`);
        if (!q.q.trim()) errors.push(`${q.id}: пустой вопрос`);
        if (q.options.length !== 4 || q.options.some(o => !o.trim())) errors.push(`${q.id}: нужно ровно 4 непустых варианта`);
        if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== q.options.length) errors.push(`${q.id}: варианты повторяются`);
        if (!(q.answer >= 0 && q.answer < q.options.length)) errors.push(`${q.id}: не выбран верный ответ`);
        if (!q.note.trim()) errors.push(`${q.id}: нет пояснения`);
        if (!skillIds.has(q.skill)) errors.push(`${q.id}: неизвестный навык «${q.skill}»`);
      });
    });
    if (writers && !['golden', 'silver', 'twentieth', 'world'].includes(t.group || '')) errors.push(`${t.id}: группа должна быть golden, silver, twentieth или world`);
  });
  return errors;
};

// Questions typed or pasted as plain text, one block per question, blocks split by an empty line:
//   Кто написал «Шинель»?
//   Пушкин
//   * Гоголь          ← the right answer is marked with * or +
//   Лермонтов
//   Чехов
//   = Повесть 1842 года.   ← the note after the answer
//   # tropes               ← the skill, optional
type Draft = { q: string; options: string[]; answer: number; note: string; skill?: string };

const OPTION_MARK = /^\s*(?:[АБВГабвгABCDabcd1-4][).]|[-–•])\s*/;
const parseQuestions = (text: string): { items: Draft[]; errors: string[] } => {
  const items: Draft[] = [];
  const errors: string[] = [];
  text.replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).forEach((block, n) => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const d: Draft = { q: '', options: [], answer: -1, note: '' };
    lines.forEach((line, i) => {
      if (i === 0) { d.q = line.replace(/^\d+[.)]\s*/, ''); return; }
      if (/^(=|пояснение:)/i.test(line)) { d.note = line.replace(/^(=|пояснение:)\s*/i, ''); return; }
      if (line.startsWith('#')) { d.skill = line.slice(1).trim(); return; }
      let o = line;
      const right = /^\s*[*+]/.test(o) || /\s[*+]$/.test(o);
      o = o.replace(/^\s*[*+]\s*/, '').replace(/\s[*+]$/, '').replace(OPTION_MARK, '').trim();
      if (right) d.answer = d.options.length;
      d.options.push(o);
    });
    const name = `Блок ${n + 1}${d.q ? ` («${d.q.slice(0, 40)}»)` : ''}`;
    if (d.options.length !== 4) errors.push(`${name}: вариантов ${d.options.length}, нужно 4`);
    else if (d.answer < 0) errors.push(`${name}: не отмечен верный ответ (* или + перед вариантом)`);
    else items.push(d);
  });
  return { items, errors };
};

/// Puts the right answer where the bank has it least often, so the four places stay even.
const balance = (items: Draft[], counts: number[]): Draft[] => {
  const c = [...counts];
  return items.map(d => {
    const to = c.indexOf(Math.min(...c));
    c[to]++;
    if (to === d.answer) return d;
    const options = [...d.options];
    [options[to], options[d.answer]] = [options[d.answer], options[to]];
    return { ...d, options, answer: to };
  });
};

// A table for proof-reading in Excel or Google Sheets, read back by id.
const CSV_HEAD = ['id', 'раздел', 'уровень', 'вопрос', 'А', 'Б', 'В', 'Г', 'верный', 'пояснение', 'навык'];
const csvCell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toCsv = (topics: Topic[]) => '﻿' + [CSV_HEAD, ...topics.flatMap(t => t.levels.flatMap(l => l.questions.map(x =>
  [x.id, t.title, l.title, x.q, ...x.options, 'АБВГ'[x.answer] || '', x.note, x.skill])))]
  .map(r => r.map(c => csvCell(String(c ?? ''))).join(';')).join('\r\n');

const parseCsv = (text: string): string[][] => {
  const src = text.replace(/^﻿/, '');
  const sep = (src.split('\n')[0].match(/;/g) || []).length >= (src.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
};

/// Applies a proof-read table: rows are matched by id; a new id of an existing level is added to it.
const applyCsv = (topics: Topic[], rows: string[][]): { topics: Topic[]; changed: number; added: number; skipped: string[] } => {
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name.toLowerCase());
  const need = ['id', 'вопрос', 'а', 'б', 'в', 'г', 'верный'];
  const missing = need.filter(n => col(n) < 0);
  if (missing.length) throw new Error(`В таблице нет столбцов: ${missing.join(', ')}`);
  let changed = 0; let added = 0; const skipped: string[] = [];
  const out = topics.map(t => ({ ...t, levels: t.levels.map(l => ({ ...l, questions: l.questions.map(x => ({ ...x, options: [...x.options] })) })) }));
  rows.slice(1).forEach(r => {
    const get = (n: string) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
    const id = get('id');
    const answer = 'АБВГABCD'.indexOf(get('верный').toUpperCase().slice(0, 1)) % 4;
    const next: Partial<Question> = { q: get('вопрос'), options: ['а', 'б', 'в', 'г'].map(get), answer };
    if (col('пояснение') >= 0) next.note = get('пояснение');
    if (col('навык') >= 0 && get('навык')) next.skill = get('навык');
    if (!id || answer < 0) { skipped.push(id || '(без id)'); return; }
    for (const t of out) for (const l of t.levels) {
      const i = l.questions.findIndex(x => x.id === id);
      if (i >= 0) {
        const before = JSON.stringify(l.questions[i]);
        l.questions[i] = { ...l.questions[i], ...next } as Question;
        if (JSON.stringify(l.questions[i]) !== before) changed++;
        return;
      }
    }
    const level = out.flatMap(t => t.levels).find(l => id.startsWith(`${l.id}-`) && /^\d+$/.test(id.slice(l.id.length + 1)));
    if (!level) { skipped.push(id); return; }
    level.questions.push({ id, note: '', skill: level.questions[0]?.skill || '', ...next } as Question);
    added++;
  });
  return { topics: out, changed, added, skipped };
};

const QuizEditor: React.FC<Props & { file: 'quiz.ru.json' | 'writers.ru.json' }> = ({ onToast, file }) => {
  const isWriters = file === 'writers.ru.json';
  const [data, setData] = useState<QuizFile | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [ti, setTi] = useState(0);
  const [li, setLi] = useState(0);
  const [qi, setQi] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let off = false;
    setData(null); setTi(0); setLi(0); setQi(0); setDirty(false); setFailed(false);
    Promise.all([load<QuizFile>(file), isWriters ? load<QuizFile>('quiz.ru.json') : Promise.resolve(null)]).then(([d, quiz]) => {
      if (off) return;
      if (!d) { setFailed(true); return; }
      setData(d);
      setSkills((isWriters ? quiz?.skills : d.skills) || []);
    });
    return () => { off = true; };
  }, [file, isWriters]);

  const topics: Topic[] = (isWriters ? data?.writers : data?.topics) || [];
  const setTopics = useCallback((fn: (t: Topic[]) => Topic[]) => {
    setData(d => d ? { ...d, [isWriters ? 'writers' : 'topics']: fn((isWriters ? d.writers : d.topics) || []) } : d);
    setDirty(true);
  }, [isWriters]);

  const topic = topics[ti];
  const level = topic?.levels[li];
  const q = level?.questions[qi];
  const errors = useMemo(() => checkQuiz(topics, skills, isWriters), [topics, skills, isWriters]);

  const editTopic = (p: Partial<Topic>) => setTopics(t => t.map((x, k) => (k === ti ? { ...x, ...p } : x)));
  const editLevel = (p: Partial<Level>) => setTopics(t => t.map((x, k) => k !== ti ? x : { ...x, levels: x.levels.map((l, j) => (j === li ? { ...l, ...p } : l)) }));
  const editQ = (p: Partial<Question>) => editLevel({ questions: level.questions.map((x, k) => (k === qi ? { ...x, ...p } : x)) });
  const editOption = (n: number, v: string) => editQ({ options: q.options.map((o, k) => (k === n ? v : o)) });

  const addQuestion = () => {
    const next = level.questions.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0) + 1;
    const skill = level.questions[0]?.skill || (isWriters ? 'writers' : topic.id);
    editLevel({ questions: [...level.questions, { id: `${level.id}-${next}`, q: '', options: ['', '', '', ''], answer: 0, note: '', skill }] });
    setQi(level.questions.length);
  };
  const removeQuestion = () => {
    if (!window.confirm('Удалить вопрос? Очки за него, если читатель уже ответил, остаются.')) return;
    editLevel({ questions: level.questions.filter((_, k) => k !== qi) }); setQi(0);
  };
  const moveQuestion = (d: number) => {
    const to = qi + d; if (to < 0 || to >= level.questions.length) return;
    const qs = [...level.questions]; [qs[qi], qs[to]] = [qs[to], qs[qi]];
    editLevel({ questions: qs }); setQi(to);
  };
  const duplicateQuestion = () => {
    const next = level.questions.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0) + 1;
    editLevel({ questions: [...level.questions, { ...q, id: `${level.id}-${next}`, options: [...q.options] }] });
    setQi(level.questions.length);
  };
  const removeLevel = () => {
    if (topic.levels.length < 2 || li !== topic.levels.length - 1) { window.alert('Удалить можно только последний уровень (id уровней идут подряд).'); return; }
    if (!window.confirm(`Удалить уровень «${level.title}» со всеми вопросами?`)) return;
    editTopic({ levels: topic.levels.slice(0, -1) }); setLi(li - 1); setQi(0);
  };
  const addTopic = () => {
    const id = (window.prompt('Короткий id латиницей (например: tyutchev)') || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!id || topics.some(t => t.id === id)) return;
    setTopics(t => [...t, { id, title: 'Новый', subtitle: '', icon: 'book.closed', levels: [{ id: `${id}-1`, title: 'Начала', subtitle: '', questions: [] }], ...(isWriters ? { years: '', group: 'golden' } : {}) }]);
    setTi(topics.length); setLi(0); setQi(0);
  };
  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      const d = await readJson(f) as QuizFile;
      if (!d || !(isWriters ? d.writers : d.topics)) throw new Error(isWriters ? 'В файле нет списка writers' : 'В файле нет списка topics');
      setData(d); if (!isWriters && d.skills) setSkills(d.skills);
      setTi(0); setLi(0); setQi(0); setDirty(true); window.alert('Файл загружен. Проверьте и нажмите «Сохранить».');
    } catch (e: any) { onToast(e?.message || 'Ошибка файла', 'error'); }
  };
  const hits = useMemo(() => {
    const t = search.trim().toLowerCase(); if (t.length < 3) return [];
    const out: { ti: number; li: number; qi: number; text: string }[] = [];
    topics.forEach((tp, a) => tp.levels.forEach((lv, b) => lv.questions.forEach((x, c) => {
      if ((x.q + ' ' + x.options.join(' ') + ' ' + x.note).toLowerCase().includes(t)) out.push({ ti: a, li: b, qi: c, text: x.q });
    })));
    return out.slice(0, 12);
  }, [search, topics]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const pasted = useMemo(() => parseQuestions(pasteText), [pasteText]);
  const addPasted = () => {
    const counts = [0, 1, 2, 3].map(n => topics.reduce((a, t) => a + t.levels.reduce((b, l) => b + l.questions.filter(x => x.answer === n).length, 0), 0));
    let next = level.questions.reduce((m, x) => Math.max(m, Number(x.id.split('-').pop()) || 0), 0);
    const fallback = level.questions[0]?.skill || (isWriters ? 'writers' : topic.id);
    const fresh = balance(pasted.items, counts).map(d => ({
      id: `${level.id}-${++next}`, q: d.q, options: d.options, answer: d.answer, note: d.note,
      skill: d.skill && skills.some(s => s.id === d.skill) ? d.skill : fallback,
    }));
    editLevel({ questions: [...level.questions, ...fresh] });
    setQi(level.questions.length); setPasteText(''); setPasteOpen(false);
    onToast(`Добавлено вопросов: ${fresh.length}. Верные ответы разложены ровно по А–Г.`, 'success');
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(topics)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = file.replace('.json', '.csv'); a.click(); URL.revokeObjectURL(url);
  };
  const importCsv = async (f?: File) => {
    if (!f) return;
    try {
      const r = applyCsv(topics, parseCsv(await f.text()));
      setTopics(() => r.topics);
      window.alert(`Таблица применена.\nИзменено вопросов: ${r.changed}\nДобавлено: ${r.added}${r.skipped.length ? `\nПропущено строк: ${r.skipped.length} (${r.skipped.slice(0, 8).join(', ')}${r.skipped.length > 8 ? '…' : ''})` : ''}\n\nПроверьте и нажмите «Сохранить и опубликовать».`);
    } catch (e: any) { onToast(e?.message || 'Не удалось прочитать таблицу', 'error'); }
  };
  const addLevel = () => {
    const n = topic.levels.length + 1;
    editTopic({ levels: [...topic.levels, { id: `${topic.id}-${n}`, title: `Уровень ${n}`, subtitle: '', questions: [] }] });
    setLi(topic.levels.length); setQi(0);
  };

  const save = async () => {
    if (!data || errors.length) return;
    setSaving(true);
    try {
      const walk = (t: Topic): Topic => ({
        ...t, title: tidy(t.title), subtitle: tidy(t.subtitle),
        levels: t.levels.map(l => ({
          ...l, title: tidy(l.title), subtitle: tidy(l.subtitle),
          questions: l.questions.map(x => ({ ...x, q: tidy(x.q.trim()), options: x.options.map(o => tidy(o.trim())), note: tidy(x.note.trim()) })),
        })),
      });
      const out = { ...data, [isWriters ? 'writers' : 'topics']: topics.map(walk) };
      await contentStore.ghWritePublicFile(`public/content/${file}`, out, `admin: ${file} for the app`);
      setDirty(false);
      onToast('Вопросы сохранены. Приложение подхватит их после публикации сайта и перезапуска.', 'success');
    } catch (e: any) {
      onToast(e?.message || 'Не удалось сохранить', 'error');
    } finally { setSaving(false); }
  };

  if (failed) return <p className="text-sm text-red-700">Не удалось загрузить {file}. Файл должен лежать в public/content (см. Tools/publish-app-content.sh в репозитории приложения).</p>;
  if (!data) return <p className="text-sm text-gray-500">Загрузка…</p>;

  const answers = [0, 1, 2, 3].map(n => topics.reduce((a, t) => a + t.levels.reduce((b, l) => b + l.questions.filter(x => x.answer === n).length, 0), 0));

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        {topics.length} {isWriters ? 'писателей' : 'разделов'}, {topics.reduce((a, t) => a + t.levels.reduce((b, l) => b + l.questions.length, 0), 0)} вопросов.
        Положение верного ответа (А/Б/В/Г): {answers.join(' / ')}. Приложение варианты не перемешивает, держите их ровно.
      </p>
      <div className="space-y-2">
        <input className={input} placeholder="Поиск по вопросам, вариантам и пояснениям (от 3 букв)" value={search} onChange={e => setSearch(e.target.value)} />
        {hits.length ? (
          <ul className="border border-gray-200 divide-y text-sm">
            {hits.map(h => (
              <li key={`${h.ti}-${h.li}-${h.qi}`}><button className="w-full text-left px-3 py-2 hover:bg-primary/5" onClick={() => { setTi(h.ti); setLi(h.li); setQi(h.qi); setSearch(''); }}>
                <span className="text-xs text-gray-400">{topics[h.ti].title} · {h.li + 1}.{h.qi + 1}</span> {h.text}
              </button></li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-1 max-h-[70vh] overflow-auto">
          {topics.map((t, i) => (
            <button key={t.id} onClick={() => { setTi(i); setLi(0); setQi(0); }}
              className={`w-full text-left border px-3 py-2 text-sm ${i === ti ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
              {t.title}<span className="block text-xs text-gray-400">{t.levels.reduce((b, l) => b + l.questions.length, 0)} вопр.</span>
            </button>
          ))}
          <button onClick={addTopic} className={`${btn} w-full`}>+ {isWriters ? 'Писатель' : 'Раздел'}</button>
          <div className="border border-gray-200 p-3 mt-3 space-y-2 text-xs">
            <div className="text-[11px] uppercase tracking-wider text-gray-500">Таблица для вычитки</div>
            <button onClick={exportCsv} className="block underline text-gray-700">Выгрузить в Excel / Google Таблицы</button>
            <label className="block underline text-gray-700 cursor-pointer">Загрузить исправленную таблицу<input type="file" accept=".csv,text/csv" className="hidden" onChange={x => { importCsv(x.target.files?.[0]); x.target.value = ''; }} /></label>
            <p className="text-gray-400">Правьте текст, варианты и букву верного ответа; строки сопоставляются по id. Новый id вида «уровень-номер» добавит вопрос.</p>
          </div>
          <div className="flex gap-3 text-xs pt-1">
            <button onClick={() => download(file, data)} className="underline text-gray-600">Скачать JSON</button>
            <label className="underline text-gray-600 cursor-pointer">Загрузить JSON<input type="file" accept="application/json" className="hidden" onChange={x => { importFile(x.target.files?.[0]); x.target.value = ''; }} /></label>
          </div>
        </div>

        {topic ? (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 border border-gray-200 p-4">
              <Field label={isWriters ? 'Писатель' : 'Раздел'}><input className={input} value={topic.title} onChange={e => editTopic({ title: e.target.value })} /></Field>
              <Field label="Подзаголовок"><input className={input} value={topic.subtitle} onChange={e => editTopic({ subtitle: e.target.value })} /></Field>
              {isWriters ? <Field label="Годы жизни"><input className={input} value={topic.years || ''} onChange={e => editTopic({ years: e.target.value })} /></Field> : null}
              {isWriters ? (
                <Field label="Группа">
                  <select className={input} value={topic.group || ''} onChange={e => editTopic({ group: e.target.value })}>
                    {[['golden', 'Золотой век'], ['silver', 'Серебряный век'], ['twentieth', 'XX век'], ['world', 'Мировая']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </Field>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {topic.levels.map((l, j) => (
                <button key={l.id} onClick={() => { setLi(j); setQi(0); }} className={`${btn} ${j === li ? 'bg-primary text-white' : ''}`}>{j + 1}. {l.title}</button>
              ))}
              <button onClick={addLevel} className={btn}>+ уровень</button>
              <button onClick={removeLevel} className="text-sm text-red-700 underline px-2">удалить последний</button>
            </div>

            {level ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Название уровня"><input className={input} value={level.title} onChange={e => editLevel({ title: e.target.value })} /></Field>
                  <Field label="Подзаголовок уровня"><input className={input} value={level.subtitle} onChange={e => editLevel({ subtitle: e.target.value })} /></Field>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {level.questions.map((x, k) => (
                    <button key={x.id} onClick={() => setQi(k)} className={`w-9 h-9 text-xs border ${k === qi ? 'bg-primary text-white border-primary' : 'border-gray-300'}`}>{k + 1}</button>
                  ))}
                  <button onClick={addQuestion} className="w-9 h-9 text-lg border border-dashed border-gray-400" title="Один вопрос">+</button>
                  <button onClick={() => setPasteOpen(o => !o)} className={`${btn} h-9 py-0`}>{pasteOpen ? 'Закрыть' : 'Добавить списком'}</button>
                </div>

                {pasteOpen ? (
                  <div className="border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs text-gray-600">
                      Вставьте вопросы текстом, между вопросами пустая строка. Первая строка – вопрос, дальше четыре варианта,
                      верный отмечен <b>*</b> или <b>+</b>. Строка с <b>=</b> – пояснение, с <b>#</b> – навык (необязательно).
                      Верные ответы сами разложатся ровно по А–Г.
                    </p>
                    <textarea rows={10} className={`${input} font-mono`} value={pasteText} onChange={e => setPasteText(e.target.value)}
                      placeholder={'Кто написал «Шинель»?\nПушкин\n* Гоголь\nЛермонтов\nЧехов\n= Повесть 1842 года, «Петербургские повести».\n\nСледующий вопрос…'} />
                    {pasted.errors.length ? <ul className="text-xs text-red-700 list-disc pl-5">{pasted.errors.map(x => <li key={x}>{x}</li>)}</ul> : null}
                    <button className={btnMain} disabled={!pasted.items.length} onClick={addPasted}>
                      Добавить в «{level.title}»: {pasted.items.length}
                    </button>
                  </div>
                ) : null}

                {q ? (
                  <div className="space-y-4 border border-gray-200 p-5">
                    <Field label={`Вопрос (${q.id})`}><textarea rows={2} className={input} value={q.q} onChange={e => editQ({ q: e.target.value })} /></Field>
                    <div className="space-y-2">
                      <span className="text-[11px] uppercase tracking-wider text-gray-500">Варианты (отметьте верный)</span>
                      {q.options.map((o, n) => (
                        <div key={n} className="flex items-center gap-3">
                          <input type="radio" name={`ans-${q.id}`} checked={q.answer === n} onChange={() => editQ({ answer: n })} />
                          <span className="w-4 text-xs text-gray-400">{'АБВГ'[n]}</span>
                          <input className={input} value={o} onChange={e => editOption(n, e.target.value)} />
                        </div>
                      ))}
                    </div>
                    <Field label="Пояснение после ответа"><textarea rows={3} className={input} value={q.note} onChange={e => editQ({ note: e.target.value })} /></Field>
                    <Field label="Навык">
                      <select className={input} value={q.skill} onChange={e => editQ({ skill: e.target.value })}>
                        {skills.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    </Field>
                    <div className="flex flex-wrap gap-5 text-sm">
                      <button onClick={() => moveQuestion(-1)} className="underline">← Выше</button>
                      <button onClick={() => moveQuestion(1)} className="underline">Ниже →</button>
                      <button onClick={duplicateQuestion} className="underline">Дублировать</button>
                      <button onClick={removeQuestion} className="text-red-700 underline">Удалить вопрос</button>
                    </div>
                  </div>
                ) : <p className="text-sm text-gray-500">В этом уровне нет вопросов.</p>}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {errors.length ? (
        <details open className="text-sm text-red-700">
          <summary>Нужно исправить перед публикацией: {errors.length}</summary>
          <ul className="list-disc pl-5 max-h-48 overflow-auto">{errors.slice(0, 60).map(x => <li key={x}>{x}</li>)}</ul>
        </details>
      ) : null}
      <div className="flex items-center gap-4">
        <button className={btnMain} disabled={!dirty || saving || errors.length > 0} onClick={save}>{saving ? 'Сохраняю…' : 'Сохранить и опубликовать'}</button>
        {dirty ? <span className="text-xs text-amber-700">Есть несохранённые правки</span> : null}
      </div>
    </div>
  );
};

// ───────────────────────── settings ─────────────────────────

// app-settings.json: what the editors may change in the app without a new build.
type Texts = { ru: string; en: string; de: string };
type AppSettings = {
  contacts: { email: string; telegram: string; instagram: string; shop: string };
  notice: { on: boolean; text: Texts; url: string; until: string };
  manuscripts: { open: boolean; closedText: Texts };
};
const DEFAULT_SETTINGS: AppSettings = {
  contacts: { email: 'am.hybridpublishing@gmail.com', telegram: 'https://t.me/ampublishingberlin', instagram: 'https://www.instagram.com/am.publishing', shop: 'https://shop.ampublishing.org' },
  notice: { on: false, text: { ru: '', en: '', de: '' }, url: '', until: '' },
  manuscripts: { open: true, closedText: { ru: '', en: '', de: '' } },
};
const LANGS: [Lang, string][] = [['ru', 'Русский'], ['en', 'English'], ['de', 'Deutsch']];

const checkSettings = (s: AppSettings): string[] => {
  const errors: string[] = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.contacts.email)) errors.push('Почта издательства указана неверно');
  (['telegram', 'instagram', 'shop'] as const).forEach(k => { if (!/^https:\/\//.test(s.contacts[k])) errors.push(`Ссылка «${k}» должна начинаться с https://`); });
  if (s.notice.on && !s.notice.text.ru.trim()) errors.push('Объявление включено, но русского текста нет');
  if (s.notice.url && !/^https:\/\//.test(s.notice.url)) errors.push('Ссылка объявления должна начинаться с https://');
  if (s.notice.until && !/^\d{4}-\d{2}-\d{2}$/.test(s.notice.until)) errors.push('Дата «до» должна быть вида 2026-11-20');
  if (!s.manuscripts.open && !s.manuscripts.closedText.ru.trim()) errors.push('Приём рукописей закрыт: напишите авторам, почему и до когда');
  return errors;
};

const SettingsEditor: React.FC<Props> = ({ onToast }) => {
  const [s, setS] = useState<AppSettings | null>(null);
  const [fileExists, setFileExists] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load<Partial<AppSettings>>('app-settings.json').then(d => {
      setFileExists(d !== null);
      setS({
        contacts: { ...DEFAULT_SETTINGS.contacts, ...d?.contacts },
        notice: { ...DEFAULT_SETTINGS.notice, ...d?.notice, text: { ...DEFAULT_SETTINGS.notice.text, ...d?.notice?.text } },
        manuscripts: { ...DEFAULT_SETTINGS.manuscripts, ...d?.manuscripts, closedText: { ...DEFAULT_SETTINGS.manuscripts.closedText, ...d?.manuscripts?.closedText } },
      });
    });
  }, []);
  const errors = useMemo(() => (s ? checkSettings(s) : []), [s]);
  const set = <K extends keyof AppSettings>(k: K, p: Partial<AppSettings[K]>) => { setS(x => x && { ...x, [k]: { ...x[k], ...p } }); setDirty(true); };

  const save = async () => {
    if (!s || errors.length) return;
    setSaving(true);
    try {
      const tidyTexts = (t: Texts): Texts => ({ ru: tidy(t.ru.trim()), en: tidy(t.en.trim()), de: tidy(t.de.trim()) });
      const out: AppSettings = { ...s, notice: { ...s.notice, text: tidyTexts(s.notice.text) }, manuscripts: { ...s.manuscripts, closedText: tidyTexts(s.manuscripts.closedText) } };
      await contentStore.ghWritePublicFile('public/content/app-settings.json', out, 'admin: app settings');
      setDirty(false); setFileExists(true);
      onToast('Настройки сохранены. Приложение применит их после публикации сайта.', 'success');
    } catch (e: any) { onToast(e?.message || 'Не удалось сохранить', 'error'); }
    finally { setSaving(false); }
  };

  if (!s) return <p className="text-sm text-gray-500">Загрузка…</p>;
  const texts = (value: Texts, onChange: (t: Texts) => void, rows = 2) => (
    <div className="grid gap-3 md:grid-cols-3">
      {LANGS.map(([l, name]) => (
        <Field key={l} label={name}><textarea rows={rows} className={input} value={value[l]} onChange={e => onChange({ ...value, [l]: e.target.value })} /></Field>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      {!fileExists ? <p className="text-xs text-amber-700">Файла app-settings.json пока нет: приложение работает со значениями по умолчанию. Сохранение создаст его.</p> : null}

      <div className="border border-gray-200 p-5 space-y-4">
        <div>
          <h4 className="text-lg font-serif">Объявление на главной</h4>
          <p className="text-xs text-gray-500">Золотая плашка под эмблемой: предзаказ, перенос события, важная новость.</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.notice.on} onChange={e => set('notice', { on: e.target.checked })} /> Показывать объявление</label>
        {texts(s.notice.text, text => set('notice', { text }))}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Ссылка по нажатию (необязательно)"><input className={input} value={s.notice.url} onChange={e => set('notice', { url: e.target.value })} placeholder="https://ampublishing.org/…" /></Field>
          <Field label="Показывать до (включительно)" hint="Пусто – пока не выключите"><input type="date" className={input} value={s.notice.until} onChange={e => set('notice', { until: e.target.value })} /></Field>
        </div>
      </div>

      <div className="border border-gray-200 p-5 space-y-4">
        <div>
          <h4 className="text-lg font-serif">Приём рукописей</h4>
          <p className="text-xs text-gray-500">Если закрыть, форма «Отправить рукопись» в приложении покажет ваше сообщение вместо полей. Заявки на услуги принимаются как прежде.</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.manuscripts.open} onChange={e => set('manuscripts', { open: e.target.checked })} /> Рукописи принимаются</label>
        {!s.manuscripts.open ? texts(s.manuscripts.closedText, closedText => set('manuscripts', { closedText }), 3) : null}
      </div>

      <div className="border border-gray-200 p-5 space-y-4">
        <h4 className="text-lg font-serif">Контакты в приложении</h4>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Почта издательства"><input className={input} value={s.contacts.email} onChange={e => set('contacts', { email: e.target.value })} /></Field>
          <Field label="Магазин"><input className={input} value={s.contacts.shop} onChange={e => set('contacts', { shop: e.target.value })} /></Field>
          <Field label="Telegram"><input className={input} value={s.contacts.telegram} onChange={e => set('contacts', { telegram: e.target.value })} /></Field>
          <Field label="Instagram"><input className={input} value={s.contacts.instagram} onChange={e => set('contacts', { instagram: e.target.value })} /></Field>
        </div>
      </div>

      {errors.length ? <ul className="text-sm text-red-700 list-disc pl-5">{errors.map(x => <li key={x}>{x}</li>)}</ul> : null}
      <div className="flex items-center gap-4">
        <button className={btnMain} disabled={!dirty || saving || errors.length > 0} onClick={save}>{saving ? 'Сохраняю…' : 'Сохранить и опубликовать'}</button>
        {dirty ? <span className="text-xs text-amber-700">Есть несохранённые правки</span> : null}
      </div>
    </div>
  );
};

// ───────────────────────── section ─────────────────────────

export const AppContentEditor: React.FC<Props> = ({ onToast }) => {
  const [part, setPart] = useState<'events' | 'quiz' | 'writers' | 'settings'>('events');
  return (
    <section className="bg-white border border-primary/10 p-6 md:p-8 space-y-8">
      <div>
        <h3 className="text-3xl font-serif">Мобильное приложение</h3>
        <p className="mt-2 text-sm text-gray-500">
          Афиша событий и вопросы Мастерской. Книги, новости и услуги приложение уже берёт из разделов «Книги», «Мероприятия» и «Услуги».
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([['events', 'Афиша событий'], ['quiz', 'Вопросы: предметы'], ['writers', 'Вопросы: писатели'], ['settings', 'Настройки приложения']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setPart(id)} className={`${btn} ${part === id ? 'bg-primary text-white' : ''}`}>{label}</button>
        ))}
      </div>
      {part === 'events' ? <EventsEditor onToast={onToast} /> : null}
      {part === 'quiz' ? <QuizEditor key="q" file="quiz.ru.json" onToast={onToast} /> : null}
      {part === 'writers' ? <QuizEditor key="w" file="writers.ru.json" onToast={onToast} /> : null}
      {part === 'settings' ? <SettingsEditor onToast={onToast} /> : null}
    </section>
  );
};
