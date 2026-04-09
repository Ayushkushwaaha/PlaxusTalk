import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useGroupWebRTC } from '../hooks/useGroupWebRTC';
import PersistentChat from '../components/PersistentChat';
import { getSocket } from '../lib/socket';

const REACTIONS = ['👍','❤️','😂','😮','👏','🔥','🎉','😢'];

// ── Peer Video Tile ───────────────────────────────────────────────────────────
function PeerTile({ peer }) {
  const ref = useRef(null); // FIX: use local ref, not setLocalVideoRef

  useEffect(() => {
    if (ref.current && peer.stream) {
      ref.current.srcObject = peer.stream;
      ref.current.play().catch(() => {});
    }
  }, [peer.stream]);

  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.07)' }}>
      {peer.stream ? (
        <video ref={ref} autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(77,166,255,0.15)', border: '1px solid rgba(77,166,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#4da6ff', fontFamily: 'monospace', fontWeight: 700 }}>
            {peer.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <span style={{ fontSize: '10px', color: '#4a4a5c', fontFamily: 'monospace', letterSpacing: '0.1em' }}>CONNECTING...</span>
        </div>
      )}
      {peer.isMuted && (
        <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,107,53,0.85)', borderRadius: '20px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '3px', zIndex: 5 }}>
          <span style={{ fontSize: '10px' }}>🔇</span>
          <span style={{ fontSize: '9px', color: '#fff', fontFamily: 'monospace' }}>MUTED</span>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '6px', left: '6px', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 5 }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4da6ff' }} />
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.65)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
          {peer.name}
        </span>
      </div>
    </div>
  );
}

