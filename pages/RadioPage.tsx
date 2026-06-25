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

const RADIO_API = 'https://radio-api.helpushelpua.com/api';
const POLL_MS = 3000;

const MEDIA_RE = /^https?:\/\/\S+\.(gif|jpg|jpeg|png|webp)(\?.*)?$/i;
const TENOR_RE = /^https?:\/\/media\.tenor\.com\//i;
const URL_RE = /(https?:\/\/[^\s]+)/g;

function isMedia(text: string) {
  const t = text.trim();
  return MEDIA_RE.test(t) || TENOR_RE.test(t);
}

// ── useRadioAudio ──────────────────────────────────────────────────────────
function useRadioAudio(token: string | null) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSigRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const getToken = () => localStorage.getItem('ampub_radio_token');

  // Enumerate devices
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then(devices => {
      setAudioDevices(devices.filter(d => d.kind === 'audiooutput'));
      setMicDevices(devices.filter(d => d.kind === 'audioinput'));
    }).catch(() => {});
  }, []);

  // Media Session API
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'AM Publishing Radio',
      artist: 'AM Publishing Berlin',
      album: 'Live',
    });
    navigator.mediaSession.setActionHandler('play', () => { audioRef.current?.play(); setPlaying(true); });
    navigator.mediaSession.setActionHandler('pause', () => { audioRef.current?.pause(); setPlaying(false); });
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    };
  }, []);

  const stopAudio = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioRef.current) { audioRef.current.srcObject = null; }
    if (callIdRef.current) {
      const t = getToken();
      if (t) fetch(`${RADIO_API}/calls/${callIdRef.current}/leave`, { method: 'PUT', headers: { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } }).catch(() => {});
      callIdRef.current = null;
    }
    setPlaying(false);
    setStatus('idle');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }, []);

  const startAudio = useCallback(async () => {
    if (!token) return;
    setStatus('connecting');
    try {
      // Join call
      const joinRes = await fetch(`${RADIO_API}/calls/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const joinBody = await joinRes.json();
      const { call_id, latest_signal_id } = joinBody.data;
      callIdRef.current = call_id;
      lastSigRef.current = latest_signal_id ?? 0;

      // Get ICE config
      const cfgRes = await fetch(`${RADIO_API}/calls/config`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const cfgBody = await cfgRes.json();
      const iceServers: RTCIceServer[] = cfgBody.data?.ice_servers ?? [{ urls: 'stun:stun.l.google.com:19302' }];

      // Create PeerConnection
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        streamRef.current = stream;
        if (!audioRef.current) {
          audioRef.current = new Audio();
          audioRef.current.autoplay = true;
        }
        audioRef.current.srcObject = stream;
        audioRef.current.volume = volume;
        audioRef.current.muted = muted;
        audioRef.current.play().catch(() => {});
        setPlaying(true);
        setStatus('live');
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      };

      pc.onicecandidate = (e) => {
        if (!e.candidate || !callIdRef.current) return;
        fetch(`${RADIO_API}/calls/${callIdRef.current}/signals`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ signal_type: 'ice', payload: e.candidate }),
        }).catch(() => {});
      };

      // Get mic stream if enabled
      if (micEnabled && selectedMic) {
        try {
          const s = await navigator.mediaDevices.getUserMedia({
            audio: selectedMic ? { deviceId: selectedMic } : true,
          });
          streamRef.current = s;
          s.getAudioTracks().forEach(t => pc.addTrack(t, s));
        } catch { /* mic optional */ }
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      // Poll for offers
      const pollSignals = async () => {
        if (!callIdRef.current) return;
        try {
          const r = await fetch(`${RADIO_API}/calls/${callIdRef.current}/signals?after_id=${lastSigRef.current}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const body = await r.json();
          const sigs: any[] = body.data ?? [];
          for (const sig of sigs) {
            lastSigRef.current = sig.id;
            if (sig.signal_type === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload)));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await fetch(`${RADIO_API}/calls/${callIdRef.current}/signals`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ to_user_id: sig.from_user_id, signal_type: 'answer', payload: answer }),
              });
            } else if (sig.signal_type === 'ice') {
              try { await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(sig.payload))); } catch { /* skip */ }
            }
          }
        } catch { /* silent */ }
      };

      pollRef.current = setInterval(pollSignals, 1500);
      // If no offer in 8s, show "waiting"
      setTimeout(() => {
        if (status === 'connecting') setStatus('idle');
      }, 8000);

    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [token, micEnabled, selectedMic, volume, muted]);

  const togglePlay = useCallback(() => {
    if (playing || status === 'connecting' || status === 'live') {
      stopAudio();
    } else {
      startAudio();
    }
  }, [playing, status, startAudio, stopAudio]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (audioRef.current) audioRef.current.muted = !m;
      return !m;
    });
  }, []);

  const toggleMic = useCallback(async () => {
    if (!micEnabled) {
      await navigator.mediaDevices?.getUserMedia({ audio: true }).then(s => {
        s.getTracks().forEach(t => t.stop());
        navigator.mediaDevices.enumerateDevices().then(devs => {
          setMicDevices(devs.filter(d => d.kind === 'audioinput'));
        });
      }).catch(() => {});
    }
    setMicEnabled(m => !m);
  }, [micEnabled]);

  return {
    playing, status, volume, setVolume,
    muted, toggleMute,
    micEnabled, toggleMic,
    micDevices, selectedMic, setSelectedMic,
    togglePlay,
  };
}

