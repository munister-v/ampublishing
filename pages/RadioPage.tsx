import React, {
  useEffect, useRef, useState, useCallback, type FormEvent,
} from 'react';
import { useApp } from '../AppContext';
import {
  radioGuestJoin, fetchRadioMessages, fetchPinnedMessages,
  pollRadioMessages, sendRadioMessage, pinRadioMessage,
  fetchRadioOnline, getRadioUser, getToken,
  renameMe, editRadioMessage, deleteRadioMessage, reactRadioMessage,
  sendRadioTyping, RADIO_COLORS, fetchRadioConfig,
  type RadioMessage, type RadioUser, type RadioConfig,
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

// ── useRadioAudio — real radio (listen-first, star broadcast) ─────────────────
// Model: everyone joins the room as a LISTENER (recvonly). Anyone may optionally
// "go on air" (mic on) to broadcast. Broadcasters open one peer connection per
// other participant and stream their audio out; listeners only connect to
// broadcasters (never to each other). Deterministic offerer rule avoids glare:
//   • broadcaster ↔ listener  → the broadcaster offers
//   • broadcaster ↔ broadcaster (co-hosts) → the lower user-id offers
type Broadcaster = { id: number; nickname: string; color: string };
type PeerEntry = {
  pc: RTCPeerConnection;
  remoteSet: boolean;
  pendingIce: any[];
};

function useRadioAudio(token: string | null, myId: number | null) {
  const [playing, setPlaying] = useState(false);            // connected to the room
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [micEnabled, setMicEnabledState] = useState(false);  // === on air
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [status, setStatus] = useState<'idle'|'connecting'|'silent'|'live'|'error'>('idle');
  const [broadcasters, setBroadcasters] = useState<Broadcaster[]>([]);
  const [stats, setStats] = useState<AudioStats>({ rttMs: null, jitterMs: null, packetsLost: null, bitrateBps: null, iceState: null, micLevel: 0 });
  const [audioBlocked, setAudioBlocked] = useState(false);

  const statusRef = useRef<typeof status>('idle');
  const setStatusSafe = useCallback((s: typeof status) => { statusRef.current = s; setStatus(s); }, []);

  const callIdRef = useRef<number | null>(null);
  const lastSigRef = useRef(0);
  const peersRef = useRef<Map<number, PeerEntry>>(new Map());
  const audioElsRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const sigTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sigDelayRef = useRef(1000);          // adaptive: fast while negotiating, slow when idle
  const runningRef = useRef(false);
  const memPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const memInFlightRef = useRef(false);
  const statsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevBytesRef = useRef(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const iceServersRef = useRef<any[]>([{ urls: 'stun:stun.l.google.com:19302' }]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Live-value refs (so the polling closures always read fresh state)
  const onAirRef = useRef(false);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const myIdRef = useRef<number | null>(myId);
  useEffect(() => { myIdRef.current = myId; }, [myId]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const headers = useCallback(() => ({
    Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json',
  }), []);

  const sendSig = useCallback((toId: number, type: string, payload: any) => {
    if (!callIdRef.current) return;
    fetch(`${RADIO_API}/calls/${callIdRef.current}/signals`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ to_user_id: toId, signal_type: type, payload }),
    }).catch(() => {});
  }, [headers]);

  // ── per-peer hidden audio element (direct srcObject = iOS-safe playback) ────
  const ensureAudioEl = useCallback((uid: number) => {
    let el = audioElsRef.current.get(uid);
    if (el) return el;
    el = new Audio();
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.autoplay = true; el.preload = 'auto';
    (el as any).disableRemotePlayback = false;
    el.style.display = 'none';
    document.body.appendChild(el);
    audioElsRef.current.set(uid, el);
    return el;
  }, []);

  const applyVolumeToAll = useCallback(() => {
    audioElsRef.current.forEach(el => { el.volume = volumeRef.current; el.muted = mutedRef.current; });
  }, []);

  const recomputeLiveStatus = useCallback(() => {
    if (!playing && statusRef.current === 'idle') return;
    const receiving = audioElsRef.current.size > 0;
    if (onAirRef.current || receiving) setStatusSafe('live');
    else setStatusSafe('silent');
  }, [playing, setStatusSafe]);

  const closePeer = useCallback((uid: number, sendBye = true) => {
    const entry = peersRef.current.get(uid);
    if (entry) { try { entry.pc.close(); } catch {} peersRef.current.delete(uid); }
    const el = audioElsRef.current.get(uid);
    if (el) { try { el.pause(); el.srcObject = null; el.remove(); } catch {} audioElsRef.current.delete(uid); }
    if (sendBye && callIdRef.current) sendSig(uid, 'bye', '1');
  }, [sendSig]);

  const flushIce = useCallback(async (entry: PeerEntry) => {
    for (const c of entry.pendingIce) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(c)); } catch {} }
    entry.pendingIce = [];
  }, []);

  const createPeer = useCallback((uid: number, asOfferer: boolean): PeerEntry => {
    const existing = peersRef.current.get(uid);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    const entry: PeerEntry = { pc, remoteSet: false, pendingIce: [] };
    peersRef.current.set(uid, entry);

    pc.onicecandidate = (e) => { if (e.candidate) sendSig(uid, 'ice', e.candidate); };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      const el = ensureAudioEl(uid);
      el.srcObject = stream; el.volume = volumeRef.current; el.muted = mutedRef.current;
      el.play().catch(() => { setAudioBlocked(true); });
      setStatusSafe('live');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    pc.oniceconnectionstatechange = () => {
      setStats(s => ({ ...s, iceState: pc.iceConnectionState }));
      if (['failed', 'closed', 'disconnected'].includes(pc.iceConnectionState)) {
        const el = audioElsRef.current.get(uid);
        if (el && pc.iceConnectionState !== 'disconnected') { try { el.pause(); el.srcObject = null; el.remove(); } catch {} audioElsRef.current.delete(uid); }
        recomputeLiveStatus();
      }
    };

    // If I'm on air, send my mic to this peer; otherwise I only receive.
    if (onAirRef.current && micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(t => pc.addTrack(t, micStreamRef.current!));
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    if (asOfferer) {
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSig(uid, 'offer', pc.localDescription);
        } catch {}
      })();
    }
    return entry;
  }, [sendSig, ensureAudioEl, setStatusSafe, recomputeLiveStatus]);

  // Decide whether *I* should be the one creating the offer for a given peer.
  const iAmOfferer = useCallback((otherId: number, otherMicOn: boolean) => {
    const me = myIdRef.current ?? 0;
    if (onAirRef.current && !otherMicOn) return true;    // I broadcast → I offer to listener
    if (!onAirRef.current && otherMicOn) return false;   // they broadcast → I answer
    if (onAirRef.current && otherMicOn) return me < otherId; // co-hosts → lower id offers
    return false;
  }, []);

  // Reconcile peer connections against the current member list.
  const reconcile = useCallback((members: any[]) => {
    const me = myIdRef.current ?? 0;
    const micMap = new Map<number, boolean>();
    const bcast: Broadcaster[] = [];
    for (const m of members) {
      const uid = Number(m.user_id);
      if (uid === me) continue;
      const on = !!m.mic_on;
      micMap.set(uid, on);
      if (on) bcast.push({ id: uid, nickname: m.nickname, color: m.color });
    }
    setBroadcasters(bcast);

    // Which peers do I need a connection with? (at least one side broadcasting)
    const needed = new Set<number>();
    micMap.forEach((on, uid) => { if (onAirRef.current || on) needed.add(uid); });

    // Drop peers that left or are no longer relevant.
    let changed = false;
    for (const uid of Array.from(peersRef.current.keys()) as number[]) {
      if (!needed.has(uid)) { closePeer(uid, false); changed = true; }
    }
    // Open the peers I'm responsible for initiating.
    needed.forEach(uid => {
      if (!peersRef.current.has(uid) && iAmOfferer(uid, micMap.get(uid) ?? false)) {
        createPeer(uid, true); changed = true;
      }
    });

    // Membership/topology changed → poll signals fast again to finish negotiation.
    if (changed) sigDelayRef.current = 1000;

    recomputeLiveStatus();
  }, [closePeer, iAmOfferer, createPeer, recomputeLiveStatus]);

  // ── stats (from any inbound peer) ──────────────────────────────────────────
  const startStats = useCallback(() => {
    if (statsRef.current) return;
    statsRef.current = setInterval(async () => {
      const entry = peersRef.current.values().next().value as PeerEntry | undefined;
      if (!entry || entry.pc.signalingState === 'closed') return;
      try {
        const reports = await entry.pc.getStats();
        let rtt: number | null = null, jitter: number | null = null, lost: number | null = null, bytes = 0;
        reports.forEach((r: any) => {
          if (r.type === 'remote-inbound-rtp' && r.kind === 'audio') {
            if (r.roundTripTime != null) rtt = Math.round(r.roundTripTime * 1000);
            if (r.jitter != null) jitter = Math.round(r.jitter * 1000);
            if (r.packetsLost != null) lost = r.packetsLost;
          }
          if (r.type === 'inbound-rtp' && r.kind === 'audio') bytes = r.bytesReceived ?? 0;
        });
        const bitrate = prevBytesRef.current ? Math.round((bytes - prevBytesRef.current) * 8 / 2) : null;
        prevBytesRef.current = bytes;
        setStats(s => ({ ...s, rttMs: rtt, jitterMs: jitter, packetsLost: lost, bitrateBps: bitrate, iceState: entry.pc.iceConnectionState }));
      } catch {}
    }, 2000);
  }, []);

  // ── MediaSession (lock-screen controls) ────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const artwork = ['256x256', '384x384', '512x512'].map(sizes => ({
      src: 'https://ampublishing.org/images/ambook-cover.jpg', sizes, type: 'image/jpeg',
    }));
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'AM Publishing Radio', artist: 'AM Publishing Berlin', album: 'Live', artwork,
      });
    } catch {}
    return () => {
      try { navigator.mediaSession.setActionHandler('play', null); navigator.mediaSession.setActionHandler('pause', null); } catch {}
    };
  }, []);

  // ── mic level analyser (active while on air) ───────────────────────────────
  useEffect(() => {
    if (!micEnabled || !micStreamRef.current) { setStats(s => ({ ...s, micLevel: 0 })); return; }
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(micStreamRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = setInterval(() => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += Math.abs(buf[i] - 128);
        setStats(s => ({ ...s, micLevel: Math.min(1, (sum / buf.length) / 40) }));
      }, 100);
      return () => { clearInterval(tick); ctx.close().catch(() => {}); };
    } catch { return undefined; }
  }, [micEnabled]);

  // ── signal handling ────────────────────────────────────────────────────────
  const handleSignals = useCallback(async (): Promise<number> => {
    if (!callIdRef.current) return 0;
    try {
      const r = await fetch(`${RADIO_API}/calls/${callIdRef.current}/signals?after_id=${lastSigRef.current}`, { headers: headers() });
      const b = await r.json();
      const list = b.data ?? [];
      for (const sig of list) {
        lastSigRef.current = sig.id;
        const from = Number(sig.from_user_id);
        let payload: any;
        try { payload = JSON.parse(sig.payload); } catch { payload = sig.payload; }

        if (sig.signal_type === 'offer') {
          let entry = peersRef.current.get(from);
          if (!entry) entry = createPeer(from, false); // they initiated
          await entry.pc.setRemoteDescription(new RTCSessionDescription(payload));
          entry.remoteSet = true; await flushIce(entry);
          const ans = await entry.pc.createAnswer();
          await entry.pc.setLocalDescription(ans);
          sendSig(from, 'answer', entry.pc.localDescription);
        } else if (sig.signal_type === 'answer') {
          const entry = peersRef.current.get(from);
          if (entry) { await entry.pc.setRemoteDescription(new RTCSessionDescription(payload)); entry.remoteSet = true; await flushIce(entry); }
        } else if (sig.signal_type === 'ice') {
          const entry = peersRef.current.get(from);
          if (entry) { if (entry.remoteSet) { try { await entry.pc.addIceCandidate(new RTCIceCandidate(payload)); } catch {} } else entry.pendingIce.push(payload); }
        } else if (sig.signal_type === 'bye') {
          closePeer(from, false);
          recomputeLiveStatus();
        }
      }
      return list.length;
    } catch { return 0; }
  }, [headers, createPeer, flushIce, sendSig, closePeer, recomputeLiveStatus]);

  // ── member polling (+ heartbeat) ───────────────────────────────────────────
  const pollMembers = useCallback(async () => {
    if (!callIdRef.current || memInFlightRef.current) return; // skip if a poll is still in flight
    memInFlightRef.current = true;
    try {
      const r = await fetch(`${RADIO_API}/calls/${callIdRef.current}/members`, { headers: headers() });
      const b = await r.json();
      reconcile(b.data ?? []);
    } catch {} finally { memInFlightRef.current = false; }
  }, [headers, reconcile]);

  // ── adaptive signal polling — fast while negotiating, backs off when idle ───
  const scheduleSignals = useCallback(() => {
    sigTimerRef.current = setTimeout(async () => {
      if (!runningRef.current) return;
      const got = await handleSignals();
      let negotiating = false;
      peersRef.current.forEach(e => {
        const st = e.pc.iceConnectionState;
        if (st !== 'connected' && st !== 'completed' && st !== 'closed') negotiating = true;
      });
      if (got > 0 || negotiating) sigDelayRef.current = 1000;
      else sigDelayRef.current = Math.min(Math.round(sigDelayRef.current * 1.5), 5000);
      if (runningRef.current) scheduleSignals();
    }, sigDelayRef.current);
  }, [handleSignals]);

  const stopAudio = useCallback(() => {
    runningRef.current = false;
    if (sigTimerRef.current) { clearTimeout(sigTimerRef.current); sigTimerRef.current = null; }
    if (memPollRef.current) { clearInterval(memPollRef.current); memPollRef.current = null; }
    if (statsRef.current) { clearInterval(statsRef.current); statsRef.current = null; }
    for (const uid of Array.from(peersRef.current.keys()) as number[]) closePeer(uid, true);
    if (callIdRef.current) {
      const cid = callIdRef.current;
      fetch(`${RADIO_API}/calls/${cid}/leave`, { method: 'PUT', headers: headers() }).catch(() => {});
      callIdRef.current = null;
    }
    if (onAirRef.current && micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
    onAirRef.current = false; setMicEnabledState(false);
    prevBytesRef.current = 0;
    setAudioBlocked(false);
    setBroadcasters([]); setPlaying(false); setStatusSafe('idle');
    setStats(s => ({ ...s, rttMs: null, jitterMs: null, packetsLost: null, bitrateBps: null, iceState: null }));
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }, [closePeer, headers, setStatusSafe]);

  const startAudio = useCallback(async () => {
    if (!token) return;
    // Pre-unlock audio context in user gesture so async play() works on mobile
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    } catch {}
    setStatusSafe('connecting');
    try {
      const joinRes = await fetch(`${RADIO_API}/calls/join`, { method: 'POST', headers: headers() });
      const jb = await joinRes.json();
      const { call_id, latest_signal_id } = jb.data;
      callIdRef.current = call_id; lastSigRef.current = latest_signal_id ?? 0;

      const cfgRes = await fetch(`${RADIO_API}/calls/config`, { headers: headers() });
      const cfgB = await cfgRes.json();
      iceServersRef.current = cfgB.data?.ice_servers ?? iceServersRef.current;

      setPlaying(true);
      setStatusSafe('silent'); // connected; will flip to 'live' on first inbound track
      runningRef.current = true;
      sigDelayRef.current = 1000;
      startStats();
      await pollMembers();
      scheduleSignals();
      memPollRef.current = setInterval(pollMembers, 4000);
    } catch { setStatusSafe('error'); setTimeout(() => { if (statusRef.current === 'error') setStatusSafe('idle'); }, 3000); }
  }, [token, headers, setStatusSafe, startStats, pollMembers, scheduleSignals]);

  const togglePlay = useCallback(() => {
    if (playing || status === 'connecting') stopAudio(); else startAudio();
  }, [playing, status, startAudio, stopAudio]);

  // ── go on air / leave air ──────────────────────────────────────────────────
  const requestMic = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: selectedMic ? { deviceId: selectedMic } : true });
      micStreamRef.current = s;
      setMicGranted(true);
      const devs = await navigator.mediaDevices.enumerateDevices();
      setMicDevices(devs.filter(d => d.kind === 'audioinput'));
      return s;
    } catch { setMicGranted(false); return null; }
  }, [selectedMic]);

  const rebuildPeers = useCallback(() => {
    // Tear down all peers; the next member poll re-establishes them with the
    // correct send/receive direction for the new on-air state.
    for (const uid of Array.from(peersRef.current.keys()) as number[]) closePeer(uid, true);
    sigDelayRef.current = 1000; // negotiation restarts → poll fast
    pollMembers();
  }, [closePeer, pollMembers]);

  const toggleAir = useCallback(async () => {
    if (!onAirRef.current) {
      // Going on air — ensure we're connected to the room first.
      if (!callIdRef.current) await startAudio();
      const stream = micStreamRef.current ?? await requestMic();
      if (!stream) return; // mic denied
      onAirRef.current = true; setMicEnabledState(true);
      if (callIdRef.current) fetch(`${RADIO_API}/calls/${callIdRef.current}/mic`, { method: 'PUT', headers: headers(), body: JSON.stringify({ on: true }) }).catch(() => {});
      rebuildPeers();
      setStatusSafe('live');
    } else {
      onAirRef.current = false; setMicEnabledState(false);
      if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
      if (callIdRef.current) fetch(`${RADIO_API}/calls/${callIdRef.current}/mic`, { method: 'PUT', headers: headers(), body: JSON.stringify({ on: false }) }).catch(() => {});
      rebuildPeers();
      recomputeLiveStatus();
    }
  }, [startAudio, requestMic, headers, rebuildPeers, setStatusSafe, recomputeLiveStatus]);

  const setVolume = useCallback((v: number) => { setVolumeState(v); volumeRef.current = v; applyVolumeToAll(); }, [applyVolumeToAll]);
  const toggleMute = useCallback(() => { setMuted(m => { mutedRef.current = !m; applyVolumeToAll(); return !m; }); }, [applyVolumeToAll]);

  // Cleanup on unmount
  useEffect(() => () => { stopAudio(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unlockAudio = useCallback(async () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    } catch {}
    audioElsRef.current.forEach(el => { el.play().catch(() => {}); });
    setAudioBlocked(false);
  }, []);

  return {
    playing, status, stats, volume, setVolume, muted, toggleMute,
    micEnabled, onAir: micEnabled, toggleAir, micGranted, requestMic,
    micDevices, selectedMic, setSelectedMic, togglePlay, broadcasters,
    audioBlocked, unlockAudio,
  };
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
  const accentColor = isPodcast ? '#C9A66B' : '#ffffff';

  return (
    <article className="group relative overflow-hidden border border-white/10 hover:border-accent/40 transition-all duration-500 bg-white/[0.02]">
      {/* Hero image block */}
      {msg.meta_image ? (
        <div className="relative overflow-hidden" style={{ height: 180 }}>
          <img src={msg.meta_image} alt="" className="w-full h-full object-cover opacity-70 scale-105 group-hover:scale-100 transition-transform duration-700" loading="lazy"
            onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
          {/* Type badge inside image */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className={`font-mono text-[9px] uppercase tracking-[0.28em] px-2.5 py-1 border ${isPodcast ? 'border-accent/60 text-accent bg-primary/70' : 'border-white/30 text-white/80 bg-primary/70'}`}>
              {isPodcast ? '🎙 Podcast' : '📢 Announcement'}
            </span>
            {msg.is_pinned && (
              <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 bg-accent text-primary">
                Pinned
              </span>
            )}
          </div>
          {/* Title overlaid on image */}
          {msg.meta_title && (
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
              <h3 className="font-serif text-xl leading-tight text-white drop-shadow-lg">{msg.meta_title}</h3>
            </div>
          )}
        </div>
      ) : (
        /* No image — top badge row */
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <span className={`font-mono text-[9px] uppercase tracking-[0.28em] flex items-center gap-2 ${isPodcast ? 'text-accent' : 'text-white/50'}`}>
            <span className={`inline-block w-4 h-px ${isPodcast ? 'bg-accent' : 'bg-white/30'}`} />
            {isPodcast ? 'Podcast' : 'Announcement'}
          </span>
          {msg.is_pinned && (
            <span className="font-mono text-[9px] uppercase tracking-widest text-accent border border-accent/40 px-2 py-0.5">Pinned</span>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="px-5 pb-5 pt-4">
        {/* Title (shown here only if no image) */}
        {msg.meta_title && !msg.meta_image && (
          <h3 className="font-serif text-2xl leading-snug mb-3 text-white">{msg.meta_title}</h3>
        )}

        {/* Body text */}
        {msg.text && (
          <p className="text-sm text-white/65 leading-relaxed mb-3 break-words">
            <MsgContent text={msg.text} />
          </p>
        )}
        {msg.meta_description && (
          <p className="text-xs text-white/40 leading-relaxed mb-4">{msg.meta_description}</p>
        )}

        {/* Divider */}
        <div className="h-px bg-white/8 mb-4" />

        {/* Bottom row: CTA + pin */}
        <div className="flex items-center justify-between gap-3">
          {msg.meta_url ? (
            <a href={msg.meta_url} target="_blank" rel="noopener noreferrer"
              className={`group/btn inline-flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.2em] border px-4 py-2.5 transition-all duration-300 ${isPodcast ? 'border-accent/50 text-accent hover:bg-accent hover:text-primary' : 'border-white/25 text-white/70 hover:border-accent hover:text-accent'}`}>
              <span>{isPodcast ? '▶ Listen' : 'Read more'}</span>
              <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 group-hover/btn:translate-x-0.5 transition-transform">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          ) : <span />}
          <button onClick={() => onPin(msg.id)}
            className="font-mono text-[9px] uppercase tracking-widest text-white/20 hover:text-accent transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0">
            {msg.is_pinned ? '− unpin' : '+ pin'}
          </button>
        </div>
      </div>

      {/* Left accent bar */}
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accentColor, opacity: isPodcast ? 1 : 0.3 }} />
    </article>
  );
}

// ── Demo announcement card (shown when panel is empty) ───────────────────────
function DemoCard({ L }: { L: Record<string, string> }) {
  return (
    <div className="p-4 space-y-4">
      {/* Demo announcement card — styled like a real one */}
      <article className="relative overflow-hidden border border-accent/30 bg-accent/[0.04] hover:border-accent/50 transition-colors duration-300">
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent" />
        <div className="relative overflow-hidden" style={{ height: 180 }}>
          <img src="/images/home-hero.webp" alt="" className="w-full h-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.28em] px-2.5 py-1 border border-white/30 text-white/80 bg-primary/70">
              📢 {L.typeAnnouncement}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
            <h3 className="font-serif text-xl leading-tight text-white">{L.demoTitle}</h3>
          </div>
        </div>
        <div className="px-5 pb-5 pt-4">
          <p className="text-sm text-white/50 leading-relaxed mb-4">{L.demoBody}</p>
          <div className="h-px bg-white/8 mb-4" />
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] border border-accent/40 px-4 py-2.5 text-accent/80">
            {L.demoBtn}
            <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        </div>
      </article>

      {/* Hints */}
      <div className="space-y-px">
        {[L.emptyHint1, L.emptyHint2, L.emptyHint3].map((h, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-t border-white/8">
            <span className="font-mono text-[9px] text-accent/50 w-4 flex-shrink-0 tabular-nums">0{i + 1}</span>
            <span className="font-mono text-[10px] text-white/30 leading-snug">{h}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty state for the right panel ──────────────────────────────────────────
function EmptyPanel({ tab, L }: { tab: 'ann' | 'pod' | 'pin'; L: Record<string, string> }) {
  // Announcements tab shows a demo card instead of a plain empty state
  if (tab === 'ann') return <DemoCard L={L} />;

  const cfg = {
    pod: { icon: '🎙', title: L.emptyPodTitle, body: L.emptyPodBody },
    pin: { icon: '📌', title: L.emptyPinTitle, body: L.emptyPinBody },
  }[tab as 'pod' | 'pin'];
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-8 py-12">
      <div className="w-16 h-16 flex items-center justify-center border border-white/10 text-3xl mb-6 bg-white/5">
        {cfg.icon}
      </div>
      <p className="font-serif text-xl leading-tight mb-2 text-white">{cfg.title}</p>
      <p className="text-sm text-white/40 leading-relaxed max-w-[220px] mb-8">{cfg.body}</p>
      <div className="w-full max-w-[220px] space-y-px">
        {[L.emptyHint1, L.emptyHint2, L.emptyHint3].map((h, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5 border-t border-white/8 text-left">
            <span className="font-mono text-[10px] text-accent/60 w-4 flex-shrink-0 tabular-nums">0{i + 1}</span>
            <span className="font-mono text-[11px] text-white/35 leading-snug">{h}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Avatar({ nickname, color }: { nickname: string; color: string }) {
  return (
    <div className="w-9 h-9 flex items-center justify-center text-[11px] font-bold uppercase tracking-widest text-white flex-shrink-0 rounded-full shadow-sm"
      style={{ backgroundColor: color || '#1a2840' }}>
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
    <div className="flex items-center justify-between py-1.5 border-b border-white/8 last:border-0">
      <span className="font-mono text-[9px] uppercase tracking-widest text-white/35">{label}</span>
      <span className={`font-mono text-[10px] ${accent ? 'text-accent' : 'text-white/55'}`}>{value}</span>
    </div>
  );
}

// ── Equalizer bars (decorative, animated when live) ───────────────────────────
function EqBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-px h-4" aria-hidden>
      {[3, 5, 4, 7, 3, 6, 4, 5, 3].map((h, i) => (
        <div key={i} className={`w-0.5 bg-accent transition-all ${active ? 'opacity-100' : 'opacity-20'}`}
          style={{
            height: active ? `${h * 2}px` : '4px',
            animation: active ? `eqBar ${0.4 + i * 0.07}s ease-in-out infinite alternate` : 'none',
          }} />
      ))}
    </div>
  );
}

// ── Player sidebar block ─────────────────────────────────────────────────────
function PlayerBlock({ audio, L, onToggle, isActive }: {
  audio: ReturnType<typeof useRadioAudio>;
  L: Record<string, string>;
  onToggle: () => void;
  isActive: boolean;
}) {
  const [statsOpen, setStatsOpen] = useState(false);

  const isLive = audio.status === 'live';
  const statusLabel = audio.status === 'connecting' ? L.connecting
    : audio.status === 'live' ? (audio.onAir ? L.youAreLive : L.live)
    : audio.status === 'silent' ? L.silentAir
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

  const onAirNames = audio.broadcasters.map(b => b.nickname);
  if (audio.onAir) onAirNames.unshift(L.you);

  return (
    <div>
      {/* Big LISTEN area */}
      <div className="px-5 pt-7 pb-6 border-b border-white/8">
        <img src="/logo-white.png" alt="AM Publishing" className="w-20 h-20 object-contain mb-5 opacity-85" draggable={false} />

        {/* Primary action: LISTEN */}
        <button onClick={onToggle}
          className={`group relative w-full flex items-center gap-4 px-4 py-4 mb-4 transition-all duration-300 ${isActive ? 'bg-accent text-primary' : 'bg-white/[0.06] text-white hover:bg-accent hover:text-primary border border-white/10'}`}>
          <span className="relative flex items-center justify-center w-10 h-10 flex-shrink-0">
            {audio.status === 'connecting'
              ? <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : isActive
                ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M8 5.5l12 6.5-12 6.5V5.5Z"/></svg>}
            {isLive && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-current rounded-full animate-ping opacity-60" />}
          </span>
          <span className="flex-1 text-left min-w-0">
            <span className="block font-mono text-[10px] uppercase tracking-[0.25em] opacity-60 mb-0.5">
              {isActive ? L.stopListening : L.listenLive}
            </span>
            <span className="block font-serif text-lg leading-none truncate">{statusLabel}</span>
          </span>
        </button>

        {/* Mobile autoplay unlock */}
        {audio.audioBlocked && (
          <button onClick={audio.unlockAudio}
            className="w-full flex items-center justify-center gap-2.5 mb-4 px-4 py-3 bg-accent/15 border border-accent/40 text-accent font-mono text-[10px] uppercase tracking-[0.2em] hover:bg-accent/25 transition-colors animate-pulse">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 flex-shrink-0"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M15.5 8.5a5 5 0 0 1 0 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
            Tap to hear audio
          </button>
        )}

        {/* Now on air */}
        <div className="flex items-center gap-2.5 mb-5 min-h-[16px]">
          {onAirNames.length > 0 ? (
            <>
              <EqBars active={isLive} />
              <span className="font-mono text-[10px] text-white/45 truncate">
                <span className="text-accent uppercase tracking-widest">{L.onAirNow}: </span>
                {onAirNames.join(', ')}
              </span>
            </>
          ) : isActive ? (
            <span className="font-mono text-[10px] text-white/30 italic">{L.nobodyOnAir}</span>
          ) : (
            <span className="font-mono text-[10px] text-white/25">{L.listenHint}</span>
          )}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3">
          <button onClick={audio.toggleMute} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
            {audio.muted
              ? <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M19 9l-6 6M13 9l6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              : <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
          </button>
          <input type="range" min="0" max="1" step="0.05" value={audio.muted ? 0 : audio.volume}
            onChange={e => { audio.setVolume(Number(e.target.value)); if (audio.muted && Number(e.target.value) > 0) audio.toggleMute(); }}
            className="flex-1 h-px appearance-none bg-white/15 accent-[#C9A66B] cursor-pointer" />
          <span className="font-mono text-[10px] text-white/30 w-8 text-right tabular-nums">{Math.round(audio.volume * 100)}%</span>
        </div>
      </div>

      {/* Optional: GO ON AIR (secondary — most people just listen) */}
      <div className="px-5 py-4 border-b border-white/8">
        <button onClick={audio.toggleAir}
          className={`w-full flex items-center justify-center gap-2.5 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${audio.onAir ? 'bg-accent text-primary' : 'border border-white/15 text-white/55 hover:border-accent hover:text-accent'}`}>
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.7"/>
            <path d="M19 11a7 7 0 0 1-14 0M12 18v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
          {audio.onAir ? L.leaveAir : L.goOnAir}
        </button>
        {audio.onAir && (
          <div className="h-1 bg-white/8 w-full overflow-hidden rounded-full mt-3">
            <div className="h-full bg-accent/70 transition-all duration-100 rounded-full" style={{ width: `${Math.round(audio.stats.micLevel * 100)}%` }} />
          </div>
        )}
        {audio.onAir && audio.micDevices.length > 0 && (
          <select value={audio.selectedMic} onChange={e => audio.setSelectedMic(e.target.value)}
            style={{ background: 'rgba(255,255,255,0.05)', colorScheme: 'dark' }}
            className="w-full border border-white/10 px-2 py-1.5 font-mono text-[10px] outline-none hover:border-white/25 transition-colors mt-3 text-white/55">
            <option value="">{L.defaultMic}</option>
            {audio.micDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0, 6)}`}</option>
            ))}
          </select>
        )}
        {audio.micGranted === false && (
          <p className="font-mono text-[9px] text-red-400/70 mt-2 leading-snug">{L.micGrant}</p>
        )}
      </div>

      {/* Stats — collapsible */}
      <div className="border-b border-white/8">
        <button onClick={() => setStatsOpen(s => !s)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/30">{L.statsTitle}</span>
          <svg viewBox="0 0 24 24" fill="none" className={`w-3.5 h-3.5 text-white/25 transition-transform ${statsOpen ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {statsOpen && (
          <div className="px-5 pb-3">
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
    <div className="border-t border-white/8 relative flex-shrink-0 bg-[#071020]">
      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-white/[0.03]">
          <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 text-accent flex-shrink-0"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 5 5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[8px] uppercase tracking-widest text-white/30">{L.replyingTo} </span>
            <span className="text-[11px] font-bold" style={{ color: replyTo.color }}>{replyTo.nickname}</span>
            <span className="text-[11px] text-white/30 truncate"> · {replyTo.text.slice(0, 60)}</span>
          </div>
          <button onClick={onCancelReply} className="text-white/30 hover:text-white flex-shrink-0">✕</button>
        </div>
      )}

      {/* Pickers */}
      {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} />}
      {showGif && <GifPicker onPick={url => { setText(url); setShowEmoji(false); }} onClose={() => setShowGif(false)} />}

      {/* Main input row */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 px-3 py-3 md:px-4 md:py-4">
        <div className="flex items-center gap-0 self-stretch">
          <button type="button" onClick={() => { setShowEmoji(s => !s); setShowGif(false); }}
            className={`w-10 h-10 flex items-center justify-center text-xl transition-colors ${showEmoji ? 'text-accent' : 'text-white/30 hover:text-white/60'}`}>😊</button>
          <button type="button" onClick={() => { setShowGif(s => !s); setShowEmoji(false); }}
            className={`w-10 h-10 flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${showGif ? 'text-accent' : 'text-white/30 hover:text-white/60'}`}>GIF</button>
        </div>

        <textarea ref={textareaRef} value={text} onChange={e => onChangeText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } if (e.key === 'Escape' && replyTo) onCancelReply(); }}
          placeholder={L.placeholder}
          rows={2}
          className="flex-1 resize-none border border-white/10 focus:border-white/30 px-4 py-3 text-base leading-relaxed outline-none font-sans transition-colors max-h-40 text-white/90 placeholder:text-white/30"
          style={{ background: 'rgba(255,255,255,0.06)', colorScheme: 'dark' }}
          disabled={disabled || sending} maxLength={2000} />

        <button type="submit" disabled={!text.trim() || sending || disabled}
          className="h-12 w-12 flex-shrink-0 flex items-center justify-center bg-accent text-primary hover:bg-white hover:text-primary transition-colors duration-200 disabled:opacity-20 disabled:cursor-default"
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
      className="group flex items-center gap-2 border border-white/15 hover:border-white/35 pl-1 pr-2.5 py-1 transition-colors">
      <span className="w-6 h-6 flex items-center justify-center text-[9px] font-bold uppercase text-white flex-shrink-0" style={{ backgroundColor: user.color }}>
        {user.nickname.slice(0, 2)}
      </span>
      <span className="text-xs font-medium max-w-[90px] truncate text-white/70 group-hover:text-white transition-colors">{user.nickname}</span>
      <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3 text-white/25 group-hover:text-white/60 transition-colors flex-shrink-0">
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
      <span className="w-0.5 bg-white/20 flex-shrink-0 group-hover/q:bg-accent transition-colors" />
      <span className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40 block">{reply.nickname}</span>
        <span className="text-xs text-white/35 truncate block">{reply.text}</span>
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
    <div className={`group/msg relative flex gap-3 px-3 md:px-5 ${grouped ? 'pt-px' : 'pt-4'} pb-0.5 hover:bg-white/[0.025] transition-colors rounded-sm`}>
      <div className="w-9 flex-shrink-0 mt-0.5">{!grouped && <Avatar nickname={msg.nickname} color={msg.color} />}</div>
      <div className="flex-1 min-w-0">
        {!grouped && (
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-[13px]" style={{ color: isOwn ? '#C9A66B' : msg.color }}>{isOwn ? L.you : msg.nickname}</span>
            <span className="font-mono text-[10px] text-white/25">{formatTime(msg.created_at)}</span>
            {msg.edited_at && <span className="font-mono text-[9px] text-white/20">({L.edited})</span>}
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
              className="w-full resize-none bg-bg border border-primary/30 px-3 py-2 text-sm outline-none focus:border-primary font-sans" />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="font-mono text-[9px] uppercase tracking-widest bg-primary text-white px-3 py-1.5 hover:bg-accent hover:text-primary transition-colors">{L.save}</button>
              <button onClick={() => { setEditing(false); setDraft(msg.text); }} className="font-mono text-[9px] uppercase tracking-widest text-primary/40 px-3 py-1.5 hover:text-primary transition-colors">{L.cancel}</button>
            </div>
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed break-words text-white/80"><MsgContent text={msg.text} /></p>
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
        <div className="absolute right-1 top-1 flex items-center bg-[#0d1929] border border-white/12 opacity-0 group-hover/msg:opacity-100 transition-opacity">
          <div className="relative">
            <button onClick={() => setShowReactBar(s => !s)} title={L.react}
              className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-accent transition-colors text-sm">☺</button>
            {showReactBar && (
              <div className="absolute bottom-full right-0 mb-1 flex bg-[#0d1929] border border-white/15 shadow-lg z-10">
                {QUICK_REACTIONS.map(e => (
                  <button key={e} onClick={() => { onReact(msg.id, e); setShowReactBar(false); }}
                    className="w-8 h-8 flex items-center justify-center text-base hover:bg-white/10 transition-colors">{e}</button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} title={L.reply}
            className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 5 5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          {isOwn && (
            <>
              <button onClick={() => { setDraft(msg.text); setEditing(true); }} title={L.edit}
                className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={() => onDelete(msg.id)} title={L.delete}
                className="w-7 h-7 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors">
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
    <div className="flex items-center gap-2 px-4 md:px-6 py-2 flex-shrink-0">
      <span className="flex gap-0.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
      <span className="font-mono text-xs text-white/35 truncate">{names} {L.typing}</span>
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
  const [bookIdx, setBookIdx] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [config, setConfig] = useState<RadioConfig>({});
  const carouselRef = useRef<HTMLDivElement>(null);
  const typingTsRef = useRef(0);

  useEffect(() => { fetchRadioConfig().then(setConfig).catch(() => {}); }, []);
  const adminClickRef = useRef(0);
  const onlinePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const adminClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audio = useRadioAudio(user ? getToken() : null, user?.id ?? null);

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
      listenLive: 'Слушать эфир', stopListening: 'Остановить', silentAir: 'Тишина в эфире', youAreLive: 'Вы в эфире',
      onAirNow: 'В эфире', nobodyOnAir: 'Сейчас никто не вещает', listenHint: 'Нажмите, чтобы слушать',
      goOnAir: 'Выйти в эфир', leaveAir: 'Завершить эфир',
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
      heroSubtitle: 'Прямые эфиры и подкасты о литературе, авторах и книгах',
      nowOnAir: 'Сейчас в эфире', guestLabel: 'Гость эфира', scheduleLabel: 'Расписание', viewAll: 'Смотреть все',
      editorPick: 'Редактор рекомендует', bookOfWeek: 'Книга недели', latestPodcastLabel: 'Последний подкаст',
      latestBroadcasts: 'Последние эфиры', chatTitle: 'Чат эфира', listenersWord: 'слушателей',
      listenWord: 'Слушать', minutesShort: 'мин', weInTelegram: 'Мы в Telegram',
      soonOnAir: 'Скоро в эфире', noBroadcasts: 'Эфиры скоро появятся', author: 'Автор', stopAir: 'Остановить',
      demoTitle: 'Новые книги этого сезона', demoBody: 'Следите за анонсами — здесь первыми появляются отрывки, даты выхода и новости редакции.', demoBtn: 'Подписаться на канал →',
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
      listenLive: 'Listen live', stopListening: 'Stop', silentAir: 'Silent — no broadcast', youAreLive: 'You are on air',
      onAirNow: 'On air', nobodyOnAir: 'Nobody is broadcasting yet', listenHint: 'Tap to start listening',
      goOnAir: 'Go on air', leaveAir: 'Leave air',
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
      heroSubtitle: 'Live broadcasts and podcasts on literature, authors and books',
      nowOnAir: 'On air now', guestLabel: 'On-air guest', scheduleLabel: 'Schedule', viewAll: 'View all',
      editorPick: 'Editor picks', bookOfWeek: 'Book of the week', latestPodcastLabel: 'Latest podcast',
      latestBroadcasts: 'Latest broadcasts', chatTitle: 'Live chat', listenersWord: 'listeners',
      listenWord: 'Listen', minutesShort: 'min', weInTelegram: 'We are on Telegram',
      soonOnAir: 'Coming soon', noBroadcasts: 'Broadcasts coming soon', author: 'Author', stopAir: 'Stop',
      demoTitle: 'New books this season', demoBody: 'Follow our announcements — excerpts, release dates and editorial news appear here first.', demoBtn: 'Subscribe to channel →',
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
      listenLive: 'Live hören', stopListening: 'Stopp', silentAir: 'Stille — keine Sendung', youAreLive: 'Sie sind live',
      onAirNow: 'Live', nobodyOnAir: 'Niemand sendet gerade', listenHint: 'Tippen zum Hören',
      goOnAir: 'Live gehen', leaveAir: 'Sendung beenden',
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
      heroSubtitle: 'Live-Sendungen und Podcasts über Literatur, Autoren und Bücher',
      nowOnAir: 'Jetzt live', guestLabel: 'Studiogast', scheduleLabel: 'Programm', viewAll: 'Alle ansehen',
      editorPick: 'Redaktion empfiehlt', bookOfWeek: 'Buch der Woche', latestPodcastLabel: 'Neuester Podcast',
      latestBroadcasts: 'Letzte Sendungen', chatTitle: 'Live-Chat', listenersWord: 'Hörer',
      listenWord: 'Hören', minutesShort: 'Min', weInTelegram: 'Wir auf Telegram',
      soonOnAir: 'Demnächst', noBroadcasts: 'Sendungen folgen bald', author: 'Autor', stopAir: 'Stopp',
      demoTitle: 'Neue Bücher dieser Saison', demoBody: 'Bleib auf dem Laufenden — Leseproben, Erscheinungstermine und Neuigkeiten erscheinen hier zuerst.', demoBtn: 'Kanal abonnieren →',
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
      } catch { }
    }, POLL_MS);
    onlinePollRef.current = setInterval(async () => {
      try { const ol = await fetchRadioOnline(); setOnline(ol); } catch {}
    }, 1000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (onlinePollRef.current) clearInterval(onlinePollRef.current);
    };
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
    : audio.status === 'live' ? (audio.onAir ? L.youAreLive : L.live)
    : audio.status === 'silent' ? L.silentAir
    : audio.status === 'error' ? L.errAudio
    : L.offline;
  const isActive = audio.playing || audio.status === 'connecting';

  const chatMessages = messages.filter(m => m.msg_type === 'chat');
  const annMessages = messages.filter(m => m.msg_type === 'announcement');
  const podMessages = messages.filter(m => m.msg_type === 'podcast');

  const isLive = audio.status === 'live';

  // Editorial data (driven by real announcements / podcasts the admin posts)
  const annNewest = [...annMessages].reverse();
  const podNewest = [...podMessages].reverse();
  const broadcasts = [...podNewest, ...annNewest];
  const withImage = broadcasts.filter(m => m.meta_image);
  const featured = pinned.find(p => p.msg_type !== 'chat') || annNewest[0] || podNewest[0] || null;
  const latestPodcast = podNewest[0] || null;
  const scheduleItems = broadcasts.slice(0, 5);
  const liveBroadcaster = audio.broadcasters[0] || (audio.onAir && user ? { id: user.id, nickname: user.nickname, color: user.color } : null);
  const listenersCount = online.length;
  const books = withImage.length ? withImage : (featured ? [featured] : []);
  const book = books.length ? books[bookIdx % books.length] : null;

  // Config-driven editorial layer (admin configurator); falls back to announcements
  const heroImage = config.hero_image || '/images/about-hero.jpg';
  const tgHandle = (config.telegram || '@ampublishingberlin').replace(/^@?/, '@');
  const tgUrl = `https://t.me/${tgHandle.replace(/^@/, '')}`;
  const nowTitle = config.now_title || featured?.meta_title || '';
  const nowHost = config.now_host || '';
  const nowDesc = config.now_description || featured?.text || featured?.meta_description || '';
  const guest = config.guest_name
    ? { name: config.guest_name, role: config.guest_role || '', time: config.guest_time || '', duration: config.guest_duration || '', url: '' }
    : (featured && (featured.meta_title || featured.meta_description)
      ? { name: featured.meta_title || '', role: featured.meta_description || '', time: '', duration: '', url: featured.meta_url || '' }
      : null);
  const cfgSchedule = (config.schedule || []).filter(s => s.title);
  const bookCard = config.book_title
    ? { title: config.book_title, author: config.book_author || '', image: config.book_image || '/images/ambook-cover.jpg', url: config.book_url || '' }
    : (book ? { title: book.meta_title || '', author: book.meta_description || '', image: book.meta_image || '/images/ambook-cover.jpg', url: book.meta_url || '' } : null);

  const sendChat = async () => {
    const t = chatInput.trim();
    if (!t) return;
    setChatInput('');
    try { await handleSend({ text: t, msg_type: 'chat', reply_to_id: replyTo ? replyTo.id : null }); setReplyTo(null); }
    catch { setChatInput(t); }
  };
  const onChatType = (v: string) => {
    setChatInput(v);
    const now = Date.now();
    if (now - typingTsRef.current > 2500) { typingTsRef.current = now; handleTyping(); }
  };

  return (
    <div className="bg-[#F4F4F0] text-primary font-sans pt-[60px] md:pt-[80px] min-h-screen">
      <style>{`@keyframes eqBar{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}`}</style>

      {/* ════ HERO ════ */}
      <section className="grid lg:grid-cols-[1fr_minmax(320px,400px)] border-b border-primary/15">
        {/* left: text + portrait */}
        <div className="grid md:grid-cols-2 lg:border-r border-primary/15">
          {/* text */}
          <div className="order-2 md:order-1 px-6 md:px-10 lg:px-12 py-10 md:py-14 flex flex-col justify-center">
            <button onClick={handleAdminTrigger} className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-accent flex items-center gap-3 mb-6 select-none">
              <span className="w-7 h-px bg-accent/70" /> AM Publishing Radio
            </button>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl leading-[0.92] mb-6">AM Publishing<br />Radio</h1>
            <p className="font-mono text-xs md:text-sm text-primary/55 leading-relaxed max-w-sm mb-9">{L.heroSubtitle}</p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <button onClick={audio.togglePlay}
                className="group inline-flex items-center gap-3.5 bg-primary text-white pl-2.5 pr-7 py-2.5 hover:bg-accent hover:text-primary transition-colors duration-300">
                <span className="w-9 h-9 rounded-full border border-white/30 group-hover:border-primary/40 flex items-center justify-center flex-shrink-0">
                  {audio.status === 'connecting'
                    ? <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : isActive
                      ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
                      : <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5"><path d="M8 5.5l12 6.5-12 6.5V5.5Z" /></svg>}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{isActive ? L.stopAir : L.listenLive}</span>
              </button>

              <div className="flex items-center gap-3">
                <EqBars active={isLive} />
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/45">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-accent animate-pulse' : 'bg-primary/25'}`} />
                  {isLive ? 'LIVE' : statusLabel}
                </span>
              </div>
            </div>

            {/* volume + go on air */}
            <div className="flex items-center gap-4 mt-7">
              <button onClick={audio.toggleMute} className="text-primary/40 hover:text-primary transition-colors flex-shrink-0">
                {audio.muted
                  ? <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M19 9l-6 6M13 9l6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                  : <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4"><path d="M11 5L6 9H3v6h3l5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>}
              </button>
              <input type="range" min="0" max="1" step="0.05" value={audio.muted ? 0 : audio.volume}
                onChange={e => { audio.setVolume(Number(e.target.value)); if (audio.muted && Number(e.target.value) > 0) audio.toggleMute(); }}
                className="w-28 h-px appearance-none bg-primary/20 accent-[#C9A66B] cursor-pointer" />
              <span className="w-px h-3 bg-primary/15" />
              <button onClick={audio.toggleAir}
                className={`font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${audio.onAir ? 'text-accent' : 'text-primary/40 hover:text-accent'}`}>
                {audio.onAir ? L.leaveAir : L.goOnAir} →
              </button>
            </div>
          </div>

          {/* portrait */}
          <div className="order-1 md:order-2 relative bg-primary min-h-[260px] md:min-h-[440px] overflow-hidden">
            <img src={heroImage} alt="" className="w-full h-full object-cover grayscale opacity-90" draggable={false}
              onError={e => { (e.currentTarget as HTMLImageElement).src = '/images/home-hero.webp'; }} />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent" />
          </div>
        </div>

        {/* right: now on air */}
        <aside className="px-6 md:px-10 py-10 md:py-12 flex flex-col">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/40 mb-5">{L.nowOnAir}</p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-2">
            {liveBroadcaster ? (nowTitle || L.live) : (nowTitle || 'AM Publishing Radio')}
          </h2>
          {(liveBroadcaster || nowHost) && (
            <p className="font-serif text-lg italic text-accent mb-4">с {liveBroadcaster ? liveBroadcaster.nickname : nowHost}</p>
          )}
          <p className="text-sm text-primary/55 leading-relaxed">{nowDesc || L.heroSubtitle}</p>

          {guest && (
            <>
              <div className="h-px bg-primary/10 my-7" />
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-primary/40 mb-3">{L.guestLabel}</p>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-serif text-xl leading-snug mb-1.5">{guest.name || '—'}</p>
                  {guest.role && <p className="text-xs text-primary/50 leading-relaxed">{guest.role}</p>}
                </div>
                {(guest.time || guest.duration) && (
                  <div className="text-right flex-shrink-0 font-mono text-[10px] text-primary/40 space-y-1 pt-1">
                    {guest.time && <p className="whitespace-nowrap">{guest.time}</p>}
                    {guest.duration && <p className="whitespace-nowrap">{guest.duration}</p>}
                  </div>
                )}
              </div>
              {guest.url && (
                <a href={guest.url} target="_blank" rel="noopener noreferrer"
                  className="inline-block mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-accent hover:underline">Подробнее →</a>
              )}
            </>
          )}
        </aside>
      </section>

      {/* ════ CHAT + SIDEBAR ════ */}
      <section className="grid lg:grid-cols-[1fr_minmax(320px,400px)] border-b border-primary/15">
        {/* chat */}
        <div className="lg:border-r border-primary/15 flex flex-col">
          <div className="flex items-center justify-between px-6 md:px-8 py-5 border-b border-primary/10">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em]">{L.chatTitle}</p>
            <span className="font-mono text-[11px] text-primary/45 flex items-center gap-2">
              {listenersCount} {L.listenersWord}
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-6 md:px-8 py-5 space-y-5 max-h-[480px] min-h-[300px]">
            {loading && <p className="font-mono text-xs text-primary/35 text-center py-12">{L.loading}</p>}
            {!loading && error && <p className="font-mono text-xs text-red-500/70 text-center py-12">{error}</p>}
            {!loading && !error && chatMessages.length === 0 && (
              <p className="font-mono text-xs text-primary/30 text-center py-12">—</p>
            )}
            {chatMessages.map(m => {
              const isOwn = user?.id === m.user_id;
              const likes = m.reactions.reduce((a, r) => a + r.count, 0);
              const reacted = m.reactions.some(r => r.reacted);
              return (
                <div key={m.id} className="group flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0 uppercase"
                    style={{ backgroundColor: m.color || '#1a2840' }}>{m.nickname.slice(0, 2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2.5 mb-1">
                      <span className="font-semibold text-sm" style={{ color: isOwn ? '#C9A66B' : undefined }}>{isOwn ? L.you : m.nickname}</span>
                      <span className="font-mono text-[10px] text-primary/35">{formatTime(m.created_at)}</span>
                      {m.edited_at && <span className="font-mono text-[9px] text-primary/25">({L.edited})</span>}
                    </div>
                    <p className="text-sm text-primary/75 leading-relaxed break-words"><MsgContent text={m.text} /></p>
                  </div>
                  <button onClick={() => handleReact(m.id, '❤️')} title={L.react}
                    className={`flex items-center gap-1.5 flex-shrink-0 mt-0.5 transition-colors ${reacted ? 'text-accent' : 'text-primary/30 hover:text-accent'}`}>
                    <svg viewBox="0 0 24 24" fill={reacted ? 'currentColor' : 'none'} className="w-4 h-4"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 2 4.8 5.3 4.8c2 0 3.3 1.2 4.7 2.9 1.4-1.7 2.7-2.9 4.7-2.9 3.3 0 4.9 3.5 3.3 6.9C19.5 16.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
                    {likes > 0 && <span className="font-mono text-[11px] tabular-nums">{likes}</span>}
                  </button>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-primary/10 px-6 md:px-8 py-4">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2.5 text-xs">
                <span className="w-0.5 self-stretch bg-accent" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-primary/35">{L.replyingTo}</span>
                <span className="font-semibold" style={{ color: replyTo.color }}>{replyTo.nickname}</span>
                <span className="text-primary/40 truncate flex-1">{replyTo.text.slice(0, 50)}</span>
                <button onClick={() => setReplyTo(null)} className="text-primary/30 hover:text-primary flex-shrink-0">✕</button>
              </div>
            )}
            <form onSubmit={e => { e.preventDefault(); sendChat(); }} className="flex items-center gap-3">
              <input value={chatInput} onChange={e => onChatType(e.target.value)} placeholder={L.placeholder} maxLength={2000}
                disabled={!!error}
                className="flex-1 bg-transparent border-b border-primary/15 focus:border-primary/45 py-2.5 text-sm outline-none transition-colors placeholder:text-primary/30" />
              <button type="submit" disabled={!chatInput.trim() || !!error}
                className="w-11 h-11 bg-primary text-white flex items-center justify-center hover:bg-accent hover:text-primary transition-colors flex-shrink-0 disabled:opacity-30">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5"><path d="M4 12l16-8-6 16-3-6-7-2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </form>
            {typing.length > 0 && (
              <p className="font-mono text-[10px] text-primary/35 mt-2">{typing.slice(0, 3).map(t => t.nickname).join(', ')} {L.typing}</p>
            )}
          </div>
        </div>

        {/* sidebar */}
        <aside className="divide-y divide-primary/10">
          {/* schedule */}
          <div className="px-6 md:px-8 py-7">
            <div className="flex items-center justify-between mb-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em]">{L.scheduleLabel}</p>
            </div>
            {cfgSchedule.length > 0 ? (
              <ul className="space-y-5">
                {cfgSchedule.map((row, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="font-mono text-[11px] text-primary/40 tabular-nums pt-0.5 w-12 flex-shrink-0">{row.time || '—'}</span>
                    <div className="min-w-0">
                      <p className="font-serif text-base leading-snug">{row.title}</p>
                      {row.host && <p className="text-xs text-primary/45 mt-0.5 line-clamp-1">{row.host}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : scheduleItems.length > 0 ? (
              <ul className="space-y-5">
                {scheduleItems.map(m => (
                  <li key={m.id} className="flex gap-4">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-accent/80 pt-1 w-12 flex-shrink-0">{m.msg_type === 'podcast' ? 'POD' : 'ANN'}</span>
                    <div className="min-w-0">
                      <p className="font-serif text-base leading-snug">{m.meta_title || m.text?.slice(0, 60) || '—'}</p>
                      {m.meta_description && <p className="text-xs text-primary/45 mt-0.5 line-clamp-1">{m.meta_description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="font-mono text-xs text-primary/35">{L.soonOnAir}</p>}
          </div>

          {/* editor pick / book of week */}
          {bookCard && (
            <div className="px-6 md:px-8 py-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] mb-5">{L.editorPick}</p>
              <a href={bookCard.url || undefined} target={bookCard.url ? '_blank' : undefined} rel="noopener noreferrer"
                className={`flex items-center gap-5 ${bookCard.url ? 'group' : ''}`}>
                <div className="w-16 h-[88px] flex-shrink-0 overflow-hidden bg-primary/5 border border-primary/10">
                  <img src={bookCard.image} alt="" className="w-full h-full object-cover" loading="lazy"
                    onError={e => { (e.currentTarget as HTMLImageElement).src = '/images/ambook-cover.jpg'; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-serif text-lg leading-tight mb-1 group-hover:text-accent transition-colors">{bookCard.title || '—'}</p>
                  <p className="text-xs text-primary/50 mb-2 line-clamp-1">{bookCard.author || L.author}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-primary/35">{L.bookOfWeek}</p>
                </div>
                {!config.book_title && books.length > 1 && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button type="button" onClick={e => { e.preventDefault(); setBookIdx(i => (i - 1 + books.length) % books.length); }} className="w-7 h-7 border border-primary/20 flex items-center justify-center text-primary/50 hover:border-accent hover:text-accent transition-colors">‹</button>
                    <button type="button" onClick={e => { e.preventDefault(); setBookIdx(i => (i + 1) % books.length); }} className="w-7 h-7 border border-primary/20 flex items-center justify-center text-primary/50 hover:border-accent hover:text-accent transition-colors">›</button>
                  </div>
                )}
              </a>
            </div>
          )}

          {/* latest podcast */}
          {latestPodcast && (
            <div className="px-6 md:px-8 py-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] mb-5">{L.latestPodcastLabel}</p>
              <div className="flex items-center gap-4">
                <a href={latestPodcast.meta_url || '#'} target="_blank" rel="noopener noreferrer"
                  className="w-12 h-12 rounded-full border border-primary/25 flex items-center justify-center text-primary/60 hover:border-accent hover:text-accent transition-colors flex-shrink-0">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5"><path d="M8 5.5l12 6.5-12 6.5V5.5Z" /></svg>
                </a>
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-tight">{latestPodcast.meta_title || '—'}</p>
                  {latestPodcast.meta_description && <p className="text-xs text-primary/45 line-clamp-1">{latestPodcast.meta_description}</p>}
                  <p className="font-mono text-[9px] uppercase tracking-widest text-accent mt-1.5">{L.listenWord} →</p>
                </div>
              </div>
            </div>
          )}

          {/* telegram */}
          <a href={tgUrl} target="_blank" rel="noopener noreferrer"
            className="group flex items-center justify-between px-6 md:px-8 py-7 hover:bg-primary/[0.03] transition-colors">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.25em] mb-1.5">{L.weInTelegram}</p>
              <p className="text-sm text-primary/55 group-hover:text-primary transition-colors">{tgHandle}</p>
            </div>
            <span className="text-accent text-lg group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">↗</span>
          </a>
        </aside>
      </section>

      {/* ════ LATEST BROADCASTS ════ */}
      <section className="px-6 md:px-10 lg:px-12 py-10 md:py-14">
        <div className="flex items-center justify-between mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em]">{L.latestBroadcasts}</p>
          {broadcasts.length > 2 && (
            <div className="flex gap-2">
              <button onClick={() => carouselRef.current?.scrollBy({ left: -320, behavior: 'smooth' })}
                className="w-9 h-9 border border-primary/20 flex items-center justify-center text-primary/50 hover:border-accent hover:text-accent transition-colors">‹</button>
              <button onClick={() => carouselRef.current?.scrollBy({ left: 320, behavior: 'smooth' })}
                className="w-9 h-9 border border-primary/20 flex items-center justify-center text-primary/50 hover:border-accent hover:text-accent transition-colors">›</button>
            </div>
          )}
        </div>
        {broadcasts.length > 0 ? (
          <div ref={carouselRef} className="flex gap-6 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none' }}>
            {broadcasts.map(m => (
              <article key={m.id} className="w-[260px] md:w-[280px] flex-shrink-0 snap-start group">
                <div className="relative aspect-[4/3] overflow-hidden bg-primary mb-4">
                  <img src={m.meta_image || '/images/ambook-object.jpg'} alt="" loading="lazy"
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                  <a href={m.meta_url || '#'} target="_blank" rel="noopener noreferrer"
                    className="absolute inset-0 flex items-center justify-center bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <span className="w-12 h-12 rounded-full border-2 border-white/80 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 ml-0.5"><path d="M8 5.5l12 6.5-12 6.5V5.5Z" /></svg>
                    </span>
                  </a>
                </div>
                <p className="font-mono text-[9px] uppercase tracking-widest text-accent mb-1.5">{m.msg_type === 'podcast' ? L.typePodcast : L.typeAnnouncement}</p>
                <h3 className="font-serif text-lg leading-tight mb-1">{m.meta_title || m.text?.slice(0, 50) || '—'}</h3>
                {m.meta_description && <p className="text-xs text-primary/45 line-clamp-1">{m.meta_description}</p>}
              </article>
            ))}
          </div>
        ) : <p className="font-mono text-xs text-primary/35">{L.noBroadcasts}</p>}
      </section>

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
