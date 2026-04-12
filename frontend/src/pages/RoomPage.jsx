import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from '../lib/AuthContext';
import { getSocket } from '../lib/socket';
import StatsPanel from '../components/StatsPanel';
import WalletButton from '../components/WalletButton';
import PersistentChat from '../components/PersistentChat';

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
      track.onended = () => stop();
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

// ── Reactions ─────────────────────────────────────────────────────────────────
const EMOJIS = ['👍','❤️','😂','😮','👏','🔥','🎉','😢'];
function ReactionsBar({ roomId, socket }) {
  const [floating, setFloating] = useState([]);
  useEffect(() => {
    const onReaction = ({ emoji }) => spawnFloat(emoji);
    socket.on('reaction', onReaction);
    return () => socket.off('reaction', onReaction);
  }, [socket]);
  const spawnFloat = (emoji) => {
    const id = Date.now() + Math.random();
    setFloating(prev => [...prev, { id, emoji, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setFloating(prev => prev.filter(f => f.id !== id)), 2500);
  };
  const sendReaction = (emoji) => { spawnFloat(emoji); socket.emit('reaction', { roomId: roomId?.toUpperCase(), emoji }); };
  return (
    <div>
      {floating.map(f => (
        <div key={f.id} style={{ position: 'fixed', bottom: '140px', left: `${f.x}%`, fontSize: '36px', pointerEvents: 'none', zIndex: 9999, animation: 'floatUp 2.5s ease forwards' }}>{f.emoji}</div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {EMOJIS.map(e => (
          <button key={e} onClick={() => sendReaction(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', padding: '2px', transition: 'transform 0.15s' }}
            onMouseOver={ev => ev.currentTarget.style.transform = 'scale(1.35)'}
            onMouseOut={ev => ev.currentTarget.style.transform = 'scale(1)'}>{e}</button>
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
    <button onClick={onClick} title={title} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: wide ? '52px' : '46px', height: '46px',
        borderRadius: danger ? '16px' : '50%', border: 'none', cursor: 'pointer', fontSize: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        background: danger ? 'linear-gradient(135deg,#ef4444,#dc2626)' : active ? 'rgba(255,107,53,0.2)' : h ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
        boxShadow: danger ? '0 4px 16px rgba(239,68,68,0.5)' : active ? `0 0 0 2px ${ac}` : 'none',
        transition: 'all 0.2s', transform: h ? 'scale(1.08)' : 'scale(1)',
      }}>{children}</button>
  );
}

// ── WhatsApp-style Draggable Local PiP ────────────────────────────────────────
function DraggablePiP({ setLocalVideoRef, isVideoOff, user, isAudioMuted }) {
  const [pos, setPos] = useState({ x: null, y: null }); // null = default top-right
  const dragging = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const startTouch = useRef({ x: 0, y: 0 });
  const pipRef = useRef(null);

  const PIP_W = 110;
  const PIP_H = 160;

  // Default position: top-right corner
  const getDefaultStyle = () => ({
    position: 'absolute',
    top: pos?.y != null ? `${pos.y}px` : '16px',
    left: pos?.x != null ? `${pos.x}px` : 'auto',
    right: pos?.x != null ? 'auto' : '16px',
    width: `${PIP_W}px`,
    height: `${PIP_H}px`,
    zIndex: 50,
    borderRadius: '16px',
    overflow: 'hidden',
    border: '2px solid rgba(0,255,136,0.5)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
    background: '#0a0a10',
  });

  const onTouchStart = (e) => {
    dragging.current = true;
    const rect = pipRef.current.getBoundingClientRect();
    startTouch.current = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
  };

  const onTouchMove = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const parentRect = pipRef.current.parentElement.getBoundingClientRect();
    let newX = e.touches[0].clientX - parentRect.left - startTouch.current.x;
    let newY = e.touches[0].clientY - parentRect.top - startTouch.current.y;
    // Clamp within parent
    newX = Math.max(0, Math.min(newX, parentRect.width - PIP_W));
    newY = Math.max(0, Math.min(newY, parentRect.height - PIP_H));
    setPos({ x: newX, y: newY });
  };

  const onTouchEnd = () => { dragging.current = false; };

  const onMouseDown = (e) => {
    dragging.current = true;
    const rect = pipRef.current.getBoundingClientRect();
    startPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    pipRef.current.style.cursor = 'grabbing';
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!dragging.current || !pipRef.current) return;
      const parentRect = pipRef.current.parentElement.getBoundingClientRect();
      let newX = e.clientX - parentRect.left - startPos.current.x;
      let newY = e.clientY - parentRect.top - startPos.current.y;
      newX = Math.max(0, Math.min(newX, parentRect.width - PIP_W));
      newY = Math.max(0, Math.min(newY, parentRect.height - PIP_H));
      setPos({ x: newX, y: newY });
    };
    const onMouseUp = () => {
      dragging.current = false;
      if (pipRef.current) pipRef.current.style.cursor = 'grab';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  return (
    <div ref={pipRef} style={getDefaultStyle()}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}>
      {/* Always render video element */}
      <video ref={setLocalVideoRef} autoPlay playsInline muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)', background: '#000' }} />
      {isVideoOff && (
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '2px solid rgba(0,255,136,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00ff88', fontFamily: 'monospace', fontSize: '16px', fontWeight: 700 }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <span style={{ fontSize: '9px', color: '#4a4a5c', fontFamily: 'monospace' }}>CAM OFF</span>
        </div>
      )}
      {isAudioMuted && (
        <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(255,107,53,0.9)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>🔇</div>
      )}
      {/* Drag hint */}
      <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '2px' }}>
        {[0,1,2].map(i => <div key={i} style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />)}
      </div>
    </div>
  );
}

// ── Mobile Chat Drawer — half screen ──────────────────────────────────────────
function MobileChatDrawer({ open, onClose, roomId, user, socket }) {
  const [expanded, setExpanded] = useState(false);
  if (!open) return null;
  const height = expanded ? '85vh' : '50vh';
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299, backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height, zIndex: 300, background: 'rgba(8,8,14,0.98)', borderTop: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column', transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 -12px 40px rgba(0,0,0,0.6)' }}>
        {/* Handle bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 8px', flexShrink: 0 }}>
          <div onClick={() => setExpanded(e => !e)} style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', width: '40px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.25)', cursor: 'pointer' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c', letterSpacing: '0.2em', marginTop: '8px' }}>💬 MESSAGES</span>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '16px' }}>{expanded ? '▼' : '▲'}</button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '18px' }}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <PersistentChat roomId={roomId} user={user} socket={socket} compact />
        </div>
      </div>
    </>
  );
}

// ── Main RoomPage ─────────────────────────────────────────────────────────────
export default function RoomPage() {
  const { roomId }  = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const socket      = getSocket();
  const menuRef     = useRef(null);

  const [hasJoined, setHasJoined] = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [sideTab,   setSideTab]   = useState('chat');
  const [chatOpen,  setChatOpen]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const {
    setLocalVideoRef, setRemoteVideoRef,
    localVideoRef, remoteVideoRef,
    localStreamRef, pcRef,
    connectionState, iceState,
    isAudioMuted, isVideoOff,
    latency, isP2P, peerCount, callId,
    joinRoom, toggleAudio, toggleVideo, hangUp,
  } = useWebRTC(roomId);

  const { isSharing, toggleScreenShare } = useScreenShare(localVideoRef, localStreamRef, pcRef);
  const { isRecording, recTime, fmt, toggle: toggleRec } = useRecording(localVideoRef);
  const isConnected = connectionState === 'connected';

  useEffect(() => {
    const onLeft = ({ userCount }) => { if (userCount === 0) setTimeout(() => { hangUp(); navigate('/'); }, 3000); };
    socket.on('peer-left', onLeft);
    socket.on('room-ended', () => { hangUp(); navigate('/'); });
    return () => { socket.off('peer-left', onLeft); socket.off('room-ended'); };
  }, [socket, navigate, hangUp]);

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

  // ── MOBILE LAYOUT — WhatsApp style ────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ height: '100vh', width: '100vw', position: 'relative', background: '#060608', overflow: 'hidden', color: '#e8e8f0' }}>

        {/* FULL SCREEN REMOTE VIDEO */}
        <div style={{ position: 'absolute', inset: 0, background: '#0a0a10' }}>
          <video ref={setRemoteVideoRef} autoPlay playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {(!isConnected || peerCount < 2) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'linear-gradient(180deg,#060608,#0a0a14)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(77,166,255,0.12)', border: '2px solid rgba(77,166,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: '#4da6ff', animation: 'pulse 2s infinite' }}>?</div>
              <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#4a4a5c', letterSpacing: '0.2em' }}>WAITING FOR PEER...</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0,1,2].map(i => <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4da6ff', animation: `bounce 1.4s ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          )}
        </div>

        {/* TOP BAR */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, padding: '12px 16px', background: 'linear-gradient(180deg,rgba(0,0,0,0.7),transparent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={() => navigate('/')} style={{ background: 'rgba(0,0,0,0.4)', border: 'none', color: '#fff', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            <div>
              <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00ff88', letterSpacing: '0.1em', lineHeight: 1 }}>{roomId}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>{isConnected ? 'Connected' : connectionState}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isRecording && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,107,53,0.2)', border: '1px solid rgba(255,107,53,0.4)', padding: '4px 8px', borderRadius: '20px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff6b35', animation: 'blink 1s infinite' }} />
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff6b35' }}>{fmt(recTime)}</span>
              </div>
            )}
            <div style={{ background: isConnected ? 'rgba(0,255,136,0.15)' : 'rgba(255,107,53,0.15)', border: `1px solid ${isConnected ? 'rgba(0,255,136,0.3)' : 'rgba(255,107,53,0.3)'}`, padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: isConnected ? '#00ff88' : '#ff6b35' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: isConnected ? '#00ff88' : '#ff6b35' }}>{peerCount}/2</span>
            </div>
          </div>
        </div>

        {/* DRAGGABLE LOCAL PiP — WhatsApp style */}
        <DraggablePiP
          setLocalVideoRef={setLocalVideoRef}
          isVideoOff={isVideoOff}
          user={user}
          isAudioMuted={isAudioMuted}
        />

        {/* BOTTOM GRADIENT + CONTROLS */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40, background: 'linear-gradient(0deg,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.6) 60%,transparent 100%)', padding: '16px 16px 32px' }}>

          {/* Reactions */}
          <div style={{ marginBottom: '14px' }}>
            <ReactionsBar roomId={roomId} socket={socket} />
          </div>

          {/* Main control row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
            <Btn onClick={toggleAudio} active={isAudioMuted} title="Mute">{isAudioMuted ? '🔇' : '🎤'}</Btn>
            <Btn onClick={toggleVideo} active={isVideoOff} title="Camera">{isVideoOff ? '📷' : '📹'}</Btn>
            <Btn onClick={toggleScreenShare} active={isSharing} activeColor="rgba(77,166,255,0.6)" title="Share screen">🖥</Btn>
            {/* Chat button — opens half-screen drawer */}
            <Btn onClick={() => setChatOpen(true)} active={chatOpen} activeColor="rgba(0,255,136,0.6)" title="Chat">💬</Btn>
            {/* Big red hang up */}
            <Btn onClick={handleHangUp} danger wide title="Leave call">📵</Btn>
            <Btn onClick={toggleRec} active={isRecording} activeColor="rgba(255,107,53,0.6)" title="Record">{isRecording ? '⏹' : '⏺'}</Btn>
            {/* 3-dot menu */}
            <div style={{ position: 'relative' }} ref={menuRef}>
              <Btn onClick={() => setMenuOpen(o => !o)} active={menuOpen} title="More">⋮</Btn>
              {menuOpen && (
                <div style={{ position: 'absolute', bottom: '56px', right: '-8px', width: '210px', background: 'rgba(13,13,20,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c', letterSpacing: '0.2em' }}>MORE OPTIONS</span>
                  </div>
                  {[
                    { icon: '🔗', label: copied ? 'Copied!' : 'Copy invite link', action: () => { copyLink(); setMenuOpen(false); } },
                    { icon: isSharing ? '⏹' : '🖥', label: isSharing ? 'Stop sharing' : 'Share screen', action: () => { toggleScreenShare(); setMenuOpen(false); } },
                    { icon: isRecording ? '⏹' : '⏺', label: isRecording ? 'Stop recording' : 'Start recording', action: () => { toggleRec(); setMenuOpen(false); } },
                    { icon: '💬', label: 'Open chat', action: () => { setChatOpen(true); setMenuOpen(false); } },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', color: '#e8e8f0', textAlign: 'left', fontSize: '13px' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                      onMouseOut={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ fontSize: '16px', width: '22px', textAlign: 'center' }}>{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Copy link bar */}
          <button onClick={copyLink} style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace', fontSize: '10px', padding: '8px', borderRadius: '10px', cursor: 'pointer', letterSpacing: '0.1em' }}>
            {copied ? '✓ LINK COPIED!' : `⎘ SHARE · ${roomId}`}
          </button>
        </div>

        {/* Half-screen chat drawer */}
        <MobileChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} roomId={roomId} user={user} socket={socket} />

        <style>{`
          @keyframes floatUp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-180px) scale(1.5)}}
          @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
          @keyframes pulse{0%,100%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
          @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
        `}</style>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────────────────────────────────
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '10px', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', minHeight: 0 }}>
            {/* Remote */}
            <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.07)', height: '100%' }}>
              <video ref={setRemoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              {(!isConnected || peerCount < 2) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#0a0a10' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(77,166,255,0.12)', border: '1px solid rgba(77,166,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#4da6ff' }}>?</div>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c', letterSpacing: '0.15em' }}>AWAITING PEER...</span>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '5px', zIndex: 2 }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#4da6ff' : '#4a4a5c' }} />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.65)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>REMOTE PEER</span>
              </div>
            </div>
            {/* Local */}
            <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#0a0a10', border: '1px solid rgba(0,255,136,0.2)', height: '100%' }}>
              <video ref={setLocalVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', transform: 'scaleX(-1)', background: '#000' }} />
              {isVideoOff && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', background: '#0a0a10' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(0,255,136,0.12)', border: '2px solid rgba(0,255,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', color: '#00ff88', fontSize: '24px', fontWeight: 700 }}>{user?.name?.charAt(0)?.toUpperCase() || 'A'}</div>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4a4a5c', letterSpacing: '0.1em' }}>CAM OFF</span>
                </div>
              )}
              <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '5px', zIndex: 2 }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.65)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>{isSharing ? 'YOU (SCREEN)' : 'YOU'}</span>
              </div>
            </div>
          </div>

          <div style={{ flexShrink: 0 }}><ReactionsBar roomId={roomId} socket={socket} /></div>

          {/* Desktop control bar */}
          <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50px', padding: '8px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              <Btn onClick={toggleAudio} active={isAudioMuted} title="Mute">{isAudioMuted ? '🔇' : '🎤'}</Btn>
              <Btn onClick={toggleVideo} active={isVideoOff} title="Camera">{isVideoOff ? '📷' : '📹'}</Btn>
              <Btn onClick={toggleScreenShare} active={isSharing} activeColor="rgba(77,166,255,0.6)" title="Share">🖥</Btn>
              <Btn onClick={() => setSideTab('chat')} active={sideTab === 'chat'} activeColor="rgba(0,255,136,0.6)" title="Chat">💬</Btn>
              <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
              <Btn onClick={handleHangUp} danger wide title="Leave">📵</Btn>
              <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
              <Btn onClick={toggleRec} active={isRecording} activeColor="rgba(255,107,53,0.6)" title="Record">{isRecording ? '⏹' : '⏺'}</Btn>
              <div style={{ position: 'relative' }} ref={menuRef}>
                <Btn onClick={() => setMenuOpen(o => !o)} active={menuOpen} title="More">⋮</Btn>
                {menuOpen && (
                  <div style={{ position: 'absolute', bottom: '54px', right: 0, width: '210px', background: '#0d0d12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.7)' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c', letterSpacing: '0.2em' }}>MORE OPTIONS</span>
                    </div>
                    {[
                      { icon: '🔗', label: copied ? 'Copied!' : 'Copy invite link', action: () => { copyLink(); setMenuOpen(false); } },
                      { icon: isSharing ? '⏹' : '🖥', label: isSharing ? 'Stop sharing' : 'Share screen', action: () => { toggleScreenShare(); setMenuOpen(false); } },
                      { icon: isRecording ? '⏹' : '⏺', label: isRecording ? 'Stop recording' : 'Start recording', action: () => { toggleRec(); setMenuOpen(false); } },
                      { icon: '💬', label: 'Open chat', action: () => { setSideTab('chat'); setMenuOpen(false); } },
                      { icon: '📊', label: 'View stats', action: () => { setSideTab('stats'); setMenuOpen(false); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', color: '#e8e8f0', textAlign: 'left', fontSize: '12px' }}
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

          <div style={{ flexShrink: 0 }}>
            <StatsPanel latency={latency} isP2P={isP2P} connectionState={connectionState} iceState={iceState} peerCount={peerCount} callId={callId} />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: '275px', borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,10,16,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.2em' }}>SESSION PANEL</span>
          </div>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {['chat', 'info'].map(t => (
              <button key={t} onClick={() => setSideTab(t)}
                style={{ flex: 1, padding: '9px', background: sideTab === t ? 'rgba(0,255,136,0.06)' : 'none', border: 'none', borderBottom: sideTab === t ? '2px solid #00ff88' : '2px solid transparent', color: sideTab === t ? '#00ff88' : '#4a4a5c', fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer', letterSpacing: '0.12em', textTransform: 'uppercase', transition: 'all 0.2s' }}>
                {t === 'chat' ? '💬 Chat' : '⚙ Info'}
              </button>
            ))}
          </div>
          {sideTab === 'chat' && <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}><PersistentChat roomId={roomId} user={user} socket={socket} /></div>}
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
        @keyframes pulse{0%,100%{opacity:0.7}50%{opacity:1}}
        @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
      `}</style>
    </div>
  );
}
