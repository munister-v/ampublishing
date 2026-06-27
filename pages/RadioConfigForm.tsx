import React, { useState, useEffect } from 'react';
import { fetchRadioConfig, saveRadioConfig, type RadioConfig } from '../services/radioApi';

const FIELD = 'w-full bg-transparent border-b border-primary/25 pb-1.5 text-sm outline-none placeholder:text-primary/30 focus:border-primary transition-colors font-sans';
const LABEL = 'font-mono text-[9px] uppercase tracking-widest text-primary/40 mb-1 block';
const SECTION = 'font-mono text-[10px] uppercase tracking-[0.2em] text-accent border-b border-primary/10 pb-1.5';

/**
 * Self-contained configurator for the editorial radio page (now-on-air, guest,
 * schedule, book of the week, hero image, Telegram). Loads/saves via the radio
 * admin API (requires a valid admin token already in session).
 */
export const RadioConfigForm: React.FC = () => {
  const [cfg, setCfg] = useState<RadioConfig>({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    fetchRadioConfig().then(c => { setCfg(c || {}); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const cf = (k: keyof RadioConfig) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCfg(c => ({ ...c, [k]: e.target.value }));
  const updateSched = (i: number, key: 'time' | 'title' | 'host', val: string) =>
    setCfg(c => { const sch = [...(c.schedule || [])]; sch[i] = { ...sch[i], [key]: val }; return { ...c, schedule: sch }; });
  const addSched = () => setCfg(c => ({ ...c, schedule: [...(c.schedule || []), { time: '', title: '', host: '' }] }));
  const removeSched = (i: number) => setCfg(c => ({ ...c, schedule: (c.schedule || []).filter((_, j) => j !== i) }));

  const save = async () => {
    setBusy(true);
    try { const saved = await saveRadioConfig(cfg); setCfg(saved); setFlash('Конфигурация сохранена'); }
    catch (e: any) { setFlash(e.message || 'Ошибка сохранения'); }
    finally { setBusy(false); setTimeout(() => setFlash(''), 3500); }
  };

  return (
    <div className="space-y-7">
      {!loaded && <p className="font-mono text-[10px] text-primary/30 text-center py-6">Загрузка…</p>}
      {flash && <div className="px-3 py-2 bg-accent/10 border border-accent/20 font-mono text-[10px] text-accent">{flash}</div>}

      {/* Now on air */}
      <section className="space-y-4">
        <p className={SECTION}>Сейчас в эфире</p>
        <div><span className={LABEL}>Название программы</span>
          <input value={cfg.now_title || ''} onChange={cf('now_title')} placeholder="Утренний разговор" className={FIELD} /></div>
        <div><span className={LABEL}>Ведущий</span>
          <input value={cfg.now_host || ''} onChange={cf('now_host')} placeholder="Алекса Драган" className={FIELD} /></div>
        <div><span className={LABEL}>Описание</span>
          <textarea value={cfg.now_description || ''} onChange={cf('now_description')} rows={2} placeholder="О чём эфир…" className={`${FIELD} resize-none`} /></div>
      </section>

      {/* Guest */}
      <section className="space-y-4">
        <p className={SECTION}>Гость эфира</p>
        <div><span className={LABEL}>Имя</span>
          <input value={cfg.guest_name || ''} onChange={cf('guest_name')} placeholder="Алекса Драган" className={FIELD} /></div>
        <div><span className={LABEL}>Роль / описание</span>
          <input value={cfg.guest_role || ''} onChange={cf('guest_role')} placeholder="Писатель, автор книги «В танце делюзий»" className={FIELD} /></div>
        <div className="flex gap-4">
          <div className="flex-1"><span className={LABEL}>Время</span>
            <input value={cfg.guest_time || ''} onChange={cf('guest_time')} placeholder="10:00 — 11:00" className={FIELD} /></div>
          <div className="flex-1"><span className={LABEL}>Длительность</span>
            <input value={cfg.guest_duration || ''} onChange={cf('guest_duration')} placeholder="60 минут" className={FIELD} /></div>
        </div>
      </section>

      {/* Schedule */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-primary/10 pb-1.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Расписание</p>
          <button type="button" onClick={addSched} className="font-mono text-[9px] uppercase tracking-widest text-primary/40 hover:text-accent transition-colors">+ строка</button>
        </div>
        {(cfg.schedule || []).length === 0 && <p className="font-mono text-[9px] text-primary/30">Пусто — нажмите «+ строка»</p>}
        {(cfg.schedule || []).map((row, i) => (
          <div key={i} className="flex items-start gap-2">
            <input value={row.time} onChange={e => updateSched(i, 'time', e.target.value)} placeholder="12:00"
              className="w-16 bg-transparent border-b border-primary/25 pb-1 text-xs font-mono outline-none focus:border-primary flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <input value={row.title} onChange={e => updateSched(i, 'title', e.target.value)} placeholder="Название программы"
                className="w-full bg-transparent border-b border-primary/25 pb-1 text-xs outline-none focus:border-primary" />
              <input value={row.host || ''} onChange={e => updateSched(i, 'host', e.target.value)} placeholder="с Сергеем Калининым"
                className="w-full bg-transparent border-b border-primary/15 pb-1 text-[11px] text-primary/60 outline-none focus:border-primary" />
            </div>
            <button type="button" onClick={() => removeSched(i)} className="text-primary/30 hover:text-red-500 text-sm leading-none mt-1 flex-shrink-0">✕</button>
          </div>
        ))}
      </section>

      {/* Book of the week */}
      <section className="space-y-4">
        <p className={SECTION}>Книга недели</p>
        <div className="flex gap-4">
          <div className="flex-1"><span className={LABEL}>Название</span>
            <input value={cfg.book_title || ''} onChange={cf('book_title')} placeholder="В танце делюзий" className={FIELD} /></div>
          <div className="flex-1"><span className={LABEL}>Автор</span>
            <input value={cfg.book_author || ''} onChange={cf('book_author')} placeholder="Алекса Драган" className={FIELD} /></div>
        </div>
        <div><span className={LABEL}>Обложка (URL)</span>
          <input value={cfg.book_image || ''} onChange={cf('book_image')} placeholder="https://…/cover.jpg" className={FIELD} />
          {cfg.book_image && <img src={cfg.book_image} alt="" className="mt-2 h-20 object-cover border border-primary/20" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
        </div>
        <div><span className={LABEL}>Ссылка</span>
          <input value={cfg.book_url || ''} onChange={cf('book_url')} placeholder="https://…" className={FIELD} type="url" /></div>
      </section>

      {/* Hero + telegram */}
      <section className="space-y-4">
        <p className={SECTION}>Оформление</p>
        <div><span className={LABEL}>Фото в шапке (URL)</span>
          <input value={cfg.hero_image || ''} onChange={cf('hero_image')} placeholder="https://…/host.jpg" className={FIELD} />
          {cfg.hero_image && <img src={cfg.hero_image} alt="" className="mt-2 h-24 w-full object-cover border border-primary/20 grayscale" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
        </div>
        <div><span className={LABEL}>Telegram (@…)</span>
          <input value={cfg.telegram || ''} onChange={cf('telegram')} placeholder="@ampublishingradio" className={FIELD} /></div>
      </section>

      <button onClick={save} disabled={busy || !loaded}
        className="w-full bg-primary text-white font-mono text-[10px] uppercase tracking-widest py-3 hover:bg-accent hover:text-primary transition-colors disabled:opacity-40">
        {busy ? '…' : 'Сохранить конфигурацию'}
      </button>
    </div>
  );
};
