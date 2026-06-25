import React, {
  useEffect, useRef, useState, useCallback, type FormEvent,
} from 'react';
import { useApp } from '../AppContext';
import {
  radioGuestJoin, fetchRadioMessages, fetchPinnedMessages,
  pollRadioMessages, sendRadioMessage, pinRadioMessage,
  fetchRadioOnline, getRadioUser, getToken,
  renameMe, editRadioMessage, deleteRadioMessage, reactRadioMessage,
  sendRadioTyping, RADIO_COLORS,
  type RadioMessage, type RadioUser,
} from '../services/radioApi';
import { RadioAdminPanel } from './RadioAdminPanel';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '🎉', '😮'];

const RADIO_API = 'https://radio-api.helpushelpua.com/api';
const POLL_MS = 3000;
const TENOR_KEY = 'LIVDSRZULELA';

const MEDIA_RE = /^https?:\/\/\S+\.(gif|jpg|jpeg|png|webp)(\?.*)?$/i;
const TENOR_RE = /^https?:\/\/media\.tenor\.com\//i;
const URL_RE = /(https?:\/\/[^\s]+)/g;

type MsgType = 'chat' | 'announcement' | 'podcast';

// ── Emoji data ──────────────────────────────────────────────────────────────
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: '😊', emojis: ['😀','😂','🥲','😍','🥰','😎','🤔','😢','😡','🤯','🥳','😴','🤩','😏','🙄','😤'] },
  { label: '👍', emojis: ['👍','👎','❤️','🔥','✨','💯','👏','🙏','💪','🤝','✌️','🫶','💀','🎉','🎊','⭐'] },
  { label: '📚', emojis: ['📚','📖','✍️','🖊️','📝','🎧','🎵','🎶','📻','🎙️','🗞️','📰','💬','📢','🔔','🏆'] },
];

// ── Types ────────────────────────────────────────────────────────────────────
type AudioStats = {
  rttMs: number | null;
  jitterMs: number | null;
  packetsLost: number | null;
  bitrateBps: number | null;
  iceState: RTCIceConnectionState | null;
  micLevel: number; // 0-1
};

// ── useRadioAudio ───────────────────────────────────────────────────────────
function useRadioAudio(token: string | null) {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micGranted, setMicGranted] = useState<boolean | null>(null); // null=unknown, true=granted, false=denied
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [status, setStatus] = useState<'idle'|'connecting'|'waiting'|'live'|'error'>('idle');
  const [stats, setStats] = useState<AudioStats>({ rttMs: null, jitterMs: null, packetsLost: null, bitrateBps: null, iceState: null, micLevel: 0 });
  const statusRef = useRef<typeof status>('idle');
  const setStatusSafe = useCallback((s: typeof status) => { statusRef.current = s; setStatus(s); }, []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSigRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const prevBytesRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Auto-request mic on mount
  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ audio: true })
      .then(s => {
        setMicGranted(true);
        setMicEnabled(true);
        navigator.mediaDevices.enumerateDevices().then(d => {
          setMicDevices(d.filter(x => x.kind === 'audioinput'));
          if (d.find(x => x.kind === 'audioinput' && x.deviceId === 'default')) setSelectedMic('default');
        });
        // Keep stream for later use, stop if not needed immediately
        micStreamRef.current = s;
      })
      .catch(() => setMicGranted(false));
  }, []);

  // Persistent audio element attached to DOM — required for reliable
  // background / lock-screen playback on mobile (esp. iOS Safari).
  const ensureAudioEl = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const el = new Audio();
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.autoplay = true;
    el.preload = 'auto';
    (el as any).disableRemotePlayback = false;
    el.style.display = 'none';
    document.body.appendChild(el);
    audioRef.current = el;
    return el;
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const artwork = ['256x256', '384x384', '512x512'].map(sizes => ({
      src: 'https://ampublishing.org/images/ambook-cover.jpg',
      sizes, type: 'image/jpeg',
    }));
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'AM Publishing Radio',
        artist: 'AM Publishing Berlin',
        album: 'Прямой эфир',
        artwork,
      });
    } catch { /* MediaMetadata may be unavailable */ }
    navigator.mediaSession.setActionHandler('play', () => { ensureAudioEl().play().catch(() => {}); setPlaying(true); navigator.mediaSession.playbackState = 'playing'; });
    navigator.mediaSession.setActionHandler('pause', () => { audioRef.current?.pause(); setPlaying(false); navigator.mediaSession.playbackState = 'paused'; });
    try { navigator.mediaSession.setActionHandler('stop', () => { audioRef.current?.pause(); setPlaying(false); }); } catch { /* not supported */ }
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
    };
  }, [ensureAudioEl]);

  const stopStats = useCallback(() => {
    if (statsRef.current) { clearInterval(statsRef.current); statsRef.current = null; }
  }, []);

  const startStats = useCallback((pc: RTCPeerConnection) => {
    stopStats();
    statsRef.current = setInterval(async () => {
      if (!pc || pc.signalingState === 'closed') return;
      try {
        const reports = await pc.getStats();
        let rtt: number | null = null, jitter: number | null = null, lost: number | null = null, bytes = 0;
        reports.forEach((r: any) => {
          if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
            if (r.roundTripTime != null) rtt = Math.round(r.roundTripTime * 1000);
            if (r.jitter != null) jitter = Math.round(r.jitter * 1000);
            if (r.packetsLost != null) lost = r.packetsLost;
          }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') {
            bytes = r.bytesReceived ?? 0;
          }
        });
        const bitrate = prevBytesRef.current ? Math.round((bytes - prevBytesRef.current) * 8 / 2) : null;
        prevBytesRef.current = bytes;
        setStats(s => ({ ...s, rttMs: rtt, jitterMs: jitter, packetsLost: lost, bitrateBps: bitrate, iceState: pc.iceConnectionState }));
      } catch { }
    }, 2000);
  }, [stopStats]);

  // Mic level analyser
  useEffect(() => {
    if (!micEnabled || !micStreamRef.current) { setStats(s => ({ ...s, micLevel: 0 })); return; }
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(micStreamRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += Math.abs(buf[i] - 128);
        setStats(s => ({ ...s, micLevel: Math.min(1, (sum / buf.length) / 40) }));
      }, 100);
      return () => { clearInterval(tick); ctx.close(); };
    } catch { return undefined; }
  }, [micEnabled]);

  const stopAudio = useCallback(() => {
    stopStats();
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioRef.current) audioRef.current.srcObject = null;
    if (callIdRef.current) {
      const t = getToken();
      if (t) fetch(`${RADIO_API}/calls/${callIdRef.current}/leave`, { method: 'PUT', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } }).catch(() => {});
      callIdRef.current = null;
    }
    prevBytesRef.current = 0;
    setPlaying(false); setStatusSafe('idle');
    setStats(s => ({ ...s, rttMs: null, jitterMs: null, packetsLost: null, bitrateBps: null, iceState: null }));
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }, [setStatusSafe, stopStats]);

  const startAudio = useCallback(async () => {
    if (!token) return;
    setStatusSafe('connecting');
    try {
      const joinRes = await fetch(`${RADIO_API}/calls/join`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
      const jb = await joinRes.json();
      const { call_id, latest_signal_id } = jb.data;
      callIdRef.current = call_id; lastSigRef.current = latest_signal_id ?? 0;
      const cfgRes = await fetch(`${RADIO_API}/calls/config`, { headers: { Authorization: `Bearer ${token}` } });
      const cfgB = await cfgRes.json();
      const iceServers = cfgB.data?.ice_servers ?? [{ urls: 'stun:stun.l.google.com:19302' }];
      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        setStats(s => ({ ...s, iceState: pc.iceConnectionState }));
      };

      pc.ontrack = (e) => {
        const stream = e.streams[0] ?? new MediaStream([e.track]);
        streamRef.current = stream;
        const el = ensureAudioEl();
        el.srcObject = stream; el.volume = volume; el.muted = muted;
        el.play().catch(() => {});
        setPlaying(true); setStatusSafe('live');
        startStats(pc);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      };
      pc.onicecandidate = (e) => {
        if (!e.candidate || !callIdRef.current) return;
        fetch(`${RADIO_API}/calls/${callIdRef.current}/signals`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ signal_type: 'ice', payload: e.candidate }) }).catch(() => {});
      };

      // Add mic if enabled and stream available
      const micStream = micEnabled ? (micStreamRef.current ?? await navigator.mediaDevices.getUserMedia({ audio: selectedMic ? { deviceId: selectedMic } : true }).catch(() => null)) : null;
      if (micStream) {
        micStreamRef.current = micStream;
        micStream.getAudioTracks().forEach(t => pc.addTrack(t, micStream));
      } else {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      setTimeout(() => { if (statusRef.current === 'connecting') setStatusSafe('waiting'); }, 5000);

      pollRef.current = setInterval(async () => {
        if (!callIdRef.current) return;
        try {
          const r = await fetch(`${RADIO_API}/calls/${callIdRef.current}/signals?after_id=${lastSigRef.current}`, { headers: { Authorization: `Bearer ${token}` } });
          const b = await r.json();
          for (const sig of (b.data ?? [])) {
            lastSigRef.current = sig.id;
            if (sig.signal_type === 'offer') {
              if (statusRef.current === 'waiting') setStatusSafe('connecting');
              await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(sig.payload)));
              const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
              await fetch(`${RADIO_API}/calls/${callIdRef.current}/signals`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ to_user_id: sig.from_user_id, signal_type: 'answer', payload: ans }) });
            } else if (sig.signal_type === 'ice') {
              try { await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(sig.payload))); } catch { }
            }
          }
        } catch { }
      }, 1500);
    } catch { setStatusSafe('error'); setTimeout(() => setStatusSafe('idle'), 3000); }
  }, [token, micEnabled, selectedMic, volume, muted, setStatusSafe, startStats, ensureAudioEl]);

  const togglePlay = useCallback(() => {
    if (playing || status === 'connecting' || status === 'waiting' || status === 'live') stopAudio(); else startAudio();
  }, [playing, status, startAudio, stopAudio]);

  const setVolume = useCallback((v: number) => { setVolumeState(v); if (audioRef.current) audioRef.current.volume = v; }, []);
  const toggleMute = useCallback(() => { setMuted(m => { if (audioRef.current) audioRef.current.muted = !m; return !m; }); }, []);

  const requestMic = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: selectedMic ? { deviceId: selectedMic } : true });
      micStreamRef.current = s;
      setMicGranted(true);
      setMicEnabled(true);
      const devs = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(devs.filter(d => d.kind === 'audioinput'));
    } catch { setMicGranted(false); }
  }, [selectedMic]);

  return { playing, status, stats, volume, setVolume, muted, toggleMute, micEnabled, setMicEnabled, micGranted, requestMic, micDevices, selectedMic, setSelectedMic, togglePlay };
}

