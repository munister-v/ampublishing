import React, { useState, useEffect, type FormEvent } from 'react';
import {
  adminLogin, adminClearChat, adminUnpinAll, adminPin,
  adminAnnounce, getAdminToken, clearAdminToken,
  fetchPinnedMessages,
  type RadioMessage, type AnnouncePayload,
} from '../services/radioApi';
import { RadioConfigForm } from './RadioConfigForm';

type Tab = 'config' | 'announce' | 'pins' | 'chat';

type Props = {
  onClose: () => void;
  onChatCleared: () => void;
  onPinChanged: (id: number, pinned: boolean) => void;
  onAnnounced: () => void;
};

const FIELD = 'w-full bg-transparent border-b border-primary/25 pb-1.5 text-sm outline-none placeholder:text-primary/30 focus:border-primary transition-colors font-sans';
const MONO_LABEL = 'font-mono text-[9px] uppercase tracking-widest text-primary/40 mb-1 block';

export const RadioAdminPanel: React.FC<Props> = ({ onClose, onChatCleared, onPinChanged, onAnnounced }) => {
  const [authed, setAuthed] = useState(!!getAdminToken());
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('config');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Announce form
  const [aType, setAType] = useState<'announcement' | 'podcast'>('announcement');
  const [aTitle, setATitle] = useState('');
  const [aText, setAText] = useState('');
  const [aDesc, setADesc] = useState('');
  const [aUrl, setAUrl] = useState('');
  const [aImage, setAImage] = useState('');
  const [aPinned, setAPinned] = useState(true);

  // Pins list
  const [pins, setPins] = useState<RadioMessage[]>([]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (authed && tab === 'pins') {
      fetchPinnedMessages().then(setPins).catch(() => {});
    }
  }, [authed, tab]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginLoading(true); setLoginErr('');
    try {
      await adminLogin(password);
      setAuthed(true); setPassword('');
    } catch (err: any) {
      setLoginErr(err.message || 'Неверный пароль');
    } finally { setLoginLoading(false); }
  };

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleClearChat = async () => {
    if (!confirm('Очистить весь чат? Это действие нельзя отменить.')) return;
    setBusy(true);
    try {
      const r = await adminClearChat();
      flash(`Очищено: ${r.cleared} сообщений`);
      onChatCleared();
    } catch (e: any) { flash(e.message); }
    finally { setBusy(false); }
  };

  const handleUnpinAll = async () => {
    if (!confirm('Открепить все сообщения?')) return;
    setBusy(true);
    try {
      await adminUnpinAll();
      setPins([]);
      flash('Все откреплены');
      onPinChanged(-1, false);
    } catch (e: any) { flash(e.message); }
    finally { setBusy(false); }
  };

  const handleUnpin = async (id: number) => {
    setBusy(true);
    try {
      await adminPin(id);
      setPins(p => p.filter(m => m.id !== id));
      onPinChanged(id, false);
    } catch (e: any) { flash(e.message); }
    finally { setBusy(false); }
  };

  const handleAnnounce = async (e: FormEvent) => {
    e.preventDefault();
    if (!aTitle && !aText) return;
    setBusy(true);
    try {
      const payload: AnnouncePayload = {
        msg_type: aType, text: aText, meta_title: aTitle,
        meta_description: aDesc, meta_url: aUrl, meta_image: aImage, pinned: aPinned,
      };
      await adminAnnounce(payload);
      flash(aPinned ? 'Опубликовано и закреплено' : 'Опубликовано');
      setATitle(''); setAText(''); setADesc(''); setAUrl(''); setAImage('');
      onAnnounced();
    } catch (e: any) { flash(e.message); }
    finally { setBusy(false); }
  };

  const handleLogout = () => { clearAdminToken(); setAuthed(false); };

  // ── Overlay ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-primary/60 backdrop-blur-sm px-4">
      <div className="bg-bg border border-primary w-full max-w-md max-h-[90dvh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary flex-shrink-0">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-primary/40">AM Publishing</p>
            <h2 className="font-serif text-xl leading-tight">Radio Admin</h2>
          </div>
          <div className="flex items-center gap-3">
            {authed && (
              <button onClick={handleLogout} className="font-mono text-[8px] uppercase tracking-widest text-primary/30 hover:text-primary transition-colors">
                Выйти
              </button>
            )}
            <button onClick={onClose} className="text-primary/40 hover:text-primary transition-colors text-lg leading-none">✕</button>
          </div>
        </div>

        {/* Flash message */}
        {msg && (
          <div className="px-6 py-2 bg-accent/10 border-b border-accent/20 font-mono text-[10px] text-accent flex-shrink-0">
            {msg}
          </div>
        )}

        {/* Login gate */}
        {!authed ? (
          <form onSubmit={handleLogin} className="p-6 flex flex-col gap-4">
            <p className="font-mono text-[10px] text-primary/50">Введите пароль администратора</p>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Пароль…" autoFocus
              className="w-full bg-transparent border border-primary/30 px-4 py-3 text-sm outline-none focus:border-primary font-sans placeholder:text-primary/30"
            />
            {loginErr && <p className="font-mono text-[10px] text-red-500">{loginErr}</p>}
            <button type="submit" disabled={loginLoading || !password}
              className="bg-primary text-white font-mono text-[10px] uppercase tracking-widest py-3 hover:bg-accent hover:text-primary transition-colors disabled:opacity-40">
              {loginLoading ? '…' : 'Войти'}
            </button>
          </form>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-primary flex-shrink-0">
              {([['config', 'Радио'], ['announce', 'Анонс'], ['pins', 'Закрепы'], ['chat', 'Чат']] as [Tab, string][]).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${tab === t ? 'bg-primary text-white' : 'text-primary/40 hover:text-primary'}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6">

              {/* ── Radio configurator ───────────────────────────────── */}
              {tab === 'config' && <RadioConfigForm />}

              {/* ── Announce tab ──────────────────────────────────────── */}
              {tab === 'announce' && (
                <form onSubmit={handleAnnounce} className="space-y-5">
                  {/* Type selector */}
                  <div>
                    <span className={MONO_LABEL}>Тип</span>
                    <div className="flex gap-0">
                      {(['announcement', 'podcast'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setAType(t)}
                          className={`flex-1 py-2 font-mono text-[9px] uppercase tracking-widest border transition-colors ${aType === t ? 'bg-primary text-white border-primary' : 'border-primary/30 text-primary/50 hover:border-primary hover:text-primary'}`}>
                          {t === 'announcement' ? '📢 Анонс' : '🎙 Подкаст'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div><span className={MONO_LABEL}>Заголовок</span>
                    <input value={aTitle} onChange={e => setATitle(e.target.value)} placeholder="Заголовок публикации…" className={FIELD} /></div>

                  <div><span className={MONO_LABEL}>Текст / подпись</span>
                    <textarea value={aText} onChange={e => setAText(e.target.value)} placeholder="Текст анонса или описание…" rows={3}
                      className={`${FIELD} resize-none`} /></div>

                  <div><span className={MONO_LABEL}>Описание (краткое)</span>
                    <input value={aDesc} onChange={e => setADesc(e.target.value)} placeholder="Краткое описание…" className={FIELD} /></div>

                  <div><span className={MONO_LABEL}>Ссылка</span>
                    <input value={aUrl} onChange={e => setAUrl(e.target.value)} placeholder="https://…" className={FIELD} type="url" /></div>

                  <div><span className={MONO_LABEL}>Обложка (URL картинки)</span>
                    <input value={aImage} onChange={e => setAImage(e.target.value)} placeholder="https://…/image.jpg" className={FIELD} />
                    {aImage && (
                      <img src={aImage} alt="" className="mt-2 h-20 object-cover w-full border border-primary/20"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                    )}
                  </div>

                  {/* Pin toggle */}
                  <label className="flex items-center gap-3 cursor-pointer" onClick={() => setAPinned(p => !p)}>
                    <div className={`w-8 h-4 relative transition-colors flex-shrink-0 ${aPinned ? 'bg-primary' : 'bg-primary/20'}`}>
                      <span className={`absolute top-0.5 w-3 h-3 bg-white transition-transform ${aPinned ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60">
                      Закрепить после публикации
                    </span>
                  </label>

                  <button type="submit" disabled={busy || (!aTitle && !aText)}
                    className="w-full bg-primary text-white font-mono text-[10px] uppercase tracking-widest py-3 hover:bg-accent hover:text-primary transition-colors disabled:opacity-40">
                    {busy ? '…' : aPinned ? 'Опубликовать и закрепить' : 'Опубликовать'}
                  </button>
                </form>
              )}

              {/* ── Pins tab ──────────────────────────────────────────── */}
              {tab === 'pins' && (
                <div className="space-y-4">
                  {pins.length === 0 && (
                    <p className="font-mono text-[10px] text-primary/30 text-center py-8">Нет закреплённых сообщений</p>
                  )}
                  {pins.map(m => (
                    <div key={m.id} className={`border-l-2 ${m.msg_type === 'podcast' ? 'border-accent' : 'border-primary'} pl-3 py-2`}>
                      <p className="font-mono text-[8px] uppercase tracking-widest text-primary/30 mb-1">
                        {m.msg_type === 'podcast' ? '🎙 Подкаст' : '📢 Анонс'} · #{m.id}
                      </p>
                      {m.meta_title && <p className="font-serif text-base leading-tight mb-1">{m.meta_title}</p>}
                      {m.text && <p className="text-xs text-primary/60 mb-2 line-clamp-2">{m.text}</p>}
                      {m.meta_url && <p className="font-mono text-[9px] text-primary/30 truncate mb-2">{m.meta_url}</p>}
                      <button onClick={() => handleUnpin(m.id)} disabled={busy}
                        className="font-mono text-[8px] uppercase tracking-widest border border-primary/30 px-3 py-1 hover:bg-primary hover:text-white transition-colors disabled:opacity-40">
                        Открепить
                      </button>
                    </div>
                  ))}
                  {pins.length > 1 && (
                    <button onClick={handleUnpinAll} disabled={busy}
                      className="w-full font-mono text-[9px] uppercase tracking-widest border border-primary/20 py-2.5 text-primary/40 hover:border-primary hover:text-primary transition-colors disabled:opacity-40 mt-4">
                      Открепить все
                    </button>
                  )}
                </div>
              )}

              {/* ── Chat tab ──────────────────────────────────────────── */}
              {tab === 'chat' && (
                <div className="space-y-4">
                  <p className="font-mono text-[10px] text-primary/40 leading-relaxed">
                    Очистка чата помечает все сообщения как удалённые. Анонсы и закрепы не затрагиваются.
                  </p>
                  <button onClick={handleClearChat} disabled={busy}
                    className="w-full border border-primary/30 py-3 font-mono text-[10px] uppercase tracking-widest text-primary/50 hover:bg-primary hover:text-white hover:border-primary transition-colors disabled:opacity-40">
                    {busy ? '…' : 'Очистить чат'}
                  </button>
                </div>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
};
