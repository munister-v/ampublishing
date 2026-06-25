import React, { useEffect, useRef, useState, useCallback, type FormEvent } from 'react';
import { useApp } from '../AppContext';
import {
  radioGuestJoin,
  fetchRadioMessages,
  pollRadioMessages,
  sendRadioMessage,
  fetchRadioOnline,
  getRadioUser,
  type RadioMessage,
  type RadioUser,
} from '../services/radioApi';

const RADIO_URL = 'https://radio.ampublishing.org';
const POLL_MS = 3000;

const MEDIA_RE = /^https?:\/\/\S+\.(gif|jpg|jpeg|png|webp)(\?.*)?$/i;
const TENOR_RE = /^https?:\/\/media\.tenor\.com\//i;
const URL_RE = /(https?:\/\/[^\s]+)/g;

function isMedia(text: string) {
  const t = text.trim();
  return MEDIA_RE.test(t) || TENOR_RE.test(t);
}

function MsgContent({ text }: { text: string }) {
  if (isMedia(text)) {
    return (
      <img
        src={text.trim()}
        alt=""
        className="mt-1 max-w-[260px] max-h-[180px] object-contain border border-line"
        loading="lazy"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        URL_RE.test(part)
          ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">{part}</a>
          : part,
      )}
    </>
  );
}

