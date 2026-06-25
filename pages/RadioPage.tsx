import React, {
  useEffect, useRef, useState, useCallback, type FormEvent,
} from 'react';
import { useApp } from '../AppContext';
import {
  radioGuestJoin, fetchRadioMessages, fetchPinnedMessages,
  pollRadioMessages, sendRadioMessage, pinRadioMessage,
  fetchRadioOnline, getRadioUser, getToken,
  type RadioMessage, type RadioUser,
} from '../services/radioApi';

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

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: 'AM Publishing Radio', artist: 'AM Publishing Berlin', album: 'Live' });
    navigator.mediaSession.setActionHandler('play', () => { audioRef.current?.play(); setPlaying(true); });
    navigator.mediaSession.setActionHandler('pause', () => { audioRef.current?.pause(); setPlaying(false); });
    return () => { navigator.mediaSession.setActionHandler('play', null); navigator.mediaSession.setActionHandler('pause', null); };
  }, []);

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
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.srcObject = stream; audioRef.current.volume = volume; audioRef.current.muted = muted;
        audioRef.current.play().catch(() => {});
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
  }, [token, micEnabled, selectedMic, volume, muted, setStatusSafe, startStats]);

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
    <div className={`my-3 border-l-2 ${isPodcast ? 'border-accent' : 'border-primary'} bg-primary/5 p-4 relative`}>
      {msg.is_pinned && (
        <span className="absolute top-2 right-2 font-mono text-[8px] uppercase tracking-widest text-accent">📌</span>
      )}
      <p className="font-mono text-[8px] uppercase tracking-widest text-primary/40 mb-1.5">
        {isPodcast ? '🎙 Подкаст' : '📢 Анонс'}
      </p>
      {msg.meta_image && (
        <img src={msg.meta_image} alt="" className="w-full max-h-40 object-cover mb-3 border border-primary/20" loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      )}
      {msg.meta_title && <p className="font-serif text-xl leading-tight mb-1">{msg.meta_title}</p>}
      {msg.text && <p className="text-sm text-primary/70 leading-relaxed mb-2"><MsgContent text={msg.text} /></p>}
      {msg.meta_description && <p className="text-xs text-primary/50 leading-relaxed mb-2">{msg.meta_description}</p>}
      {msg.meta_url && (
        <a href={msg.meta_url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest border border-primary/40 px-3 py-1.5 hover:bg-primary hover:text-white transition-colors">
          {isPodcast ? 'Слушать →' : 'Подробнее →'}
        </a>
      )}
      <div className="flex items-center justify-between mt-3">
        <span className="font-mono text-[9px] text-primary/30">{msg.nickname}</span>
        <button onClick={() => onPin(msg.id)} className="font-mono text-[8px] uppercase tracking-widest text-primary/30 hover:text-accent transition-colors">
          {msg.is_pinned ? 'Открепить' : 'Закрепить'}
        </button>
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
function PlayerBlock({ audio, L, onlineCount }: { audio: ReturnType<typeof useRadioAudio>; L: Record<string, string>; onlineCount: number }) {
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
    <div className="border-b border-primary">

      {/* Status + play */}
      <div className="px-6 md:px-8 pt-5 pb-4 border-b border-primary/20">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-1">AM Publishing</p>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl leading-tight">Radio</h2>
          <button onClick={audio.togglePlay}
            className={`w-10 h-10 flex items-center justify-center border border-primary transition-colors ${audio.playing || audio.status === 'connecting' || audio.status === 'waiting' ? 'bg-primary text-white' : 'hover:bg-primary hover:text-white'}`}>
            {audio.status === 'connecting'
              ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              : audio.playing || audio.status === 'waiting'
                ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M8 5.5l12 6.5-12 6.5V5.5Z"/></svg>}
          </button>
        </div>
        <p className="font-mono text-[10px] text-primary/40 mt-1">{statusLabel}</p>
      </div>

      {/* Volume */}
      <div className="px-6 md:px-8 py-3 flex items-center gap-3 border-b border-primary/20">
        <button onClick={audio.toggleMute} className="text-primary/40 hover:text-primary transition-colors flex-shrink-0">
          {audio.muted
            ? <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M19 9l-6 6M13 9l6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            : <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
        </button>
        <input type="range" min="0" max="1" step="0.05" value={audio.muted ? 0 : audio.volume}
          onChange={e => { audio.setVolume(Number(e.target.value)); if (audio.muted && Number(e.target.value) > 0) audio.toggleMute(); }}
          className="flex-1 h-px appearance-none bg-primary/20 accent-primary cursor-pointer" />
        <span className="font-mono text-[9px] text-primary/30 w-7 text-right">{Math.round(audio.volume * 100)}%</span>
      </div>

      {/* Microphone — always visible */}
      <div className="px-6 md:px-8 py-4 border-b border-primary/20">
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-primary/50 flex-shrink-0"><path d="M9 4.5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0v-6Z" stroke="currentColor" strokeWidth="1.8"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          <span className="font-mono text-[9px] uppercase tracking-widest text-primary/50">{L.micSettings}</span>
          {audio.micGranted === false && (
            <span className="ml-auto font-mono text-[8px] uppercase tracking-widest text-red-500">{L.micDenied}</span>
          )}
          {audio.micGranted === true && audio.micEnabled && (
            <span className="ml-auto font-mono text-[8px] text-accent">✓</span>
          )}
        </div>

        {/* Mic level bar */}
        <div className="mb-3">
          <div className="h-1.5 bg-primary/10 w-full overflow-hidden">
            <div className="h-full bg-primary/60 transition-all duration-100"
              style={{ width: `${Math.round(audio.stats.micLevel * 100)}%` }} />
          </div>
          <p className="font-mono text-[8px] text-primary/25 mt-1">{L.micLevel}</p>
        </div>

        {/* Toggle */}
        <label className="flex items-center gap-3 cursor-pointer mb-3"
          onClick={() => audio.micGranted === false ? audio.requestMic() : audio.setMicEnabled(m => !m)}>
          <div className={`w-8 h-4 relative transition-colors duration-200 flex-shrink-0 ${audio.micEnabled && audio.micGranted ? 'bg-primary' : 'bg-primary/20'}`}>
            <span className={`absolute top-0.5 w-3 h-3 bg-white transition-transform duration-200 ${audio.micEnabled && audio.micGranted ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60">
            {audio.micGranted === false ? L.micGrant : L.micOn}
          </span>
        </label>

        {/* Device select */}
        {audio.micGranted && audio.micDevices.length > 0 && (
          <select value={audio.selectedMic} onChange={e => audio.setSelectedMic(e.target.value)}
            className="w-full bg-transparent border border-primary/20 px-2 py-1.5 font-mono text-[9px] outline-none hover:border-primary transition-colors">
            <option value="">{L.defaultMic}</option>
            {audio.micDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
        )}
        <p className="font-mono text-[8px] text-primary/25 mt-2 leading-relaxed">{L.micHint}</p>
      </div>

      {/* Connection stats */}
      <div className="px-6 md:px-8 py-4 border-b border-primary/20">
        <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-2">{L.statsTitle}</p>
        <div className="space-y-0">
          <StatRow label="ICE" value={iceLabel} accent={stats.iceState === 'connected'} />
          <StatRow label={L.statsBitrate} value={bitrateLabel} accent={!!stats.bitrateBps} />
          <StatRow label={L.statsRtt} value={rttLabel} accent={stats.rttMs != null && stats.rttMs < 100} />
          <StatRow label={L.statsJitter} value={jitterLabel} />
          <StatRow label={L.statsLost} value={lostLabel} />
          <StatRow label={L.statsOnline} value={String(onlineCount)} accent={onlineCount > 0} />
        </div>
      </div>
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────────
function Composer({ onSend, disabled, L }: {
  onSend: (payload: { text: string; msg_type: MsgType; meta_title?: string; meta_description?: string; meta_url?: string; meta_image?: string }) => Promise<void>;
  disabled: boolean;
  L: Record<string, string>;
}) {
  const [text, setText] = useState('');
  const [msgType, setMsgType] = useState<MsgType>('chat');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDesc, setMetaDesc] = useState('');
  const [metaUrl, setMetaUrl] = useState('');
  const [metaImage, setMetaImage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isExpanded = msgType !== 'chat';

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if ((!text.trim() && !metaTitle.trim()) || sending) return;
    setSending(true);
    try {
      await onSend({ text: text.trim(), msg_type: msgType, meta_title: metaTitle || undefined, meta_description: metaDesc || undefined, meta_url: metaUrl || undefined, meta_image: metaImage || undefined });
      setText(''); setMetaTitle(''); setMetaDesc(''); setMetaUrl(''); setMetaImage('');
      if (msgType !== 'chat') { setMsgType('chat'); setShowExpanded(false); }
    } finally { setSending(false); }
  };

  const insertEmoji = (e: string) => {
    const el = textareaRef.current;
    if (!el) { setText(t => t + e); return; }
    const s = el.selectionStart, end = el.selectionEnd;
    const next = text.slice(0, s) + e + text.slice(end);
    setText(next);
    setTimeout(() => { el.selectionStart = el.selectionEnd = s + e.length; el.focus(); }, 0);
  };

  const handleMsgType = (t: MsgType) => {
    setMsgType(t); setShowExpanded(t !== 'chat'); setShowEmoji(false); setShowGif(false);
  };

  return (
    <div className="border-t border-primary relative">
      {/* Type selector */}
      <div className="flex border-b border-primary/20">
        {(['chat', 'announcement', 'podcast'] as MsgType[]).map(t => (
          <button key={t} type="button" onClick={() => handleMsgType(t)}
            className={`flex-1 py-2 font-mono text-[9px] uppercase tracking-widest transition-colors ${msgType === t ? 'bg-primary text-white' : 'text-primary/40 hover:text-primary'}`}>
            {t === 'chat' ? L.typeChat : t === 'announcement' ? L.typeAnnouncement : L.typePodcast}
          </button>
        ))}
      </div>

      {/* Expanded meta fields */}
      {isExpanded && (
        <div className="px-4 pt-3 space-y-2 border-b border-primary/10">
          <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} placeholder={L.metaTitle}
            className="w-full bg-transparent border-b border-primary/20 pb-1.5 text-sm font-serif outline-none placeholder:text-primary/30 focus:border-primary" />
          <input value={metaDesc} onChange={e => setMetaDesc(e.target.value)} placeholder={L.metaDesc}
            className="w-full bg-transparent border-b border-primary/20 pb-1.5 text-xs outline-none placeholder:text-primary/30 focus:border-primary" />
          <input value={metaUrl} onChange={e => setMetaUrl(e.target.value)} placeholder={L.metaUrl}
            className="w-full bg-transparent border-b border-primary/20 pb-1.5 text-xs font-mono outline-none placeholder:text-primary/30 focus:border-primary" />
          <input value={metaImage} onChange={e => setMetaImage(e.target.value)} placeholder={L.metaImage}
            className="w-full bg-transparent border-b border-primary/20 pb-1.5 text-xs font-mono outline-none placeholder:text-primary/30 focus:border-primary" />
        </div>
      )}

      {/* Pickers */}
      {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
      {showGif && <GifPicker onPick={url => { setText(url); setShowEmoji(false); }} onClose={() => setShowGif(false)} />}

      {/* Main input row */}
      <form onSubmit={handleSubmit} className="flex items-stretch">
        {/* Emoji + GIF buttons */}
        <div className="flex flex-col justify-center px-2 gap-1 border-r border-primary/10">
          <button type="button" onClick={() => { setShowEmoji(s => !s); setShowGif(false); }}
            className={`w-8 h-8 flex items-center justify-center text-base transition-colors ${showEmoji ? 'text-accent' : 'text-primary/30 hover:text-primary'}`}>
            😊
          </button>
          <button type="button" onClick={() => { setShowGif(s => !s); setShowEmoji(false); }}
            className={`w-8 h-8 flex items-center justify-center font-mono text-[9px] uppercase tracking-widest transition-colors ${showGif ? 'text-accent' : 'text-primary/30 hover:text-primary'}`}>
            GIF
          </button>
        </div>

        <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder={isExpanded ? L.placeholderExpanded : L.placeholder}
          rows={2}
          className="flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-primary/30 font-sans"
          disabled={disabled || sending} maxLength={2000} />

        <button type="submit" disabled={(!text.trim() && !metaTitle.trim()) || sending || disabled}
          className="w-[90px] md:w-[120px] border-l border-primary bg-primary text-white font-mono text-[10px] uppercase tracking-widest hover:bg-accent hover:text-primary hover:border-accent transition-colors duration-200 disabled:opacity-30 disabled:cursor-default">
          {sending ? '…' : L.send}
        </button>
      </form>
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = useRadioAudio(user ? getToken() : null);

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
    if (msg.msg_type !== 'chat') {
      setPinned(prev => [...prev, msg]);
    }
    setMessages(prev => [...prev, msg]);
    lastIdRef.current = msg.id;
  }, []);

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

  return (
    <div className="min-h-screen bg-bg text-primary font-sans">

      {/* Header */}
      <div className="border-b border-primary">
        <div className="flex items-stretch min-h-[120px] md:min-h-[160px]">
          <div className="flex-1 p-6 md:p-10 border-r border-primary flex flex-col justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent flex items-center gap-3">
              <span className="inline-block w-8 h-px bg-accent" />
              {L.kicker}
            </p>
            <h1 className="font-serif text-5xl md:text-7xl leading-none mt-4">AM Publishing Radio</h1>
          </div>
          <button onClick={audio.togglePlay}
            className={`w-[160px] md:w-[220px] flex flex-col items-center justify-center gap-3 transition-colors duration-300 cursor-pointer group ${(audio.playing || audio.status === 'waiting') ? 'bg-accent text-primary' : 'bg-primary text-white hover:bg-accent hover:text-primary'}`}>
            {audio.status === 'connecting'
              ? <span className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : audio.playing
                ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
                : <svg viewBox="0 0 48 32" className="w-10 h-7 opacity-60 group-hover:opacity-100 transition-opacity" fill="currentColor">
                    <rect x="0" y="10" width="4" height="12"/><rect x="7" y="4" width="4" height="24"/>
                    <rect x="14" y="0" width="4" height="32"/><rect x="21" y="6" width="4" height="20"/>
                    <rect x="28" y="2" width="4" height="28"/><rect x="35" y="8" width="4" height="16"/>
                    <rect x="42" y="12" width="4" height="8"/>
                  </svg>}
            <span className="font-mono text-[10px] uppercase tracking-widest text-center px-2">
              {audio.status === 'connecting' ? L.connecting : audio.status === 'waiting' ? L.stop : audio.playing ? L.stop : L.tuneIn}
            </span>
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-[calc(100vh-160px)]">

        {/* Chat column */}
        <div className="flex flex-col border-r border-primary">
          <div className="flex items-center justify-between px-6 py-3 border-b border-primary">
            <span className="font-mono text-[10px] uppercase tracking-widest">{L.chat}</span>
            {online.length > 0 && <LiveDot count={online.length} />}
          </div>

          {/* Pinned announcements */}
          {pinned.length > 0 && (
            <div className="px-4 md:px-6 border-b border-primary/20 bg-accent/5">
              <p className="font-mono text-[8px] uppercase tracking-widest text-primary/30 pt-3 mb-1">📌 {L.pinned}</p>
              {pinned.map(msg => (
                <AnnouncementCard key={msg.id} msg={msg} onPin={handlePin} />
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4" style={{ maxHeight: 'calc(100vh - 340px)' }}>
            {loading && <p className="font-mono text-xs text-primary/40 text-center py-12">{L.loading}</p>}
            {!loading && error && <p className="font-mono text-xs text-red-600 text-center py-12">{error}</p>}
            {!loading && !error && messages.length === 0 && <p className="font-mono text-xs text-primary/30 text-center py-12">—</p>}
            {messages.map((msg, i) => {
              if (msg.msg_type !== 'chat') {
                return <AnnouncementCard key={msg.id} msg={msg} onPin={handlePin} />;
              }
              const isOwn = user?.id === msg.user_id;
              const prev = messages[i - 1];
              const grouped = prev && prev.user_id === msg.user_id && prev.msg_type === 'chat';
              return (
                <div key={msg.id} className={`flex gap-3 ${grouped ? 'pt-0.5' : 'pt-4'}`}>
                  <div className="w-8 flex-shrink-0">{!grouped && <Avatar nickname={msg.nickname} color={msg.color} />}</div>
                  <div className="flex-1 min-w-0">
                    {!grouped && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-bold text-xs" style={{ color: isOwn ? '#C9A66B' : msg.color }}>{isOwn ? L.you : msg.nickname}</span>
                        <span className="font-mono text-[9px] text-primary/30">{formatTime(msg.created_at)}</span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed break-words"><MsgContent text={msg.text} /></p>
                    {msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {msg.reactions.map(r => (
                          <span key={r.emoji} className={`text-xs px-1.5 py-0.5 border ${r.reacted ? 'border-accent bg-accent/10' : 'border-primary/20'}`}>
                            {r.emoji} {r.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <Composer onSend={handleSend} disabled={!!error} L={L} />
        </div>

        {/* Sidebar */}
        <div className="flex flex-col">
          <PlayerBlock audio={audio} L={L} onlineCount={online.length} />
          <div className="p-6 md:p-8 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-primary/40 mb-4">{L.listeners}</p>
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