// ── Control Button ────────────────────────────────────────────────────────────
function CtrlBtn({ onClick, active, activeColor, title, children, danger, wide }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: wide ? '52px' : '44px', height: '44px',
        borderRadius: danger ? '14px' : '50%',
        border: 'none', cursor: 'pointer', fontSize: '18px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: danger
          ? 'linear-gradient(135deg,#ef4444,#dc2626)'
          : active
          ? (activeColor || 'rgba(255,107,53,0.25)')
          : h ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
        boxShadow: danger
          ? '0 4px 14px rgba(239,68,68,0.4)'
          : active ? `0 0 0 2px ${activeColor ? activeColor.replace('0.25','0.6').replace('0.35','0.7') : 'rgba(255,107,53,0.6)'}` : 'none',
        transition: 'all 0.2s',
        transform: h ? 'scale(1.05)' : 'scale(1)',
      }}>
      {children}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GroupRoomPage() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const socket     = getSocket();

  const [hasJoined,  setHasJoined]  = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [chatOpen,   setChatOpen]   = useState(false);
  const [floating,   setFloating]   = useState([]);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const menuRef = useRef(null);

  const {
    setLocalVideoRef,  // FIX: use ref callback
    peers, peerCount, roomFull,
    isAudioMuted, isVideoOff,
    isSharing, isRecording, recordingTime, formatTime,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    toggleScreenShare, toggleRecording, switchCamera,
    maxPeers,
  } = useGroupWebRTC(roomId);

  useEffect(() => {
    if (!hasJoined && roomId) {
      setHasJoined(true);
      joinRoom(user?.name || 'Guest');
    }
  }, [roomId]);

  useEffect(() => {
    // FIX: Listen for peer reactions
    const onReaction = ({ emoji }) => spawnFloat(emoji);
    socket.on('reaction', onReaction);
    return () => socket.off('reaction', onReaction);
  }, [socket]);

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleHangUp = () => { hangUp(); navigate('/'); };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/group/${roomId}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const spawnFloat = (emoji) => {
    const id = Date.now() + Math.random();
    const x = 20 + Math.random() * 60;
    setFloating(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => setFloating(prev => prev.filter(f => f.id !== id)), 2500);
  };

  const sendReaction = (emoji) => {
    spawnFloat(emoji);
    socket.emit('reaction', { roomId: roomId?.toUpperCase(), emoji });
  };

  const totalPeers = peers.length + 1;
  const cols = totalPeers <= 1 ? 1 : totalPeers <= 2 ? 2 : totalPeers <= 4 ? 2 : totalPeers <= 6 ? 3 : 4;

  if (roomFull) {
    return (
      <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#0d0d12', border: '1px solid #1a1a24', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#e8e8f0', fontFamily: 'monospace', marginBottom: '12px' }}>ROOM FULL</h2>
          <p style={{ color: '#4a4a5c', fontSize: '14px', marginBottom: '24px' }}>Max {maxPeers} participants.</p>
          <button onClick={() => navigate('/')} style={{ background: '#00ff88', color: '#060608', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>← Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#060608', overflow: 'hidden', color: '#e8e8f0' }}>

      {/* Floating reactions */}
      {floating.map(f => (
        <div key={f.id} style={{ position: 'fixed', bottom: '120px', left: `${f.x}%`, fontSize: '40px', pointerEvents: 'none', zIndex: 9999, animation: 'floatUp 2.5s ease forwards' }}>
          {f.emoji}
        </div>
      ))}

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em' }}>← PLEXUSTALK</button>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c' }}>GROUP</span>
          <button onClick={copyLink} style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.12em' }}>{roomId}</button>
          <span onClick={copyLink} style={{ cursor: 'pointer', color: '#4a4a5c', fontSize: '12px' }}>{copied ? '✓' : '⎘'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', padding: '4px 10px', borderRadius: '20px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff6b35', animation: 'blink 1s infinite' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff6b35' }}>REC {formatTime(recordingTime)}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', padding: '5px 12px', borderRadius: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', animation: 'blink 2s infinite' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#00ff88', fontWeight: 600 }}>{totalPeers}/{maxPeers} PEERS</span>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* VIDEO + CONTROLS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '8px', minHeight: 0, overflow: 'hidden' }}>

          {/* VIDEO GRID */}
          <div style={{
            flex: 1, minHeight: 0,
            display: totalPeers === 1 ? 'flex' : 'grid',
            alignItems: 'center', justifyContent: 'center',
            gridTemplateColumns: totalPeers > 1 ? `repeat(${cols}, 1fr)` : undefined,
            gap: '10px',
          }}>
            {/* LOCAL VIDEO — FIX: use setLocalVideoRef as ref callback */}
            {totalPeers === 1 ? (
              <div style={{ width: '100%', maxWidth: '480px', aspectRatio: '16/9', position: 'relative', borderRadius: '16px', overflow: 'hidden', background: '#0a0a10', border: '1px solid rgba(0,255,136,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                {isVideoOff ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '2px solid rgba(0,255,136,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', color: '#00ff88', fontFamily: 'monospace', fontWeight: 700 }}>
                      {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4a4a5c' }}>CAM OFF</span>
                  </div>
                ) : (
                  <video ref={setLocalVideoRef} autoPlay playsInline muted
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000', transform: 'scaleX(-1)' }} />
                )}
                <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '6px', zIndex: 5 }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.65)', padding: '2px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                    {user?.name || 'You'} (YOU)
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9', background: '#0a0a10', border: '1px solid rgba(0,255,136,0.15)' }}>
                  {isVideoOff ? (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#00ff88', fontFamily: 'monospace', fontWeight: 700 }}>
                        {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <span style={{ fontSize: '10px', color: '#4a4a5c', fontFamily: 'monospace' }}>CAM OFF</span>
                    </div>
                  ) : (
                    <video ref={setLocalVideoRef} autoPlay playsInline muted
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000', transform: 'scaleX(-1)' }} />
                  )}
                  {isAudioMuted && (
                    <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,107,53,0.85)', borderRadius: '20px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '3px', zIndex: 5 }}>
                      <span style={{ fontSize: '10px' }}>🔇</span>
                      <span style={{ fontSize: '9px', color: '#fff', fontFamily: 'monospace' }}>MUTED</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: '6px', left: '6px', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 5 }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00ff88' }} />
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.65)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {user?.name || 'You'} (YOU)
                    </span>
                  </div>
                </div>
                {peers.map(peer => <PeerTile key={peer.socketId} peer={peer} />)}
              </>
            )}
          </div>

          {/* REACTIONS */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
            {REACTIONS.map(e => (
              <button key={e} onClick={() => sendReaction(e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', padding: '2px', transition: 'transform 0.15s' }}
                onMouseOver={ev => ev.currentTarget.style.transform = 'scale(1.3)'}
                onMouseOut={ev => ev.currentTarget.style.transform = 'scale(1)'}>
                {e}
              </button>
            ))}
          </div>

          {/* CONTROLS */}
          <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50px', padding: '8px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              <CtrlBtn onClick={toggleAudio} active={isAudioMuted} title="Mic">{isAudioMuted ? '🔇' : '🎤'}</CtrlBtn>
              <CtrlBtn onClick={toggleVideo} active={isVideoOff} title="Camera">{isVideoOff ? '📷' : '📹'}</CtrlBtn>
              <CtrlBtn onClick={switchCamera} title="Switch camera">🔄</CtrlBtn>
              <CtrlBtn onClick={toggleScreenShare} active={isSharing} activeColor="rgba(77,166,255,0.35)" title="Share screen">🖥</CtrlBtn>
              <CtrlBtn onClick={() => setChatOpen(o => !o)} active={chatOpen} activeColor="rgba(0,255,136,0.25)" title="Chat">💬</CtrlBtn>
              <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
              <CtrlBtn onClick={handleHangUp} danger wide title="Leave">📵</CtrlBtn>
              <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
              <CtrlBtn onClick={toggleRecording} active={isRecording} activeColor="rgba(255,107,53,0.35)" title="Record">{isRecording ? '⏹' : '⏺'}</CtrlBtn>
              <div style={{ position: 'relative' }} ref={menuRef}>
                <CtrlBtn onClick={() => setMenuOpen(o => !o)} active={menuOpen} title="More">⋮</CtrlBtn>
                {menuOpen && (
                  <div style={{ position: 'absolute', bottom: '54px', right: 0, width: '205px', background: '#0d0d12', border: '1px solid #1a1a24', borderRadius: '14px', overflow: 'hidden', zIndex: 200, boxShadow: '0 8px 28px rgba(0,0,0,0.7)' }}>
                    <div style={{ padding: '8px 14px', borderBottom: '1px solid #1a1a24' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c', letterSpacing: '0.2em' }}>MORE OPTIONS</span>
                    </div>
                    {[
                      { icon: '🔗', label: copied ? 'Copied!' : 'Copy invite link', action: () => { copyLink(); setMenuOpen(false); } },
                      { icon: isSharing ? '⏹' : '🖥', label: isSharing ? 'Stop sharing' : 'Share screen', action: () => { toggleScreenShare(); setMenuOpen(false); } },
                      { icon: isRecording ? '⏹' : '⏺', label: isRecording ? 'Stop recording' : 'Start recording', action: () => { toggleRecording(); setMenuOpen(false); } },
                      { icon: '💬', label: 'Open chat', action: () => { setChatOpen(true); setMenuOpen(false); } },
                      { icon: '🔄', label: 'Switch camera', action: () => { switchCamera(); setMenuOpen(false); } },
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

          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', flexShrink: 0 }}>
            {[['PARTICIPANTS', `${totalPeers}/${maxPeers}`, '#00ff88'], ['ARCHITECTURE', 'MESH P2P', '#e8e8f0'], ['ENCRYPTION', 'DTLS-SRTP', '#4da6ff']].map(([l,v,c]) => (
              <div key={l} style={{ background: 'rgba(13,13,18,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#4a4a5c', letterSpacing: '0.15em', marginBottom: '3px' }}>{l}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CHAT SIDEBAR — FIX: use PersistentChat */}
        {chatOpen && (
          <div style={{ width: '255px', borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,10,16,0.85)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.2em' }}>GROUP CHAT</span>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <PersistentChat roomId={roomId} user={user} socket={socket} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes floatUp { 0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-160px) scale(1.4)} }
      `}</style>
    </div>
  );
}