// ── Components ─────────────────────────────────────────────────────────────

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

// ── Player block ────────────────────────────────────────────────────────────
function PlayerBlock({
  audio, L, onlineCount,
}: {
  audio: ReturnType<typeof useRadioAudio>;
  L: Record<string, string>;
  onlineCount: number;
}) {
  const [showMicSettings, setShowMicSettings] = useState(false);

  const statusLabel = audio.status === 'connecting' ? L.connecting
    : audio.status === 'live' ? L.live
    : audio.status === 'error' ? L.errAudio
    : L.offline;

  return (
    <div className="border-b border-primary">
      {/* Station heading */}
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-4 border-b border-primary/20">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-1">AM Publishing</p>
        <h2 className="font-serif text-2xl md:text-3xl leading-tight">Radio</h2>
        <p className="font-mono text-[10px] text-primary/40 mt-1">{statusLabel}</p>
      </div>

      {/* Play control */}
      <div className="px-6 md:px-8 py-5 flex items-center gap-4 border-b border-primary/20">
        <button
          onClick={audio.togglePlay}
          className={`w-12 h-12 flex items-center justify-center border border-primary transition-colors duration-200 flex-shrink-0 ${
            audio.playing || audio.status === 'connecting'
              ? 'bg-primary text-white'
              : 'bg-transparent hover:bg-primary hover:text-white'
          }`}
          title={audio.playing ? L.stop : L.play}
        >
          {audio.status === 'connecting' ? (
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          ) : audio.playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8 5.5l12 6.5-12 6.5V5.5Z"/></svg>
          )}
        </button>

        {/* Volume */}
        <div className="flex-1 flex items-center gap-3">
          <button onClick={audio.toggleMute} className="text-primary/50 hover:text-primary transition-colors flex-shrink-0">
            {audio.muted ? (
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M19 9l-6 6M13 9l6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            )}
          </button>
          <input
            type="range" min="0" max="1" step="0.05"
            value={audio.muted ? 0 : audio.volume}
            onChange={e => { audio.setVolume(Number(e.target.value)); if (audio.muted && Number(e.target.value) > 0) audio.toggleMute(); }}
            className="flex-1 h-px appearance-none bg-primary/20 accent-primary cursor-pointer"
          />
        </div>
      </div>

      {/* Mic settings */}
      <div className="px-6 md:px-8 py-4">
        <button
          onClick={() => setShowMicSettings(s => !s)}
          className="flex items-center gap-2 text-primary/50 hover:text-primary transition-colors w-full"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 flex-shrink-0"><path d="M9 4.5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0v-6Z" stroke="currentColor" strokeWidth="1.8"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span className="font-mono text-[9px] uppercase tracking-widest">{L.micSettings}</span>
          <svg viewBox="0 0 24 24" fill="none" className={`w-3 h-3 ml-auto transition-transform ${showMicSettings ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
        </button>

        {showMicSettings && (
          <div className="mt-3 space-y-3">
            {/* Mic toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={audio.toggleMic}
                className={`w-8 h-4 relative transition-colors duration-200 flex-shrink-0 ${audio.micEnabled ? 'bg-primary' : 'bg-primary/20'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 bg-white transition-transform duration-200 ${audio.micEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60">{L.micOn}</span>
            </label>

            {/* Device selector */}
            {audio.micEnabled && audio.micDevices.length > 0 && (
              <select
                value={audio.selectedMic}
                onChange={e => audio.setSelectedMic(e.target.value)}
                className="w-full bg-transparent border border-primary/30 px-3 py-2 font-mono text-[10px] outline-none hover:border-primary transition-colors"
              >
                <option value="">{L.defaultMic}</option>
                {audio.micDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>
                ))}
              </select>
            )}

            <p className="font-mono text-[9px] text-primary/30 leading-relaxed">{L.micHint}</p>
          </div>
        )}
      </div>

      {/* Online count */}
      {onlineCount > 0 && (
        <div className="px-6 md:px-8 py-3 border-t border-primary/20">
          <LiveDot count={onlineCount} />
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
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

  const audio = useRadioAudio(user ? localStorage.getItem('ampub_radio_token') : null);

  const labels = {
    ru: {
      kicker: 'AM Publishing Radio',
      chat: 'Чат',
      placeholder: 'Написать в чат…',
      send: 'Отправить',
      you: 'Вы',
      listeners: 'в эфире',
      loading: 'Загрузка…',
      errorConn: 'Не удалось подключиться к радио',
      play: 'Слушать',
      stop: 'Стоп',
      connecting: 'Подключение…',
      live: 'В эфире',
      offline: 'Эфир не идёт',
      errAudio: 'Ошибка подключения',
      micSettings: 'Настройки микрофона',
      micOn: 'Включить микрофон',
      defaultMic: 'Микрофон по умолчанию',
      micHint: 'Микрофон используется при совместном вещании. Перезапустите эфир после изменений.',
      tuneIn: 'Слушать эфир →',
    },
    en: {
      kicker: 'AM Publishing Radio',
      chat: 'Chat',
      placeholder: 'Write to chat…',
      send: 'Send',
      you: 'You',
      listeners: 'online',
      loading: 'Loading…',
      errorConn: 'Could not connect to radio',
      play: 'Listen',
      stop: 'Stop',
      connecting: 'Connecting…',
      live: 'On air',
      offline: 'Off air',
      errAudio: 'Connection error',
      micSettings: 'Microphone settings',
      micOn: 'Enable microphone',
      defaultMic: 'Default microphone',
      micHint: 'Microphone is used for co-broadcasting. Restart the stream after changes.',
      tuneIn: 'Tune in →',
    },
    de: {
      kicker: 'AM Publishing Radio',
      chat: 'Chat',
      placeholder: 'In den Chat schreiben…',
      send: 'Senden',
      you: 'Sie',
      listeners: 'online',
      loading: 'Laden…',
      errorConn: 'Verbindung zum Radio fehlgeschlagen',
      play: 'Zuhören',
      stop: 'Stopp',
      connecting: 'Verbinden…',
      live: 'Live',
      offline: 'Nicht live',
      errAudio: 'Verbindungsfehler',
      micSettings: 'Mikrofoneinstellungen',
      micOn: 'Mikrofon aktivieren',
      defaultMic: 'Standardmikrofon',
      micHint: 'Das Mikrofon wird bei gemeinsamen Sendungen verwendet. Starten Sie den Stream nach Änderungen neu.',
      tuneIn: 'Reinhören →',
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
          <div className="flex-1 p-6 md:p-10 border-r border-primary flex flex-col justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-accent" />
              {L.kicker}
            </p>
            <div>
              <h1 className="font-serif text-5xl md:text-7xl leading-none mt-4">AM Publishing Radio</h1>
            </div>
          </div>
          <button
            onClick={audio.togglePlay}
            className={`w-[160px] md:w-[220px] flex flex-col items-center justify-center gap-3 transition-colors duration-300 cursor-pointer group ${
              audio.playing ? 'bg-accent text-primary' : 'bg-primary text-white hover:bg-accent hover:text-primary'
            }`}
          >
            {audio.status === 'connecting' ? (
              <span className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : audio.playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
            ) : (
              <svg viewBox="0 0 48 32" className="w-10 h-7 opacity-60 group-hover:opacity-100 transition-opacity" fill="currentColor">
                <rect x="0"  y="10" width="4" height="12" /><rect x="7"  y="4"  width="4" height="24" />
                <rect x="14" y="0"  width="4" height="32" /><rect x="21" y="6"  width="4" height="20" />
                <rect x="28" y="2"  width="4" height="28" /><rect x="35" y="8"  width="4" height="16" />
                <rect x="42" y="12" width="4" height="8"  />
              </svg>
            )}
            <span className="font-mono text-[10px] uppercase tracking-widest text-center px-2">
              {audio.status === 'connecting' ? L.connecting : audio.playing ? L.stop : L.tuneIn}
            </span>
          </button>
        </div>
      </div>

      {/* ── MAIN GRID ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-[calc(100vh-160px)]">

        {/* ── CHAT ─────────────────────────────────────────────────── */}
        <div className="flex flex-col border-r border-primary">
          <div className="flex items-center justify-between px-6 py-3 border-b border-primary">
            <span className="font-mono text-[10px] uppercase tracking-widest">{L.chat}</span>
            {online.length > 0 && <LiveDot count={online.length} />}
          </div>

          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-0.5" style={{ maxHeight: 'calc(100vh - 340px)' }}>
            {loading && <p className="font-mono text-xs text-primary/40 text-center py-12">{L.loading}</p>}
            {!loading && error && <p className="font-mono text-xs text-red-600 text-center py-12">{error}</p>}
            {!loading && !error && messages.length === 0 && <p className="font-mono text-xs text-primary/30 text-center py-12">—</p>}
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
                    <p className="text-sm leading-relaxed break-words"><MsgContent text={msg.text} /></p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-primary flex items-stretch">
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
          <PlayerBlock audio={audio} L={L} onlineCount={online.length} />

          {/* Online list */}
          <div className="p-6 md:p-8 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-4">{L.listeners}</p>
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