// ── GIF picker ──────────────────────────────────────────────────────────────
type GifResult = { id: string; url: string; preview: string };

async function fetchTenor(endpoint: string): Promise<GifResult[]> {
  const res = await fetch(`https://api.tenor.com/v1/${endpoint}&key=${TENOR_KEY}&limit=16&media_filter=minimal`);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results ?? []).map((r: any) => {
    const m = r.media?.[0] ?? {};
    return { id: r.id, url: m.tinygif?.url ?? m.gif?.url ?? '', preview: m.nanogif?.url ?? m.tinygif?.url ?? '' };
  }).filter((r: GifResult) => r.url);
}

function GifPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchTenor('trending?').then(setGifs).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setLoading(true); fetchTenor('trending?').then(setGifs).finally(() => setLoading(false)); return; }
    timerRef.current = setTimeout(() => { setLoading(true); fetchTenor(`search?q=${encodeURIComponent(query.trim())}`).then(setGifs).finally(() => setLoading(false)); }, 420);
  }, [query]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="absolute bottom-full left-0 right-0 bg-bg border border-primary shadow-lg z-50 flex flex-col" style={{ maxHeight: '55dvh' }}>
      <div className="flex items-center gap-2 p-2 border-b border-primary">
        <input
          className="flex-1 bg-transparent border border-primary/30 px-3 py-1.5 text-sm outline-none font-sans placeholder:text-primary/30 focus:border-primary"
          placeholder="Пошук GIF…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
        />
        <span className="font-mono text-[8px] uppercase tracking-widest text-primary/30">Tenor</span>
        <button onClick={onClose} className="text-primary/40 hover:text-primary px-1">✕</button>
      </div>
      <div className="overflow-y-auto p-1 grid grid-cols-3 gap-1">
        {loading && <div className="col-span-3 text-center py-8 font-mono text-xs text-primary/30">…</div>}
        {!loading && gifs.map(g => (
          <button key={g.id} type="button" onClick={() => { onPick(g.url); onClose(); }}
            className="aspect-video overflow-hidden border border-primary/10 hover:border-primary transition-colors">
            <img src={g.preview} alt="" loading="lazy" className="w-full h-full object-cover" />
          </button>
        ))}
        {!loading && gifs.length === 0 && <div className="col-span-3 text-center py-8 font-mono text-xs text-primary/30">—</div>}
      </div>
    </div>
  );
}

