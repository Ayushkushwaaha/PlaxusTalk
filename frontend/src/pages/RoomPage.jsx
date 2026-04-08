import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from '../lib/AuthContext';
import { getSocket } from '../lib/socket';
import StatsPanel from '../components/StatsPanel';
import WalletButton from '../components/WalletButton';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ── Screen Share ──────────────────────────────────────────────────────────────
function useScreenShare(localVideoRef, localStreamRef, pcRef) {
  const [isSharing, setIsSharing] = useState(false);
  const screenRef = useRef(null);
  const start = useCallback(async () => {
    try {
      const ss = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      screenRef.current = ss;
      const track = ss.getVideoTracks()[0];
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(track);
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = new MediaStream([track, ...(localStreamRef.current?.getAudioTracks() || [])]);
      track.onended = stop;
      setIsSharing(true);
    } catch (err) { if (err.name !== 'NotAllowedError') console.error(err); }
  }, [localVideoRef, localStreamRef, pcRef]);
  const stop = useCallback(async () => {
    screenRef.current?.getTracks().forEach(t => t.stop());
    const cam = localStreamRef.current?.getVideoTracks()[0];
    if (pcRef.current && cam) { const s = pcRef.current.getSenders().find(s => s.track?.kind === 'video'); if (s) await s.replaceTrack(cam); }
    if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    setIsSharing(false);
  }, [localVideoRef, localStreamRef, pcRef]);
  return { isSharing, toggleScreenShare: () => isSharing ? stop() : start() };
}

// ── Recording ─────────────────────────────────────────────────────────────────
function useRecording(localVideoRef) {
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);
  const recRef = useRef(null); const chunksRef = useRef([]); const timerRef = useRef(null);
  const start = useCallback(async () => {
    try {
      const stream = localVideoRef.current?.srcObject;
      if (!stream) return;
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recRef.current = rec; chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => { const url = URL.createObjectURL(new Blob(chunksRef.current, { type: 'video/webm' })); Object.assign(document.createElement('a'), { href: url, download: `PlexusTalk-${Date.now()}.webm` }).click(); URL.revokeObjectURL(url); };
      rec.start(1000); setIsRecording(true); setRecTime(0);
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000);
    } catch (e) { console.error(e); }
  }, [localVideoRef]);
  const stop = useCallback(() => { recRef.current?.stop(); clearInterval(timerRef.current); setIsRecording(false); setRecTime(0); }, []);
  const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  return { isRecording, recTime, fmt, toggle: () => isRecording ? stop() : start() };
}

// ── FIX: Chat Box — messages relay via socket ─────────────────────────────────
function ChatBox({ roomId, user, socket, compact }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    // FIX: Listen for chat messages from peer
    const onMsg = (msg) => {
      setMessages(prev => {
        // Avoid duplicate if we somehow receive our own
        if (msg.senderId === user?.id && msg.isSelf) return prev;
        return [...prev, { ...msg, isSelf: false }];
      });
    };
    socket.on('chat-message', onMsg);
    return () => socket.off('chat-message', onMsg);
  }, [socket, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const msg = {
      text: input.trim(),
      sender: user?.name || 'You',
      senderId: user?.id || socket.id,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      id: Date.now(),
    };
    // Add to own messages immediately
    setMessages(prev => [...prev, { ...msg, isSelf: true }]);
    // FIX: Emit to backend which relays to peer
    socket.emit('chat-message', { roomId: roomId?.toUpperCase(), message: msg });
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: compact ? '8px' : '12px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(74,74,92,0.5)', fontFamily: 'monospace' }}>No messages yet — say hello!</span>
          </div>
        ) : messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.isSelf ? 'flex-end' : 'flex-start', gap: '3px' }}>
            <div style={{
              maxWidth: '85%', padding: compact ? '6px 10px' : '8px 12px',
              fontSize: compact ? '12px' : '13px', lineHeight: 1.5,
              borderRadius: m.isSelf ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: m.isSelf ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${m.isSelf ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.1)'}`,
              color: '#e8e8f0', wordBreak: 'break-word',
            }}>{m.text}</div>
            <span style={{ fontSize: '10px', color: '#4a4a5c' }}>{m.sender} · {m.time}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.07)', padding: '6px 8px', gap: '6px', flexShrink: 0 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="Type a message..."
          style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', color: '#e8e8f0', fontSize: '13px', padding: '8px 14px', outline: 'none' }} />
        <button onClick={send}
          style={{ background: 'linear-gradient(135deg,rgba(0,255,136,0.3),rgba(0,200,100,0.3))', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '50%', width: '36px', height: '36px', color: '#00ff88', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ➤
        </button>
      </div>
    </div>
  );
}