function Avatar({ nickname, color }: { nickname: string; color: string }) {
  return (
    <div
      className="w-8 h-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-white flex-shrink-0"
      style={{ backgroundColor: color || '#040F1E' }}
    >
      {nickname.slice(0, 2)}
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function LiveDot({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full bg-accent opacity-75" />
        <span className="relative inline-flex h-2 w-2 bg-accent" />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
        {count} online
      </span>
    </div>
  );
}

export const RadioPage: React.FC = () => {
  const { language } = useApp();

  const [user, setUser] = useState<RadioUser | null>(null);
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const [online, setOnline] = useState<RadioUser[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const labels = {
    ru: {
      kicker: 'AM Publishing Radio',
      title: 'AM Publishing Radio',
      subtitle: 'Живое радио издательства. Музыка, атмосфера, разговоры.',
      tuneIn: 'Слушать эфир →',
      chat: 'Чат',
      placeholder: 'Написать в чат…',
      send: 'Отправить',
      you: 'Вы',
      listeners: 'в эфире',
      stationDesc: 'Радиостанция AM Publishing — живой эфир для читателей и друзей издательства. Берлин.',
      openLabel: 'Открыть радио',
      loading: 'Загрузка чата…',
      errorConn: 'Не удалось подключиться к радио',
    },
    en: {
      kicker: 'AM Publishing Radio',
      title: 'AM Publishing Radio',
      subtitle: 'Live radio from the publishing house. Music, atmosphere, conversations.',
      tuneIn: 'Tune in →',
      chat: 'Chat',
      placeholder: 'Write to chat…',
      send: 'Send',
      you: 'You',
      listeners: 'online',
      stationDesc: 'AM Publishing Radio — live broadcast for readers and friends of the publishing house. Berlin.',
      openLabel: 'Open radio',
      loading: 'Loading chat…',
      errorConn: 'Could not connect to radio',
    },
    de: {
      kicker: 'AM Publishing Radio',
      title: 'AM Publishing Radio',
      subtitle: 'Live-Radio des Verlags. Musik, Atmosphäre, Gespräche.',
      tuneIn: 'Reinhören →',
      chat: 'Chat',
      placeholder: 'In den Chat schreiben…',
      send: 'Senden',
      you: 'Sie',
      listeners: 'online',
      stationDesc: 'AM Publishing Radio — Live-Sendung für Leser und Freunde des Verlags. Berlin.',
      openLabel: 'Radio öffnen',
      loading: 'Chat wird geladen…',
      errorConn: 'Verbindung zum Radio fehlgeschlagen',
    },
  };
  const L = labels[language] ?? labels.en;

  // Auth + initial load
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        let u = getRadioUser();
        if (!u) u = await radioGuestJoin();
        if (cancelled) return;
        setUser(u);

        const [msgs, ol] = await Promise.all([fetchRadioMessages(), fetchRadioOnline()]);
        if (cancelled) return;
        setMessages(msgs.filter(m => !m.is_deleted));
        setOnline(ol);
        if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
      } catch {
        if (!cancelled) setError(L.errorConn);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Polling
  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(async () => {
      try {
        const result = await pollRadioMessages(lastIdRef.current);
        if (result.messages.length) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            const fresh = result.messages.filter(m => !m.is_deleted && !ids.has(m.id));
            return [...prev, ...fresh];
          });
          const last = result.messages[result.messages.length - 1];
          if (last) lastIdRef.current = last.id;
        }
        const ol = await fetchRadioOnline();
        setOnline(ol);
      } catch { /* silent */ }
    }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      if (!getRadioUser()) await radioGuestJoin();
      const msg = await sendRadioMessage(text);
      setMessages(prev => [...prev, msg]);
      lastIdRef.current = msg.id;
      setInput('');
    } catch { /* silent */ } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as FormEvent);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-primary font-sans">

      {/* ── PAGE HEADER ─────────────────────────────────────────── */}
      <div className="border-b border-primary">
        <div className="flex items-stretch min-h-[120px] md:min-h-[160px]">

          {/* Left: kicker + title */}
          <div className="flex-1 p-6 md:p-10 border-r border-primary flex flex-col justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-accent" />
              {L.kicker}
            </p>
            <div>
              <h1 className="font-serif text-5xl md:text-7xl leading-none mt-4">{L.title}</h1>
              <p className="font-mono text-xs text-primary/50 mt-2 max-w-md">{L.subtitle}</p>
            </div>
          </div>

          {/* Right: tune-in CTA */}
          <a
            href={RADIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-[160px] md:w-[220px] flex flex-col items-center justify-center gap-3 bg-primary text-white hover:bg-accent hover:text-primary transition-colors duration-300 cursor-pointer group"
          >
            {/* Waveform icon */}
            <svg viewBox="0 0 48 32" className="w-10 h-7 opacity-60 group-hover:opacity-100 transition-opacity" fill="currentColor">
              <rect x="0"  y="10" width="4" height="12" />
              <rect x="7"  y="4"  width="4" height="24" />
              <rect x="14" y="0"  width="4" height="32" />
              <rect x="21" y="6"  width="4" height="20" />
              <rect x="28" y="2"  width="4" height="28" />
              <rect x="35" y="8"  width="4" height="16" />
              <rect x="42" y="12" width="4" height="8"  />
            </svg>
            <span className="font-mono text-[10px] uppercase tracking-widest text-center px-2">{L.tuneIn}</span>
          </a>
        </div>
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-[calc(100vh-160px)]">

        {/* ── CHAT COLUMN ─────────────────────────────────────────── */}
        <div className="flex flex-col border-r border-primary">

          {/* Chat header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-primary">
            <span className="font-mono text-[10px] uppercase tracking-widest">{L.chat}</span>
            {online.length > 0 && <LiveDot count={online.length} />}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-0.5" style={{ maxHeight: 'calc(100vh - 340px)' }}>
            {loading && (
              <p className="font-mono text-xs text-primary/40 text-center py-12">{L.loading}</p>
            )}
            {!loading && error && (
              <p className="font-mono text-xs text-red-600 text-center py-12">{error}</p>
            )}
            {!loading && !error && messages.length === 0 && (
              <p className="font-mono text-xs text-primary/30 text-center py-12">—</p>
            )}
            {messages.map((msg, i) => {
              const isOwn = user?.id === msg.user_id;
              const prevMsg = messages[i - 1];
              const grouped = prevMsg && prevMsg.user_id === msg.user_id;
              return (
                <div key={msg.id} className={`flex gap-3 ${grouped ? 'pt-0.5' : 'pt-4'}`}>
                  <div className="w-8 flex-shrink-0">
                    {!grouped && <Avatar nickname={msg.nickname} color={msg.color} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    {!grouped && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-bold text-xs" style={{ color: isOwn ? '#C9A66B' : msg.color }}>
                          {isOwn ? L.you : msg.nickname}
                        </span>
                        <span className="font-mono text-[9px] text-primary/30">{formatTime(msg.created_at)}</span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed break-words">
                      <MsgContent text={msg.text} />
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="border-t border-primary flex items-stretch"
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={L.placeholder}
              rows={2}
              className="flex-1 resize-none bg-transparent px-5 py-4 text-sm outline-none placeholder:text-primary/30 font-sans"
              disabled={sending || !!error}
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !!error}
              className="w-[100px] md:w-[140px] border-l border-primary bg-primary text-white font-mono text-[10px] uppercase tracking-widest hover:bg-accent hover:text-primary hover:border-accent transition-colors duration-200 disabled:opacity-30 disabled:cursor-default"
            >
              {L.send}
            </button>
          </form>
        </div>

        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <div className="flex flex-col">

          {/* Station info */}
          <div className="p-6 md:p-8 border-b border-primary">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-4">
              Station
            </p>
            <h2 className="font-serif text-3xl leading-tight mb-3">AM Publishing Radio</h2>
            <p className="text-xs text-primary/60 leading-relaxed font-sans">{L.stationDesc}</p>
            <a
              href={RADIO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest border border-primary px-4 py-2.5 hover:bg-primary hover:text-white transition-colors duration-200"
            >
              {L.openLabel}
              <span className="opacity-50">↗</span>
            </a>
          </div>

          {/* Online list */}
          <div className="p-6 md:p-8 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-4">
              {L.listeners}
            </p>
            <ul className="space-y-2">
              {online.map(u => (
                <li key={u.id} className="flex items-center gap-2.5">
                  <Avatar nickname={u.nickname} color={u.color} />
                  <span className="text-xs font-sans truncate" style={{ color: u.id === user?.id ? '#C9A66B' : undefined }}>
                    {u.id === user?.id ? `${u.nickname} (${L.you.toLowerCase()})` : u.nickname}
                  </span>
                </li>
              ))}
              {online.length === 0 && !loading && (
                <li className="font-mono text-[10px] text-primary/30">—</li>
              )}
            </ul>
          </div>

          {/* Bottom mark */}
          <div className="border-t border-primary p-5 flex items-center gap-3">
            <span className="font-serif text-lg leading-none">AM</span>
            <span className="w-px h-4 bg-primary/20" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-primary/40">Berlin, {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
