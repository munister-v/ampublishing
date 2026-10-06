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
              <div className="text-xs text-gray-500">{ev.start}{ev.draft ? ' · черновик' : ''}</div>
            </button>
          ))}
          <button onClick={add} className={`${btn} w-full`}>+ Добавить событие</button>
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
              <Field label="Картинка (URL)"><input className={input} value={e.imageUrl || ''} onChange={x => patch(sel, { imageUrl: x.target.value })} /></Field>
              <Field label="id книги"><input className={input} value={e.bookId || ''} onChange={x => patch(sel, { bookId: x.target.value })} /></Field>
              <Field label="id новости на сайте"><input className={input} value={e.newsId || ''} onChange={x => patch(sel, { newsId: x.target.value })} /></Field>
            </div>
            <Field label="Коротко"><textarea rows={2} className={input} value={e.summary || ''} onChange={x => patch(sel, { summary: x.target.value })} /></Field>
            <Field label="Подробно"><textarea rows={5} className={input} value={e.body || ''} onChange={x => patch(sel, { body: x.target.value })} /></Field>
            <div className="flex flex-wrap gap-6 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!e.registration} onChange={x => patch(sel, { registration: x.target.checked })} /> Запись (кнопка «Забронировать место»)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!e.draft} onChange={x => patch(sel, { draft: x.target.checked })} /> Черновик (в приложении не виден)</label>
            </div>
            <button onClick={() => remove(sel)} className="text-sm text-red-700 underline">Удалить событие</button>
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
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-1 max-h-[70vh] overflow-auto">
          {topics.map((t, i) => (
            <button key={t.id} onClick={() => { setTi(i); setLi(0); setQi(0); }}
              className={`w-full text-left border px-3 py-2 text-sm ${i === ti ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
              {t.title}<span className="block text-xs text-gray-400">{t.levels.reduce((b, l) => b + l.questions.length, 0)} вопр.</span>
            </button>
          ))}
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
                  <button onClick={addQuestion} className="w-9 h-9 text-lg border border-dashed border-gray-400">+</button>
                </div>

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
                    <button onClick={removeQuestion} className="text-sm text-red-700 underline">Удалить вопрос</button>
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

// ───────────────────────── section ─────────────────────────

export const AppContentEditor: React.FC<Props> = ({ onToast }) => {
  const [part, setPart] = useState<'events' | 'quiz' | 'writers'>('events');
  return (
    <section className="bg-white border border-primary/10 p-6 md:p-8 space-y-8">
      <div>
        <h3 className="text-3xl font-serif">Мобильное приложение</h3>
        <p className="mt-2 text-sm text-gray-500">
          Афиша событий и вопросы Мастерской. Книги, новости и услуги приложение уже берёт из разделов «Книги», «Мероприятия» и «Услуги».
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {([['events', 'Афиша событий'], ['quiz', 'Вопросы: предметы'], ['writers', 'Вопросы: писатели']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setPart(id)} className={`${btn} ${part === id ? 'bg-primary text-white' : ''}`}>{label}</button>
        ))}
      </div>
      {part === 'events' ? <EventsEditor onToast={onToast} /> : null}
      {part === 'quiz' ? <QuizEditor key="q" file="quiz.ru.json" onToast={onToast} /> : null}
      {part === 'writers' ? <QuizEditor key="w" file="writers.ru.json" onToast={onToast} /> : null}
    </section>
  );
};