// ── Emoji picker ─────────────────────────────────────────────────────────────
function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState(0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="absolute bottom-full left-0 bg-bg border border-primary shadow-lg z-50" style={{ width: 280 }}>
      <div className="flex border-b border-primary">
        {EMOJI_GROUPS.map((g, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`flex-1 py-2 text-lg transition-colors ${tab === i ? 'bg-primary text-white' : 'hover:bg-primary/5'}`}>
            {g.label}
          </button>
        ))}
        <button onClick={onClose} className="px-3 text-primary/40 hover:text-primary border-l border-primary">✕</button>
      </div>
      <div className="grid grid-cols-8 gap-0 p-2">
        {EMOJI_GROUPS[tab].emojis.map(e => (
          <button key={e} type="button" onClick={() => { onPick(e); onClose(); }}
            className="text-xl py-1.5 hover:bg-primary/10 transition-colors">
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Message bubble ──────────────────────────────────────────────────────────
function MsgContent({ text }: { text: string }) {
  if (!text) return null;
  const t = text.trim();
  if (MEDIA_RE.test(t) || TENOR_RE.test(t)) {
    return <img src={t} alt="" className="mt-1 max-w-[240px] max-h-[160px] object-contain border border-line" loading="lazy"
      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />;
  }
  const parts = text.split(URL_RE);
  return <>{parts.map((p, i) => URL_RE.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-accent">{p}</a> : p)}</>;
}

function AnnouncementCard({ msg, onPin }: { msg: RadioMessage; onPin: (id: number) => void }) {
  const isPodcast = msg.msg_type === 'podcast';
  return (
    <article className="group bg-bg border border-primary/12 hover:border-primary/30 transition-colors relative overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${isPodcast ? 'bg-accent' : 'bg-primary'}`} />
      {msg.meta_image && (
        <img src={msg.meta_image} alt="" className="w-full h-36 object-cover" loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      )}
      <div className="p-4 pl-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-primary/40 flex items-center gap-1.5">
            <span className={isPodcast ? 'text-accent' : 'text-primary'}>{isPodcast ? '🎙' : '📢'}</span>
            {isPodcast ? 'Подкаст' : 'Анонс'}
          </p>
          {msg.is_pinned && <span className="font-mono text-[8px] text-accent">📌</span>}
        </div>
        {msg.meta_title && <h3 className="font-serif text-lg leading-snug mb-1.5">{msg.meta_title}</h3>}
        {msg.text && <p className="text-[13px] text-primary/70 leading-relaxed mb-2 break-words"><MsgContent text={msg.text} /></p>}
        {msg.meta_description && <p className="text-xs text-primary/45 leading-relaxed mb-3">{msg.meta_description}</p>}
        {msg.meta_url && (
          <a href={msg.meta_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest border border-primary/30 px-3 py-1.5 hover:bg-primary hover:text-white hover:border-primary transition-colors">
            {isPodcast ? 'Слушать →' : 'Подробнее →'}
          </a>
        )}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-primary/8">
          <span className="font-mono text-[9px] text-primary/30">{msg.nickname}</span>
          <button onClick={() => onPin(msg.id)} className="font-mono text-[8px] uppercase tracking-widest text-primary/30 hover:text-accent transition-colors opacity-0 group-hover:opacity-100">
            {msg.is_pinned ? 'Открепить' : 'Закрепить'}
          </button>
        </div>
      </div>
    </article>
  );
}

// ── Empty state for the right panel ──────────────────────────────────────────
function EmptyPanel({ tab, L }: { tab: 'ann' | 'pod' | 'pin'; L: Record<string, string> }) {
  const cfg = {
    ann: { icon: '📢', title: L.emptyAnnTitle, body: L.emptyAnnBody },
    pod: { icon: '🎙', title: L.emptyPodTitle, body: L.emptyPodBody },
    pin: { icon: '📌', title: L.emptyPinTitle, body: L.emptyPinBody },
  }[tab];
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
      <div className="w-14 h-14 flex items-center justify-center border border-primary/15 text-2xl mb-5 bg-bg">
        {cfg.icon}
      </div>
      <p className="font-serif text-lg leading-tight mb-2">{cfg.title}</p>
      <p className="text-xs text-primary/45 leading-relaxed max-w-[230px] mb-6">{cfg.body}</p>
      <div className="w-full max-w-[230px] space-y-px">
        {[L.emptyHint1, L.emptyHint2, L.emptyHint3].map((h, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2 border-t border-primary/8 text-left">
            <span className="font-mono text-[9px] text-accent w-4 flex-shrink-0">0{i + 1}</span>
            <span className="font-mono text-[10px] text-primary/40 leading-snug">{h}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Avatar({ nickname, color }: { nickname: string; color: string }) {
  return (
    <div className="w-8 h-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-white flex-shrink-0"
      style={{ backgroundColor: color || '#040F1E' }}>
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
      <span className="font-mono text-[10px] uppercase tracking-widest text-accent">{count} online</span>
    </div>
  );
}

// ── Stat row ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-primary/8 last:border-0">
      <span className="font-mono text-[9px] uppercase tracking-widest text-primary/40">{label}</span>
      <span className={`font-mono text-[10px] ${accent ? 'text-accent' : 'text-primary/70'}`}>{value}</span>
    </div>
  );
}

// ── Player sidebar block ─────────────────────────────────────────────────────
function PlayerBlock({ audio, L }: { audio: ReturnType<typeof useRadioAudio>; L: Record<string, string> }) {
  const [statsOpen, setStatsOpen] = useState(false);

  const statusLabel = audio.status === 'connecting' ? L.connecting
    : audio.status === 'waiting' ? L.waiting
    : audio.status === 'live' ? L.live
    : audio.status === 'error' ? L.errAudio
    : L.offline;

  const { stats } = audio;
  const iceLabel = stats.iceState === 'connected' ? '✓ Connected'
    : stats.iceState === 'checking' ? '… Checking'
    : stats.iceState === 'failed' ? '✕ Failed'
    : stats.iceState === 'disconnected' ? '⚠ Disconnected'
    : stats.iceState ?? '—';
  const bitrateLabel = stats.bitrateBps != null ? `${Math.round(stats.bitrateBps / 1000)} kbps` : '—';
  const rttLabel = stats.rttMs != null ? `${stats.rttMs} ms` : '—';
  const jitterLabel = stats.jitterMs != null ? `${stats.jitterMs} ms` : '—';
  const lostLabel = stats.packetsLost != null ? String(stats.packetsLost) : '—';

  return (
    <div>
      {/* Status + volume */}
      <div className="px-4 py-4 border-b border-primary/20">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-0.5">AM Publishing</p>
        <p className="font-mono text-[10px] text-primary/40 mb-3">{statusLabel}</p>
        <div className="flex items-center gap-2.5">
          <button onClick={audio.toggleMute} className="text-primary/40 hover:text-primary transition-colors flex-shrink-0">
            {audio.muted
              ? <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M19 9l-6 6M13 9l6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
          </button>
          <input type="range" min="0" max="1" step="0.05" value={audio.muted ? 0 : audio.volume}
            onChange={e => { audio.setVolume(Number(e.target.value)); if (audio.muted && Number(e.target.value) > 0) audio.toggleMute(); }}
            className="flex-1 h-px appearance-none bg-primary/20 accent-primary cursor-pointer" />
          <span className="font-mono text-[9px] text-primary/30 w-7 text-right">{Math.round(audio.volume * 100)}%</span>
        </div>
      </div>

      {/* Mic — compact */}
      <div className="px-4 py-3 border-b border-primary/20">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50">{L.micSettings}</span>
          <label className="flex items-center gap-2 cursor-pointer"
            onClick={() => audio.micGranted === false ? audio.requestMic() : audio.setMicEnabled(m => !m)}>
            <div className={`w-7 h-3.5 relative transition-colors flex-shrink-0 ${audio.micEnabled && audio.micGranted ? 'bg-primary' : 'bg-primary/20'}`}>
              <span className={`absolute top-0.5 w-2.5 h-2.5 bg-white transition-transform ${audio.micEnabled && audio.micGranted ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </div>
          </label>
        </div>
        <div className="h-1 bg-primary/10 w-full overflow-hidden">
          <div className="h-full bg-primary/50 transition-all duration-100" style={{ width: `${Math.round(audio.stats.micLevel * 100)}%` }} />
        </div>
        {audio.micGranted && audio.micDevices.length > 0 && (
          <select value={audio.selectedMic} onChange={e => audio.setSelectedMic(e.target.value)}
            className="w-full bg-transparent border border-primary/20 px-2 py-1 font-mono text-[8px] outline-none hover:border-primary transition-colors mt-2">
            <option value="">{L.defaultMic}</option>
            {audio.micDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>
            ))}
          </select>
        )}
        {audio.micGranted === false && (
          <button onClick={audio.requestMic} className="font-mono text-[8px] uppercase tracking-widest text-accent hover:underline mt-1 block">{L.micGrant}</button>
        )}
      </div>

      {/* Stats — collapsible */}
      <div className="border-b border-primary/20">
        <button onClick={() => setStatsOpen(s => !s)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-primary/5 transition-colors">
          <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary/40">{L.statsTitle}</span>
          <svg viewBox="0 0 24 24" fill="none" className={`w-3 h-3 text-primary/30 transition-transform ${statsOpen ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {statsOpen && (
          <div className="px-4 pb-3">
            <StatRow label="ICE" value={iceLabel} accent={stats.iceState === 'connected'} />
            <StatRow label={L.statsBitrate} value={bitrateLabel} accent={!!stats.bitrateBps} />
            <StatRow label={L.statsRtt} value={rttLabel} accent={stats.rttMs != null && stats.rttMs < 100} />
            <StatRow label={L.statsJitter} value={jitterLabel} />
            <StatRow label={L.statsLost} value={lostLabel} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Composer (chat only — announcements live in the admin panel) ──────────────
function Composer({ onSend, onTyping, disabled, L, replyTo, onCancelReply }: {
  onSend: (payload: { text: string; msg_type: MsgType; reply_to_id?: number | null }) => Promise<void>;
  onTyping: () => void;
  disabled: boolean;
  L: Record<string, string>;
  replyTo: RadioMessage | null;
  onCancelReply: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingThrottleRef = useRef(0);

  // Focus textarea when a reply is set
  useEffect(() => { if (replyTo) textareaRef.current?.focus(); }, [replyTo]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onSend({ text: text.trim(), msg_type: 'chat', reply_to_id: replyTo ? replyTo.id : null });
      setText('');
      onCancelReply();
    } finally { setSending(false); }
  };

  const onChangeText = (v: string) => {
    setText(v);
    const now = Date.now();
    if (now - typingThrottleRef.current > 2500) { typingThrottleRef.current = now; onTyping(); }
  };

  const insertEmoji = (e: string) => {
    const el = textareaRef.current;
    if (!el) { setText(t => t + e); return; }
    const s = el.selectionStart, end = el.selectionEnd;
    setText(text.slice(0, s) + e + text.slice(end));
    setTimeout(() => { el.selectionStart = el.selectionEnd = s + e.length; el.focus(); }, 0);
  };

  return (
    <div className="border-t border-primary relative flex-shrink-0 bg-bg">
      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-primary/10 bg-primary/[0.03]">
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-accent flex-shrink-0"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 5 5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[8px] uppercase tracking-widest text-primary/40">{L.replyingTo} </span>
            <span className="text-[11px] font-bold" style={{ color: replyTo.color }}>{replyTo.nickname}</span>
            <span className="text-[11px] text-primary/40 truncate"> · {replyTo.text.slice(0, 60)}</span>
          </div>
          <button onClick={onCancelReply} className="text-primary/40 hover:text-primary flex-shrink-0">✕</button>
        </div>
      )}

      {/* Pickers */}
      {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
      {showGif && <GifPicker onPick={url => { setText(url); setShowEmoji(false); }} onClose={() => setShowGif(false)} />}

      {/* Main input row */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 p-3 md:p-4">
        <div className="flex items-center gap-0.5 self-stretch">
          <button type="button" onClick={() => { setShowEmoji(s => !s); setShowGif(false); }}
            className={`w-9 h-9 flex items-center justify-center text-lg rounded-sm transition-colors ${showEmoji ? 'bg-accent/15 text-accent' : 'text-primary/30 hover:text-primary hover:bg-primary/5'}`}>😊</button>
          <button type="button" onClick={() => { setShowGif(s => !s); setShowEmoji(false); }}
            className={`w-9 h-9 flex items-center justify-center font-mono text-[9px] font-bold uppercase tracking-widest rounded-sm transition-colors ${showGif ? 'bg-accent/15 text-accent' : 'text-primary/30 hover:text-primary hover:bg-primary/5'}`}>GIF</button>
        </div>

        <textarea ref={textareaRef} value={text} onChange={e => onChangeText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } if (e.key === 'Escape' && replyTo) onCancelReply(); }}
          placeholder={L.placeholder}
          rows={1}
          className="flex-1 resize-none bg-primary/[0.04] border border-primary/15 focus:border-primary/40 rounded-sm px-4 py-2.5 text-[15px] leading-snug outline-none placeholder:text-primary/30 font-sans transition-colors max-h-32"
          disabled={disabled || sending} maxLength={2000} />

        <button type="submit" disabled={!text.trim() || sending || disabled}
          className="h-11 w-11 flex-shrink-0 flex items-center justify-center bg-primary text-white rounded-sm hover:bg-accent hover:text-primary transition-colors duration-200 disabled:opacity-25 disabled:cursor-default"
          title={L.send}>
          {sending
            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M4 12l16-8-6 16-3-6-7-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </button>
      </form>
    </div>
  );
}

// ── Name / color editor ──────────────────────────────────────────────────────
function NameEditModal({ user, onSave, onClose, L }: {
  user: RadioUser;
  onSave: (nickname: string, color: string) => Promise<void>;
  onClose: () => void;
  L: Record<string, string>;
}) {
  const [name, setName] = useState(user.nickname);
  const [color, setColor] = useState(user.color);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 24) { setErr(L.nameRule); return; }
    setSaving(true); setErr('');
    try { await onSave(trimmed, color); onClose(); }
    catch (e: any) { setErr(e.message || L.nameRule); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-primary/60 backdrop-blur-sm px-4" onMouseDown={onClose}>
      <div className="bg-bg border border-primary w-full max-w-sm shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-primary">
          <span className="font-mono text-[10px] uppercase tracking-widest">{L.editName}</span>
          <button onClick={onClose} className="text-primary/40 hover:text-primary text-lg leading-none">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-white flex-shrink-0" style={{ backgroundColor: color }}>
              {(name || '··').slice(0, 2)}
            </div>
            <span className="font-bold text-sm" style={{ color }}>{name || '—'}</span>
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-primary/40 mb-1.5 block">{L.nickname}</span>
            <input value={name} onChange={e => setName(e.target.value)} autoFocus maxLength={24}
              className="w-full bg-transparent border border-primary/30 px-3 py-2.5 text-sm outline-none focus:border-primary font-sans" />
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase tracking-widest text-primary/40 mb-2 block">{L.color}</span>
            <div className="flex flex-wrap gap-2">
              {RADIO_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-offset-bg ring-primary scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} aria-label={c} />
              ))}
            </div>
          </div>
          {err && <p className="font-mono text-[10px] text-red-500">{err}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-primary text-white font-mono text-[10px] uppercase tracking-widest py-3 hover:bg-accent hover:text-primary transition-colors disabled:opacity-40">
            {saving ? '…' : L.save}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Identity chip ─────────────────────────────────────────────────────────────
function IdentityChip({ user, onEdit, L }: { user: RadioUser; onEdit: () => void; L: Record<string, string> }) {
  return (
    <button onClick={onEdit} title={L.editName}
      className="group flex items-center gap-2 border border-primary/20 hover:border-primary pl-1 pr-2.5 py-1 transition-colors">
      <span className="w-6 h-6 flex items-center justify-center text-[9px] font-bold uppercase text-white flex-shrink-0" style={{ backgroundColor: user.color }}>
        {user.nickname.slice(0, 2)}
      </span>
      <span className="text-xs font-medium max-w-[90px] truncate">{user.nickname}</span>
      <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-primary/30 group-hover:text-primary transition-colors flex-shrink-0">
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ── Reply preview (quoted) ────────────────────────────────────────────────────
function ReplyQuote({ reply, onJump }: { reply: NonNullable<RadioMessage['reply_to']>; onJump?: () => void }) {
  return (
    <button onClick={onJump} type="button"
      className="flex items-stretch gap-2 mb-1 text-left max-w-full group/q">
      <span className="w-0.5 bg-primary/30 flex-shrink-0 group-hover/q:bg-accent transition-colors" />
      <span className="min-w-0">
        <span className="font-mono text-[9px] uppercase tracking-widest text-primary/40 block">{reply.nickname}</span>
        <span className="text-[11px] text-primary/40 truncate block">{reply.text}</span>
      </span>
    </button>
  );
}

// ── Chat message row (with hover actions, edit, reactions) ────────────────────
function ChatMessageRow({ msg, isOwn, grouped, L, onReply, onReact, onEdit, onDelete }: {
  msg: RadioMessage;
  isOwn: boolean;
  grouped: boolean;
  L: Record<string, string>;
  onReply: (m: RadioMessage) => void;
  onReact: (id: number, emoji: string) => void;
  onEdit: (id: number, text: string) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.text);
  const [showReactBar, setShowReactBar] = useState(false);

  const saveEdit = async () => {
    const t = draft.trim();
    if (!t || t === msg.text) { setEditing(false); return; }
    await onEdit(msg.id, t);
    setEditing(false);
  };

  return (
    <div className={`group/msg relative flex gap-3 px-1 -mx-1 ${grouped ? 'pt-0.5' : 'pt-4'} hover:bg-primary/[0.025] transition-colors`}>
      <div className="w-8 flex-shrink-0">{!grouped && <Avatar nickname={msg.nickname} color={msg.color} />}</div>
      <div className="flex-1 min-w-0">
        {!grouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-bold text-xs" style={{ color: isOwn ? '#C9A66B' : msg.color }}>{isOwn ? L.you : msg.nickname}</span>
            <span className="font-mono text-[9px] text-primary/30">{formatTime(msg.created_at)}</span>
            {msg.edited_at && <span className="font-mono text-[8px] text-primary/25">({L.edited})</span>}
          </div>
        )}

        {msg.reply_to && <ReplyQuote reply={msg.reply_to} />}

        {editing ? (
          <div className="flex flex-col gap-1.5">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} autoFocus rows={2}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="w-full resize-none bg-bg border border-primary/30 px-2 py-1.5 text-sm outline-none focus:border-primary font-sans" />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="font-mono text-[8px] uppercase tracking-widest bg-primary text-white px-2 py-1 hover:bg-accent hover:text-primary transition-colors">{L.save}</button>
              <button onClick={() => { setEditing(false); setDraft(msg.text); }} className="font-mono text-[8px] uppercase tracking-widest text-primary/40 px-2 py-1 hover:text-primary transition-colors">{L.cancel}</button>
            </div>
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed break-words text-primary/90"><MsgContent text={msg.text} /></p>
        )}

        {msg.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {msg.reactions.map(r => (
              <button key={r.emoji} onClick={() => onReact(msg.id, r.emoji)}
                className={`text-xs px-1.5 py-0.5 border transition-colors ${r.reacted ? 'border-accent bg-accent/10' : 'border-primary/15 hover:border-primary/40'}`}>
                {r.emoji} {r.count}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {!editing && (
        <div className="absolute right-1 top-1 flex items-center bg-bg border border-primary/15 opacity-0 group-hover/msg:opacity-100 transition-opacity">
          <div className="relative">
            <button onClick={() => setShowReactBar(s => !s)} title={L.react}
              className="w-7 h-7 flex items-center justify-center text-primary/40 hover:text-accent transition-colors text-sm">☺</button>
            {showReactBar && (
              <div className="absolute bottom-full right-0 mb-1 flex bg-bg border border-primary shadow-lg z-10">
                {QUICK_REACTIONS.map(e => (
                  <button key={e} onClick={() => { onReact(msg.id, e); setShowReactBar(false); }}
                    className="w-8 h-8 flex items-center justify-center text-base hover:bg-primary/10 transition-colors">{e}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} title={L.reply}
            className="w-7 h-7 flex items-center justify-center text-primary/40 hover:text-primary transition-colors">
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 5 5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {isOwn && (
            <>
              <button onClick={() => { setDraft(msg.text); setEditing(true); }} title={L.edit}
                className="w-7 h-7 flex items-center justify-center text-primary/40 hover:text-primary transition-colors">
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={() => onDelete(msg.id)} title={L.delete}
                className="w-7 h-7 flex items-center justify-center text-primary/40 hover:text-red-500 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator({ typers, L }: { typers: { nickname: string; color: string }[]; L: Record<string, string> }) {
  if (typers.length === 0) return null;
  const names = typers.slice(0, 3).map(t => t.nickname).join(', ');
  return (
    <div className="flex items-center gap-2 px-4 md:px-6 py-1.5 flex-shrink-0">
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1 h-1 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span className="font-mono text-[9px] text-primary/40 truncate">{names} {L.typing}</span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export const RadioPage: React.FC = () => {
  const { language } = useApp();
  const [user, setUser] = useState<RadioUser | null>(null);
  const [messages, setMessages] = useState<RadioMessage[]>([]);
  const [pinned, setPinned] = useState<RadioMessage[]>([]);
  const [online, setOnline] = useState<RadioUser[]>([]);
  const [typing, setTyping] = useState<{ nickname: string; color: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [replyTo, setReplyTo] = useState<RadioMessage | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'ann' | 'pod' | 'pin'>('ann');
  const [activeMobileTab, setActiveMobileTab] = useState<'player' | 'chat' | 'content'>('chat');
  const adminClickRef = useRef(0);
  const adminClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = useRadioAudio(user ? getToken() : null);

  const handleAdminTrigger = useCallback(() => {
    adminClickRef.current += 1;
    if (adminClickTimerRef.current) clearTimeout(adminClickTimerRef.current);
    if (adminClickRef.current >= 3) { adminClickRef.current = 0; setShowAdmin(true); return; }
    adminClickTimerRef.current = setTimeout(() => { adminClickRef.current = 0; }, 600);
  }, []);

  const L: Record<string, string> = {
    ru: {
      kicker: 'AM Publishing Radio', chat: 'Чат', placeholder: 'Написать в чат…',
      placeholderExpanded: 'Текст анонса (необязательно)…', send: 'Отправить',
      you: 'Вы', listeners: 'В эфире', loading: 'Загрузка…', errorConn: 'Не удалось подключиться к радио',
      play: 'Слушать', stop: 'Стоп', connecting: 'Подключение…', waiting: 'Ожидание эфира…', live: 'В эфире', offline: 'Эфир не идёт',
      errAudio: 'Ошибка', micSettings: 'Настройки микрофона', micOn: 'Включить микрофон',
      defaultMic: 'Микрофон по умолчанию', micHint: 'Перезапустите эфир после изменений.',
      micDenied: 'Доступ запрещён', micGrant: 'Разрешить микрофон', micLevel: 'Уровень сигнала',
      tuneIn: 'Слушать эфир →', pinned: 'Закреплено',
      typeChat: 'Чат', typeAnnouncement: 'Анонс', typePodcast: 'Подкаст',
      metaTitle: 'Заголовок…', metaDesc: 'Описание…', metaUrl: 'Ссылка (https://…)',
      metaImage: 'Обложка (URL изображения)…',
      statsTitle: 'Соединение', statsBitrate: 'Битрейт', statsRtt: 'RTT / Пинг',
      statsJitter: 'Джиттер', statsLost: 'Потери пакетов', statsOnline: 'Слушателей',
      editName: 'Изменить имя', nickname: 'Никнейм', color: 'Цвет', save: 'Сохранить', cancel: 'Отмена',
      edited: 'изм.', react: 'Реакция', reply: 'Ответить', edit: 'Изменить', delete: 'Удалить',
      replyingTo: 'Ответ', typing: 'печатает…', nameRule: 'Имя: 2–24 символа',
      deleteConfirm: 'Удалить сообщение?',
      subscribeKicker: 'Канал издательства',
      emptyAnnTitle: 'Пока без анонсов', emptyAnnBody: 'Здесь появляются новости редакции, анонсы книг и отрывки до релиза.',
      emptyPodTitle: 'Подкастов пока нет', emptyPodBody: 'Аудиоэпизоды и записи эфиров будут собираться в этой вкладке.',
      emptyPinTitle: 'Ничего не закреплено', emptyPinBody: 'Важные сообщения и анонсы редакция закрепляет здесь.',
      emptyHint1: 'Слушайте прямой эфир', emptyHint2: 'Общайтесь в чате', emptyHint3: 'Следите в Telegram',
    },
    en: {
      kicker: 'AM Publishing Radio', chat: 'Chat', placeholder: 'Write to chat…',
      placeholderExpanded: 'Announcement text (optional)…', send: 'Send',
      you: 'You', listeners: 'Online', loading: 'Loading…', errorConn: 'Could not connect to radio',
      play: 'Listen', stop: 'Stop', connecting: 'Connecting…', waiting: 'Waiting for broadcast…', live: 'On air', offline: 'Off air',
      errAudio: 'Error', micSettings: 'Microphone', micOn: 'Enable microphone',
      defaultMic: 'Default microphone', micHint: 'Restart the stream after changes.',
      micDenied: 'Access denied', micGrant: 'Allow microphone', micLevel: 'Signal level',
      tuneIn: 'Tune in →', pinned: 'Pinned',
      typeChat: 'Chat', typeAnnouncement: 'Announcement', typePodcast: 'Podcast',
      metaTitle: 'Title…', metaDesc: 'Description…', metaUrl: 'Link (https://…)',
      metaImage: 'Cover image URL…',
      statsTitle: 'Connection', statsBitrate: 'Bitrate', statsRtt: 'RTT / Ping',
      statsJitter: 'Jitter', statsLost: 'Packet loss', statsOnline: 'Listeners',
      editName: 'Edit name', nickname: 'Nickname', color: 'Color', save: 'Save', cancel: 'Cancel',
      edited: 'edited', react: 'React', reply: 'Reply', edit: 'Edit', delete: 'Delete',
      replyingTo: 'Reply to', typing: 'typing…', nameRule: 'Name: 2–24 chars',
      deleteConfirm: 'Delete message?',
      subscribeKicker: 'Publisher channel',
      emptyAnnTitle: 'No announcements yet', emptyAnnBody: 'Editorial news, book announcements and pre-release excerpts appear here.',
      emptyPodTitle: 'No podcasts yet', emptyPodBody: 'Audio episodes and broadcast recordings will be collected in this tab.',
      emptyPinTitle: 'Nothing pinned', emptyPinBody: 'The editors pin important messages and announcements here.',
      emptyHint1: 'Tune into the live stream', emptyHint2: 'Chat with listeners', emptyHint3: 'Follow on Telegram',
    },
    de: {
      kicker: 'AM Publishing Radio', chat: 'Chat', placeholder: 'In den Chat schreiben…',
      placeholderExpanded: 'Ankündigungstext (optional)…', send: 'Senden',
      you: 'Sie', listeners: 'Online', loading: 'Laden…', errorConn: 'Verbindung fehlgeschlagen',
      play: 'Zuhören', stop: 'Stopp', connecting: 'Verbinden…', waiting: 'Warten auf Sendung…', live: 'Live', offline: 'Nicht live',
      errAudio: 'Fehler', micSettings: 'Mikrofon', micOn: 'Mikrofon aktivieren',
      defaultMic: 'Standardmikrofon', micHint: 'Stream nach Änderungen neu starten.',
      micDenied: 'Zugriff verweigert', micGrant: 'Mikrofon erlauben', micLevel: 'Signalpegel',
      tuneIn: 'Reinhören →', pinned: 'Angeheftet',
      typeChat: 'Chat', typeAnnouncement: 'Ankündigung', typePodcast: 'Podcast',
      metaTitle: 'Titel…', metaDesc: 'Beschreibung…', metaUrl: 'Link (https://…)',
      metaImage: 'Cover-Bild URL…',
      statsTitle: 'Verbindung', statsBitrate: 'Bitrate', statsRtt: 'RTT / Ping',
      statsJitter: 'Jitter', statsLost: 'Paketverlust', statsOnline: 'Zuhörer',
      editName: 'Name ändern', nickname: 'Spitzname', color: 'Farbe', save: 'Speichern', cancel: 'Abbrechen',
      edited: 'bearb.', react: 'Reaktion', reply: 'Antworten', edit: 'Bearbeiten', delete: 'Löschen',
      replyingTo: 'Antwort an', typing: 'schreibt…', nameRule: 'Name: 2–24 Zeichen',
      deleteConfirm: 'Nachricht löschen?',
      subscribeKicker: 'Verlagskanal',
      emptyAnnTitle: 'Noch keine Ankündigungen', emptyAnnBody: 'Redaktionsnews, Buchankündigungen und Leseproben erscheinen hier.',
      emptyPodTitle: 'Noch keine Podcasts', emptyPodBody: 'Audio-Episoden und Sendungsmitschnitte werden in diesem Tab gesammelt.',
      emptyPinTitle: 'Nichts angeheftet', emptyPinBody: 'Wichtige Nachrichten und Ankündigungen werden hier angeheftet.',
      emptyHint1: 'Live-Stream hören', emptyHint2: 'Im Chat mitreden', emptyHint3: 'Auf Telegram folgen',
    },
  }[language] ?? {};

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        let u = getRadioUser();
        if (!u) u = await radioGuestJoin();
        if (cancelled) return;
        setUser(u);
        const [msgs, pins, ol] = await Promise.all([fetchRadioMessages(), fetchPinnedMessages(), fetchRadioOnline()]);
        if (cancelled) return;
        setMessages(msgs.filter(m => !m.is_deleted));
        setPinned(pins);
        setOnline(ol);
        if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
      } catch { if (!cancelled) setError(L.errorConn); }
      finally { if (!cancelled) setLoading(false); }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    pollRef.current = setInterval(async () => {
      try {
        const r = await pollRadioMessages(lastIdRef.current);
        if (r.messages.length) {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            return [...prev, ...r.messages.filter(m => !m.is_deleted && !ids.has(m.id))];
          });
          const last = r.messages[r.messages.length - 1];
          if (last) lastIdRef.current = last.id;
        }
        // Live reaction updates
        if (r.reaction_updates?.length) {
          setMessages(prev => prev.map(m => {
            const upd = r.reaction_updates.find(u => u.message_id === m.id);
            return upd ? { ...m, reactions: upd.reactions } : m;
          }));
        }
        setTyping(r.typing ?? []);
        const ol = await fetchRadioOnline();
        setOnline(ol);
      } catch { }
    }, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = useCallback(async (payload: Parameters<typeof sendRadioMessage>[0]) => {
    if (!getRadioUser()) await radioGuestJoin();
    const msg = await sendRadioMessage(payload);
    if (msg.msg_type !== 'chat') setPinned(prev => [...prev, msg]);
    setMessages(prev => [...prev, msg]);
    lastIdRef.current = msg.id;
  }, []);

  const handleTyping = useCallback(() => { sendRadioTyping(); }, []);

  const handleRename = useCallback(async (nickname: string, color: string) => {
    const updated = await renameMe(nickname, color);
    setUser(updated);
    // Reflect new name/color on own messages locally
    setMessages(prev => prev.map(m => m.user_id === updated.id ? { ...m, nickname: updated.nickname, color: updated.color } : m));
  }, []);

  const handleReact = useCallback(async (id: number, emoji: string) => {
    try {
      const res = await reactRadioMessage(id, emoji);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, reactions: res.reactions } : m));
    } catch { }
  }, []);

  const handleEdit = useCallback(async (id: number, text: string) => {
    const res = await editRadioMessage(id, text);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, text: res.text, edited_at: res.edited_at } : m));
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm(L.deleteConfirm)) return;
    try {
      await deleteRadioMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
      setPinned(prev => prev.filter(m => m.id !== id));
    } catch { }
  }, [L.deleteConfirm]);

  const handlePin = useCallback(async (id: number) => {
    const res = await pinRadioMessage(id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_pinned: res.is_pinned } : m));
    if (res.is_pinned) {
      const msg = messages.find(m => m.id === id);
      if (msg) setPinned(prev => [...prev.filter(p => p.id !== id), { ...msg, is_pinned: true }]);
    } else {
      setPinned(prev => prev.filter(p => p.id !== id));
    }
  }, [messages]);

  const statusLabel = audio.status === 'connecting' ? L.connecting
    : audio.status === 'waiting' ? L.waiting
    : audio.status === 'live' ? L.live
    : audio.status === 'error' ? L.errAudio
    : L.offline;
  const isActive = audio.playing || audio.status === 'waiting' || audio.status === 'connecting';

  const chatMessages = messages.filter(m => m.msg_type === 'chat');
  const annMessages = messages.filter(m => m.msg_type === 'announcement');
  const podMessages = messages.filter(m => m.msg_type === 'podcast');

  const rightTabLabel = (tab: 'ann' | 'pod' | 'pin') =>
    tab === 'ann' ? L.typeAnnouncement : tab === 'pod' ? L.typePodcast : L.pinned;
  const rightTabContent = activeRightTab === 'ann' ? annMessages : activeRightTab === 'pod' ? podMessages : pinned;

  return (
    <div className="bg-bg text-primary font-sans pt-[60px] md:pt-[80px]">
      <div className="flex flex-col lg:h-[calc(100vh-80px)]">

        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-4 px-4 md:px-8 py-4 md:py-5 border-b border-primary flex-shrink-0">
          <div className="min-w-0">
            <p className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.28em] text-accent flex items-center gap-2 mb-1.5">
              <span className="inline-block w-6 h-px bg-accent" />
              {L.kicker}
            </p>
            <h1 className="font-serif text-2xl md:text-4xl leading-none truncate">AM Publishing Radio</h1>
          </div>
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${audio.status === 'live' ? 'bg-accent animate-pulse' : isActive ? 'bg-accent/50' : 'bg-primary/20'}`} />
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50">{statusLabel}</span>
            </div>
            <button onClick={audio.togglePlay}
              className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center transition-colors duration-200 ${isActive ? 'bg-accent text-primary' : 'bg-primary text-white hover:bg-accent hover:text-primary'}`}
              title={isActive ? L.stop : L.play}>
              {audio.status === 'connecting'
                ? <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : isActive
                  ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
                  : <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M8 5.5l12 6.5-12 6.5V5.5Z"/></svg>}
            </button>
          </div>
        </header>

        {/* ── Mobile tab bar ── */}
        <div className="flex lg:hidden border-b border-primary flex-shrink-0">
          {(['player', 'chat', 'content'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveMobileTab(tab)}
              className={`flex-1 py-2.5 font-mono text-[9px] uppercase tracking-widest transition-colors ${activeMobileTab === tab ? 'bg-primary text-white' : 'text-primary/40 hover:text-primary'}`}>
              {tab === 'player' ? 'Плеер' : tab === 'chat' ? L.chat : 'Анонсы'}
            </button>
          ))}
        </div>

        {/* ── 3-col body ── */}
        <div className="flex-1 min-h-0 lg:flex">

          {/* Left: Player + Listeners */}
          <aside className={`lg:w-[200px] lg:flex-shrink-0 border-r border-primary flex flex-col lg:overflow-y-auto ${activeMobileTab !== 'player' ? 'hidden lg:flex' : 'flex h-[calc(100vh-160px)]'}`}>
            <PlayerBlock audio={audio} L={L} />
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-3">{L.listeners}</p>
              <ul className="space-y-2">
                {online.map(u => (
                  <li key={u.id} className="flex items-center gap-2.5">
                    <Avatar nickname={u.nickname} color={u.color} />
                    <span className="text-xs truncate" style={{ color: u.id === user?.id ? '#C9A66B' : undefined }}>
                      {u.id === user?.id ? `${u.nickname} (${L.you?.toLowerCase()})` : u.nickname}
                    </span>
                  </li>
                ))}
                {online.length === 0 && !loading && <li className="font-mono text-[10px] text-primary/30">—</li>}
              </ul>
            </div>
            <div className="border-t border-primary p-4 flex items-center gap-3 flex-shrink-0">
              <button onClick={handleAdminTrigger}
                className="font-serif text-lg leading-none hover:text-accent transition-colors select-none">AM</button>
              <span className="w-px h-4 bg-primary/20" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-primary/40">Berlin, {new Date().getFullYear()}</span>
            </div>
          </aside>

          {/* Center: Chat */}
          <section className={`flex flex-col border-r border-primary lg:flex-1 lg:min-h-0 ${activeMobileTab !== 'chat' ? 'hidden lg:flex' : 'flex h-[calc(100vh-160px)]'}`}>
            <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-2.5 border-b border-primary/30 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-widest">{L.chat}</span>
                {online.length > 0 && <LiveDot count={online.length} />}
              </div>
              {user && <IdentityChip user={user} onEdit={() => setEditingName(true)} L={L} />}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-4">
              {loading && <p className="font-mono text-xs text-primary/40 text-center py-12">{L.loading}</p>}
              {!loading && error && <p className="font-mono text-xs text-red-600 text-center py-12">{error}</p>}
              {!loading && !error && chatMessages.length === 0 && <p className="font-mono text-xs text-primary/30 text-center py-12">—</p>}
              {chatMessages.map((msg, i) => {
                const isOwn = user?.id === msg.user_id;
                const prev = chatMessages[i - 1];
                const grouped = !!prev && prev.user_id === msg.user_id && !msg.reply_to;
                return (
                  <ChatMessageRow key={msg.id} msg={msg} isOwn={isOwn} grouped={grouped} L={L}
                    onReply={setReplyTo} onReact={handleReact} onEdit={handleEdit} onDelete={handleDelete} />
                );
              })}
              <div ref={bottomRef} />
            </div>

            <TypingIndicator typers={typing} L={L} />
            <Composer onSend={handleSend} onTyping={handleTyping} disabled={!!error} L={L}
              replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
          </section>

          {/* Right: Announcements / Podcasts / Pinned */}
          <aside className={`lg:w-[360px] lg:flex-shrink-0 flex flex-col lg:min-h-0 bg-primary/[0.015] ${activeMobileTab !== 'content' ? 'hidden lg:flex' : 'flex h-[calc(100vh-160px)]'}`}>
            <div className="flex border-b border-primary flex-shrink-0">
              {(['ann', 'pod', 'pin'] as const).map((tab, i) => {
                const count = tab === 'ann' ? annMessages.length : tab === 'pod' ? podMessages.length : pinned.length;
                return (
                  <button key={tab} onClick={() => setActiveRightTab(tab)}
                    className={`flex-1 py-3 font-mono text-[9px] uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5 ${i < 2 ? 'border-r border-primary' : ''} ${activeRightTab === tab ? 'bg-primary text-white' : 'text-primary/40 hover:text-primary hover:bg-primary/[0.04]'}`}>
                    {rightTabLabel(tab)}
                    {count > 0 && <span className={`text-[8px] px-1 py-px ${activeRightTab === tab ? 'bg-white/20' : 'bg-primary/10'}`}>{count}</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {rightTabContent.length === 0 ? (
                <EmptyPanel tab={activeRightTab} L={L} />
              ) : (
                <div className="p-4 space-y-4">
                  {[...rightTabContent].reverse().map(msg => <AnnouncementCard key={msg.id} msg={msg} onPin={handlePin} />)}
                </div>
              )}
            </div>
            {/* Telegram CTA pinned to bottom */}
            <a href="https://t.me/ampublishingberlin" target="_blank" rel="noopener noreferrer"
              className="group flex items-center gap-3 border-t border-primary px-4 py-3.5 flex-shrink-0 hover:bg-primary hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-accent group-hover:text-white flex-shrink-0"><path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-4.9 9-8.1c.4-.3-.1-.5-.6-.2L6.3 12.6l-4.8-1.5c-1-.3-1-1 .2-1.5l18.7-7.2c.9-.3 1.6.2 1.3 1.4Z"/></svg>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9px] uppercase tracking-widest opacity-50 group-hover:opacity-70">{L.subscribeKicker}</p>
                <p className="text-sm font-medium truncate">@ampublishingberlin</p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">→</span>
            </a>
          </aside>
        </div>
      </div>

      {editingName && user && (
        <NameEditModal user={user} onSave={handleRename} onClose={() => setEditingName(false)} L={L} />
      )}

      {showAdmin && (
        <RadioAdminPanel
          onClose={() => setShowAdmin(false)}
          onChatCleared={() => {
            setMessages([]);
            lastIdRef.current = 0;
          }}
          onPinChanged={(id, isPinned) => {
            if (id === -1) {
              setPinned([]);
              setMessages(prev => prev.map(m => ({ ...m, is_pinned: false })));
            } else {
              setPinned(prev => isPinned ? prev : prev.filter(p => p.id !== id));
              setMessages(prev => prev.map(m => m.id === id ? { ...m, is_pinned: isPinned } : m));
            }
          }}
          onAnnounced={async () => {
            const [msgs, pins] = await Promise.all([fetchRadioMessages(), fetchPinnedMessages()]);
            setMessages(msgs.filter(m => !m.is_deleted));
            setPinned(pins);
            if (msgs.length) lastIdRef.current = msgs[msgs.length - 1].id;
          }}
        />
      )}
    </div>
  );
};