// ── FIX: Emoji Reactions — broadcast to peer ──────────────────────────────────
const EMOJIS = ['👍','❤️','😂','😮','👏','🔥','🎉','😢'];

function ReactionsBar({ roomId, socket }) {
  const [floating, setFloating] = useState([]); // [{id, emoji, x}]

  // FIX: Listen for reactions from peer
  useEffect(() => {
    const onReaction = ({ emoji }) => {
      spawnFloat(emoji, false);
    };
    socket.on('reaction', onReaction);
    return () => socket.off('reaction', onReaction);
  }, [socket]);

  const spawnFloat = (emoji, isSelf) => {
    const id = Date.now() + Math.random();
    const x = 30 + Math.random() * 40; // random horizontal %
    setFloating(prev => [...prev, { id, emoji, x, isSelf }]);
    setTimeout(() => setFloating(prev => prev.filter(f => f.id !== id)), 2500);
  };

  const sendReaction = (emoji) => {
    spawnFloat(emoji, true);
    // FIX: Emit reaction to backend which relays to peer
    socket.emit('reaction', { roomId: roomId?.toUpperCase(), emoji });
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Floating emojis */}
      {floating.map(f => (
        <div key={f.id} style={{
          position: 'fixed', bottom: '120px', left: `${f.x}%`,
          fontSize: '36px', pointerEvents: 'none', zIndex: 9999,
          animation: 'floatUp 2.5s ease forwards',
        }}>{f.emoji}</div>
      ))}
      {/* Emoji buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {EMOJIS.map(e => (
          <button key={e} onClick={() => sendReaction(e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '2px 4px', transition: 'transform 0.15s', borderRadius: '8px' }}
            onMouseOver={ev => ev.currentTarget.style.transform = 'scale(1.35)'}
            onMouseOut={ev => ev.currentTarget.style.transform = 'scale(1)'}>
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Control Button ────────────────────────────────────────────────────────────
function Btn({ onClick, active, danger, title, children, wide, activeColor }) {
  const [h, setH] = useState(false);
  const ac = activeColor || 'rgba(255,107,53,0.55)';
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: wide ? '52px' : '44px', height: '44px',
        borderRadius: danger ? '14px' : '50%', border: 'none', cursor: 'pointer', fontSize: '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: danger ? 'linear-gradient(135deg,#ef4444,#dc2626)'
          : active ? (activeColor ? activeColor.replace('0.55', '0.2').replace('0.6', '0.2') : 'rgba(255,107,53,0.2)')
          : h ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
        boxShadow: danger ? '0 4px 14px rgba(239,68,68,0.4)' : active ? `0 0 0 2px ${ac}` : 'none',
        transition: 'all 0.2s', transform: h ? 'scale(1.06)' : 'scale(1)',
      }}>
      {children}
    </button>
  );
}

// ── FIX: Mobile Chat Drawer (half screen, swipeable) ─────────────────────────
function MobileChatDrawer({ open, onClose, roomId, user, socket }) {
  const [height, setHeight] = useState('50vh'); // half or full
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    setExpanded(e => !e);
    setHeight(h => h === '50vh' ? '85vh' : '50vh');
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 299, backdropFilter: 'blur(2px)' }} />
      {/* Drawer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height, zIndex: 300,
        background: 'rgba(10,10,16,0.98)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 6px', flexShrink: 0 }}>
          {/* Drag handle */}
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)', margin: '0 auto', position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '10px' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c', letterSpacing: '0.2em' }}>💬 CHAT</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Expand/collapse button */}
            <button onClick={toggle}
              style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '16px', padding: '2px' }}>
              {expanded ? '▼' : '▲'}
            </button>
            {/* Close button */}
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '18px', padding: '2px' }}>
              ✕
            </button>
          </div>
        </div>
        {/* Chat content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ChatBox roomId={roomId} user={user} socket={socket} compact />
        </div>
      </div>
    </>
  );
}

// ── Main RoomPage ─────────────────────────────────────────────────────────────
export default function RoomPage() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const socket     = getSocket();

  const [hasJoined,  setHasJoined]  = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [sideTab,    setSideTab]    = useState('chat');
  const [chatOpen,   setChatOpen]   = useState(false); // mobile drawer
  const [menuOpen,   setMenuOpen]   = useState(false);
  const menuRef = useRef(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const {
    localVideoRef, remoteVideoRef, connectionState, iceState,
    isAudioMuted, isVideoOff, latency, isP2P, peerCount, callId,
    joinRoom, toggleAudio, toggleVideo, hangUp, localStreamRef, pcRef,
  } = useWebRTC(roomId);

  const { isSharing, toggleScreenShare } = useScreenShare(localVideoRef, localStreamRef, pcRef);
  const { isRecording, recTime, fmt, toggle: toggleRec } = useRecording(localVideoRef);

  // Auto-disconnect when peer leaves
  useEffect(() => {
    const onLeft = ({ userCount }) => { if (userCount === 0) setTimeout(() => { hangUp(); navigate('/'); }, 3000); };
    socket.on('peer-left', onLeft);
    socket.on('room-ended', () => { hangUp(); navigate('/'); });
    return () => { socket.off('peer-left', onLeft); socket.off('room-ended'); };
  }, [socket, navigate, hangUp]);

  // Close menu on outside click
  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!hasJoined) { setHasJoined(true); joinRoom(null, user?.id, user?.name); }
  }, []);

  const handleHangUp = () => { hangUp(); navigate('/'); };
  const copyLink = () => { navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const isConnected = connectionState === 'connected';

  // ── Shared video tiles ─────────────────────────────────────────────────────
  const RemoteVideo = () => (
    <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
      <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      {(!isConnected || peerCount < 2) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(77,166,255,0.12)', border: '1px solid rgba(77,166,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#4da6ff' }}>?</div>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c', letterSpacing: '0.15em' }}>AWAITING PEER...</span>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#4da6ff' : '#4a4a5c' }} />
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.65)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>REMOTE PEER</span>
      </div>
    </div>
  );

  const LocalVideo = () => (
    <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#0a0a10', border: '1px solid rgba(0,255,136,0.15)', height: '100%' }}>
      {isVideoOff ? (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0,255,136,0.12)', border: '2px solid rgba(0,255,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', color: '#00ff88', fontSize: '24px', fontWeight: 700 }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4a4a5c', letterSpacing: '0.1em' }}>CAM OFF</span>
        </div>
      ) : (
        <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', transform: 'scaleX(-1)' }} />
      )}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.65)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
          {isSharing ? 'YOU (SCREEN)' : 'YOU'}
        </span>
      </div>
    </div>
  );

  // ── Shared control bar ─────────────────────────────────────────────────────
  const ControlBar = () => (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50px', padding: '8px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
        <Btn onClick={toggleAudio} active={isAudioMuted} title="Mute">{isAudioMuted ? '🔇' : '🎤'}</Btn>
        <Btn onClick={toggleVideo} active={isVideoOff} title="Camera">{isVideoOff ? '📷' : '📹'}</Btn>
        <Btn onClick={toggleScreenShare} active={isSharing} activeColor="rgba(77,166,255,0.6)" title="Share">🖥</Btn>
        {/* FIX: Chat button opens drawer on mobile, switches tab on desktop */}
        <Btn onClick={() => isMobile ? setChatOpen(true) : setSideTab('chat')} active={isMobile ? chatOpen : sideTab === 'chat'} activeColor="rgba(0,255,136,0.6)" title="Chat">💬</Btn>
        <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
        <Btn onClick={handleHangUp} danger wide title="Leave">📵</Btn>
        <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
        <Btn onClick={toggleRec} active={isRecording} activeColor="rgba(255,107,53,0.6)" title="Record">{isRecording ? '⏹' : '⏺'}</Btn>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <Btn onClick={() => setMenuOpen(o => !o)} active={menuOpen} title="More">⋮</Btn>
          {menuOpen && (
            <div style={{ position: 'absolute', bottom: '54px', right: 0, width: '205px', background: '#0d0d12', border: '1px solid #1a1a24', borderRadius: '14px', overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.7)' }}>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c', letterSpacing: '0.2em' }}>MORE OPTIONS</span>
              </div>
              {[
                { icon: '🔗', label: copied ? 'Copied!' : 'Copy invite link', action: () => { copyLink(); setMenuOpen(false); } },
                { icon: isSharing ? '⏹' : '🖥', label: isSharing ? 'Stop sharing' : 'Share screen', action: () => { toggleScreenShare(); setMenuOpen(false); } },
                { icon: isRecording ? '⏹' : '⏺', label: isRecording ? 'Stop recording' : 'Start recording', action: () => { toggleRec(); setMenuOpen(false); } },
                { icon: '💬', label: 'Open chat', action: () => { isMobile ? setChatOpen(true) : setSideTab('chat'); setMenuOpen(false); } },
                { icon: '📊', label: 'View stats', action: () => { setSideTab('stats'); setMenuOpen(false); } },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', color: '#e8e8f0', textAlign: 'left', fontSize: '12px', transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#060608', overflow: 'hidden', color: '#e8e8f0' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'rgba(10,10,16,0.95)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px' }}>←</button>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00ff88', letterSpacing: '0.1em' }}>{roomId}</span>
            <span onClick={copyLink} style={{ color: '#4a4a5c', cursor: 'pointer', fontSize: '13px' }}>{copied ? '✓' : '⎘'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isRecording && <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff6b35' }}>⏺ {fmt(recTime)}</span>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isConnected ? 'rgba(0,255,136,0.08)' : 'rgba(255,107,53,0.08)', border: `1px solid ${isConnected ? 'rgba(0,255,136,0.2)' : 'rgba(255,107,53,0.2)'}`, padding: '3px 8px', borderRadius: '20px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: isConnected ? '#00ff88' : '#ff6b35' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: isConnected ? '#00ff88' : '#ff6b35' }}>{peerCount}/2</span>
            </div>
          </div>
        </div>

        {/* Videos side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '8px', flexShrink: 0, height: '220px' }}>
          <RemoteVideo />
          <LocalVideo />
        </div>

        {/* FIX: Emoji reactions — full width, properly spaced */}
        <div style={{ padding: '4px 8px', flexShrink: 0 }}>
          <ReactionsBar roomId={roomId} socket={socket} />
        </div>

        {/* Controls */}
        <div style={{ padding: '6px 8px', flexShrink: 0 }}>
          <ControlBar />
        </div>

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', padding: '6px 8px', flexShrink: 0 }}>
          <div style={{ background: 'rgba(13,13,18,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c' }}>LATENCY</span>
            <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: '#ffd700' }}>{latency ? `${latency}ms` : '--'}</span>
          </div>
          <div style={{ background: 'rgba(13,13,18,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c' }}>CONNECTION</span>
            <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: isP2P ? '#00ff88' : '#4da6ff' }}>{isP2P ? 'P2P' : 'RELAY'}</span>
          </div>
        </div>

        {/* Invite section */}
        <div style={{ padding: '0 8px 8px', flexShrink: 0 }}>
          <button onClick={copyLink} style={{ width: '100%', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.2)', color: '#00ff88', fontFamily: 'monospace', fontSize: '10px', padding: '8px', borderRadius: '8px', cursor: 'pointer', letterSpacing: '0.1em' }}>
            {copied ? '✓ COPIED!' : `⎘ COPY INVITE LINK · ${roomId}`}
          </button>
        </div>

        {/* FIX: Mobile chat drawer — half screen, expandable */}
        <MobileChatDrawer
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          roomId={roomId}
          user={user}
          socket={socket}
        />

        <style>{`
          @keyframes floatUp { 0%{opacity:1;transform:translateY(0) scale(1)} 100%{opacity:0;transform:translateY(-150px) scale(1.4)} }
          @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        `}</style>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#060608', overflow: 'hidden', color: '#e8e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em' }}>← PLEXUSTALK</button>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c' }}>ROOM</span>
          <button onClick={copyLink} style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.12em' }}>{roomId}</button>
          <span onClick={copyLink} style={{ cursor: 'pointer', color: '#4a4a5c' }}>{copied ? '✓' : '⎘'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user && <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c' }}>{user.name?.toUpperCase()}</span>}
          {isRecording && <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', padding: '4px 10px', borderRadius: '20px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff6b35', animation: 'blink 1s infinite' }} /><span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff6b35' }}>REC {fmt(recTime)}</span></div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: isConnected ? 'rgba(0,255,136,0.08)' : 'rgba(255,107,53,0.08)', border: `1px solid ${isConnected ? 'rgba(0,255,136,0.2)' : 'rgba(255,107,53,0.2)'}`, padding: '5px 12px', borderRadius: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#00ff88' : '#ff6b35' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: isConnected ? '#00ff88' : '#ff6b35' }}>{connectionState.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '10px', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minHeight: 0 }}>
            <RemoteVideo />
            <LocalVideo />
          </div>
          {/* FIX: Emoji reactions */}
          <div style={{ flexShrink: 0 }}>
            <ReactionsBar roomId={roomId} socket={socket} />
          </div>
          <div style={{ flexShrink: 0 }}><ControlBar /></div>
          <div style={{ flexShrink: 0 }}>
            <StatsPanel latency={latency} isP2P={isP2P} connectionState={connectionState} iceState={iceState} peerCount={peerCount} callId={callId} />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: '275px', borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,10,16,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.2em' }}>SESSION PANEL</span>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {['chat', 'info'].map(t => (
              <button key={t} onClick={() => setSideTab(t)}
                style={{ flex: 1, padding: '9px', background: sideTab === t ? 'rgba(0,255,136,0.06)' : 'none', border: 'none', borderBottom: sideTab === t ? '2px solid #00ff88' : '2px solid transparent', color: sideTab === t ? '#00ff88' : '#4a4a5c', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'all 0.2s' }}>
                {t === 'chat' ? '💬 Chat' : '⚙ Info'}
              </button>
            ))}
          </div>

          {sideTab === 'chat' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <ChatBox roomId={roomId} user={user} socket={socket} />
            </div>
          )}

          {sideTab === 'info' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div style={{ width: '14px', height: '2px', background: 'rgba(0,255,136,0.4)', borderRadius: '1px' }} /><span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(0,255,136,0.6)', letterSpacing: '0.2em' }}>BLOCKCHAIN</span></div>
                <WalletButton onWalletConnected={addr => socket.emit('update-wallet', { roomId, wallet: addr })} currentUser={user} roomId={roomId} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div style={{ width: '14px', height: '2px', background: 'rgba(0,255,136,0.4)', borderRadius: '1px' }} /><span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(0,255,136,0.6)', letterSpacing: '0.2em' }}>INVITE</span></div>
                <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c', letterSpacing: '0.15em', marginBottom: '4px' }}>ROOM ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '18px', color: '#00ff88', letterSpacing: '0.12em', fontWeight: 700 }}>{roomId}</div>
                </div>
                <button onClick={copyLink} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(0,255,136,0.25)', color: '#00ff88', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.12em', padding: '8px', cursor: 'pointer', borderRadius: '8px' }}>{copied ? '✓ COPIED' : '⎘ COPY LINK'}</button>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><div style={{ width: '14px', height: '2px', background: 'rgba(0,255,136,0.4)', borderRadius: '1px' }} /><span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(0,255,136,0.6)', letterSpacing: '0.2em' }}>LIVE STATS</span></div>
                {[['Screen Share', isSharing ? 'ACTIVE' : 'OFF', isSharing ? '#00ff88' : '#4a4a5c'],['Recording', isRecording ? fmt(recTime) : 'OFF', isRecording ? '#ff6b35' : '#4a4a5c'],['Connection', connectionState.toUpperCase(), isConnected ? '#00ff88' : '#ff6b35'],['Peers', `${peerCount}/2`, '#e8e8f0']].map(([k,v,c]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c' }}>{k}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', color: c, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-150px) scale(1.4)}}
      `}</style>
    </div>
  );
}
