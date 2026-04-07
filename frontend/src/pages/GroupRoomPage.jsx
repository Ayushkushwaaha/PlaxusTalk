import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useGroupWebRTC } from '../hooks/useGroupWebRTC';

const REACTIONS = ['👍','❤️','😂','😮','👏','🔥','🎉','😢'];

// ── Single Video Tile ─────────────────────────────────────────────────────────
function VideoTile({ videoRef, stream, name, isLocal, isVideoOff, isMuted, isSmall }) {
  const internalRef = useRef(null);
  const ref = videoRef || internalRef;

  useEffect(() => {
    if (!ref.current || !stream) return;
    if (ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
    ref.current.play().catch(() => {});
  }, [stream]);

  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  return (
    <div style={{
      position: 'relative',
      background: '#0a0a10',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      overflow: 'hidden',
      // FIX: single user — compact centered tile, not fullscreen
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      minHeight: 0,
    }}>

      {/* Corner accents */}
      {['tl','tr','bl','br'].map(pos => (
        <div key={pos} style={{
          position: 'absolute', width: '14px', height: '14px', zIndex: 2,
          top: pos.startsWith('t') ? '8px' : 'auto',
          bottom: pos.startsWith('b') ? '8px' : 'auto',
          left: pos.endsWith('l') ? '8px' : 'auto',
          right: pos.endsWith('r') ? '8px' : 'auto',
          borderTop: pos.startsWith('t') ? '2px solid rgba(0,255,136,0.4)' : 'none',
          borderBottom: pos.startsWith('b') ? '2px solid rgba(0,255,136,0.4)' : 'none',
          borderLeft: pos.endsWith('l') ? '2px solid rgba(0,255,136,0.4)' : 'none',
          borderRight: pos.endsWith('r') ? '2px solid rgba(0,255,136,0.4)' : 'none',
        }} />
      ))}

      {/* VIDEO or AVATAR */}
      {!isVideoOff && (stream || videoRef) ? (
        <video
          ref={ref}
          autoPlay playsInline
          muted={isLocal}
          style={{
            width: '100%',
            height: '100%',
            // FIX zoom: use contain on mobile, cover on desktop
            objectFit: isMobile && isLocal ? 'contain' : 'cover',
            objectPosition: 'center',
            display: 'block',
            background: '#000',
            // FIX mirror: only mirror front camera, not back
            transform: isLocal ? 'scaleX(-1)' : 'none',
          }}
        />
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
          padding: '20px',
        }}>
          <div style={{
            width: isSmall ? '44px' : '60px',
            height: isSmall ? '44px' : '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(77,166,255,0.2))',
            border: '2px solid rgba(0,255,136,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isSmall ? '18px' : '24px',
            color: '#00ff88', fontWeight: 700,
            fontFamily: 'monospace',
            animation: 'fadeIn 0.4s ease',
          }}>
            {name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <span style={{
            fontSize: isSmall ? '10px' : '12px',
            color: '#4a4a5c',
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
            animation: 'fadeIn 0.4s ease',
          }}>
            {isVideoOff ? 'CAM OFF' : 'CONNECTING...'}
          </span>
        </div>
      )}

      {/* Muted badge */}
      {isMuted && (
        <div style={{
          position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,107,53,0.85)', backdropFilter: 'blur(4px)',
          borderRadius: '20px', padding: '3px 10px',
          display: 'flex', alignItems: 'center', gap: '4px', zIndex: 10,
          animation: 'fadeIn 0.3s ease',
        }}>
          <span style={{ fontSize: '11px' }}>🔇</span>
          <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>MUTED</span>
        </div>
      )}

      {/* Name badge */}
      <div style={{
        position: 'absolute', bottom: '10px', left: '10px', zIndex: 10,
        display: 'flex', alignItems: 'center', gap: '5px',
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: isLocal ? '#00ff88' : '#4da6ff',
          boxShadow: `0 0 6px ${isLocal ? '#00ff88' : '#4da6ff'}`,
        }} />
        <span style={{
          fontSize: '11px', color: 'rgba(255,255,255,0.9)',
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          padding: '2px 8px', borderRadius: '6px',
          fontFamily: 'monospace', letterSpacing: '0.05em',
        }}>
          {isLocal ? `${name} (YOU)` : name}
        </span>
      </div>

      {/* Scanning line animation */}
      <div style={{
        position: 'absolute', width: '100%', height: '2px',
        background: 'linear-gradient(90deg,transparent,rgba(0,255,136,0.15),transparent)',
        animation: 'scan 6s linear infinite', pointerEvents: 'none',
      }} />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function GroupRoomPage() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [hasJoined,  setHasJoined]  = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [chatOpen,   setChatOpen]   = useState(false);
  const [messages,   setMessages]   = useState([]);
  const [chatInput,  setChatInput]  = useState('');
  const [reaction,   setReaction]   = useState(null);
  const [menuOpen,   setMenuOpen]   = useState(false);

  const chatBottomRef = useRef(null);
  const menuRef       = useRef(null);
  const localVidRef   = useRef(null);

  const {
    localVideoRef, peers, peerCount, roomFull,
    isAudioMuted, isVideoOff, isSharing, isRecording, recordingTime, formatTime,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    toggleScreenShare, toggleRecording, switchCamera,
    maxPeers,
  } = useGroupWebRTC(roomId);

  // Sync refs
  useEffect(() => {
    if (localVideoRef) localVideoRef.current = localVidRef.current;
  });

  useEffect(() => {
    if (!hasJoined && roomId) {
      setHasJoined(true);
      joinRoom(user?.name || 'Guest');
    }
  }, [roomId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const sendReaction = emoji => {
    setReaction(emoji);
    setTimeout(() => setReaction(null), 2500);
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(p => [...p, {
      text: chatInput.trim(), sender: user?.name || 'You', isSelf: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setChatInput('');
  };

  const totalPeers = peers.length + 1; // +1 for local

  // FIX: Grid layout — single user gets centered small tile, not fullscreen
  const getGridStyle = () => {
    if (totalPeers === 1) {
      // Single — centered tile, max 480px wide
      return {
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: 1, minHeight: 0, padding: '0 10%',
      };
    }
    // Multiple — proper grid
    const cols = totalPeers <= 2 ? 2 : totalPeers <= 4 ? 2 : totalPeers <= 6 ? 3 : 4;
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: '10px',
      flex: 1,
      minHeight: 0,
      alignContent: 'center',
    };
  };

  // Single tile height when alone
  const singleTileStyle = totalPeers === 1 ? {
    width: '100%',
    maxWidth: '480px',
    height: '0',
    paddingBottom: '56.25%', // 16:9
    position: 'relative',
  } : { minHeight: 0 };

  if (roomFull) {
    return (
      <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#0d0d12', border: '1px solid #1a1a24', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: '#e8e8f0', fontFamily: 'monospace', marginBottom: '12px' }}>ROOM FULL</h2>
          <p style={{ color: '#4a4a5c', fontSize: '14px', marginBottom: '24px' }}>Max {maxPeers} participants.</p>
          <button onClick={() => navigate('/')} style={{ background: '#00ff88', color: '#060608', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#060608', overflow: 'hidden', color: '#e8e8f0' }}>

      {/* Floating reaction */}
      {reaction && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '80px', animation: 'floatUp 2.5s ease forwards' }}>{reaction}</span>
        </div>
      )}

      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(12px)',
        flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em' }}>
            ← PLEXUSTALK
          </button>
          <span style={{ color: '#1a1a24' }}>|</span>
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c' }}>GROUP</span>
          <button onClick={copyLink} style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.12em' }}>
            {roomId}
          </button>
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

      {/* MAIN BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* VIDEO AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '8px', minHeight: 0, overflow: 'hidden' }}>

          {/* VIDEO GRID */}
          <div style={getGridStyle()}>
            {/* FIX single user tile */}
            {totalPeers === 1 ? (
              <div style={{ width: '100%', maxWidth: '480px', aspectRatio: '16/9', position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                {!isVideoOff ? (
                  <>
                    <video
                      ref={localVidRef}
                      autoPlay playsInline muted
                      style={{
                        width: '100%', height: '100%', objectFit: 'contain',
                        display: 'block', background: '#000',
                        transform: 'scaleX(-1)', // mirror front cam
                      }}
                    />
                    {/* Corner brackets */}
                    {['tl','tr','bl','br'].map(pos => (
                      <div key={pos} style={{
                        position: 'absolute', width: '16px', height: '16px', zIndex: 2,
                        top: pos.startsWith('t') ? '10px' : 'auto',
                        bottom: pos.startsWith('b') ? '10px' : 'auto',
                        left: pos.endsWith('l') ? '10px' : 'auto',
                        right: pos.endsWith('r') ? '10px' : 'auto',
                        borderTop: pos.startsWith('t') ? '2px solid rgba(0,255,136,0.5)' : 'none',
                        borderBottom: pos.startsWith('b') ? '2px solid rgba(0,255,136,0.5)' : 'none',
                        borderLeft: pos.endsWith('l') ? '2px solid rgba(0,255,136,0.5)' : 'none',
                        borderRight: pos.endsWith('r') ? '2px solid rgba(0,255,136,0.5)' : 'none',
                      }} />
                    ))}
                  </>
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#0a0a10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '2px solid rgba(0,255,136,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', color: '#00ff88', fontFamily: 'monospace', fontWeight: 700 }}>
                      {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4a4a5c', letterSpacing: '0.1em' }}>CAM OFF</span>
                  </div>
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
                {/* LOCAL — in grid with others */}
                <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', minHeight: 0, aspectRatio: '16/9' }}>
                  {!isVideoOff ? (
                    <video
                      ref={localVidRef}
                      autoPlay playsInline muted
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'contain', // FIX zoom
                        display: 'block', background: '#000',
                        transform: 'scaleX(-1)', // FIX mirror
                      }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: '#0a0a10', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#00ff88', fontFamily: 'monospace', fontWeight: 700 }}>
                        {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                      </div>
                      <span style={{ fontSize: '10px', color: '#4a4a5c', fontFamily: 'monospace', letterSpacing: '0.1em' }}>CAM OFF</span>
                    </div>
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

                {/* REMOTE PEERS */}
                {peers.map(peer => (
                  <PeerTile key={peer.socketId} peer={peer} />
                ))}
              </>
            )}
          </div>

          {/* REACTIONS ROW */}
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

          {/* CONTROL BAR */}
          <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50px',
              padding: '8px 16px', boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}>
              <CtrlBtn onClick={toggleAudio} active={isAudioMuted} title="Mic">{isAudioMuted ? '🔇' : '🎤'}</CtrlBtn>
              <CtrlBtn onClick={toggleVideo} active={isVideoOff} title="Camera">{isVideoOff ? '📷' : '📹'}</CtrlBtn>
              <CtrlBtn onClick={switchCamera} title="Switch camera">🔄</CtrlBtn>
              <CtrlBtn onClick={toggleScreenShare} active={isSharing} activeColor="rgba(77,166,255,0.35)" title="Share screen">🖥</CtrlBtn>
              <CtrlBtn onClick={() => setChatOpen(o => !o)} active={chatOpen} activeColor="rgba(0,255,136,0.25)" title="Chat">💬</CtrlBtn>
              <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
              <button onClick={handleHangUp} title="Leave"
                style={{ width: '50px', height: '44px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontSize: '18px', background: 'linear-gradient(135deg,#ef4444,#dc2626)', boxShadow: '0 4px 14px rgba(239,68,68,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s' }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.07)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                📵
              </button>
              <div style={{ width: '1px', height: '26px', background: 'rgba(255,255,255,0.1)', margin: '0 3px' }} />
              <CtrlBtn onClick={toggleRecording} active={isRecording} activeColor="rgba(255,107,53,0.35)" title="Record">
                {isRecording ? '⏹' : '⏺'}
              </CtrlBtn>
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

          {/* STATS */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', flexShrink: 0 }}>
            {[
              ['PARTICIPANTS', `${totalPeers}/${maxPeers}`, '#00ff88'],
              ['ARCHITECTURE', 'MESH P2P', '#e8e8f0'],
              ['ENCRYPTION',   'DTLS-SRTP', '#4da6ff'],
            ].map(([l,v,c]) => (
              <div key={l} style={{ background: 'rgba(13,13,18,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '8px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '8px', color: '#4a4a5c', letterSpacing: '0.15em', marginBottom: '3px' }}>{l}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CHAT SIDEBAR */}
        {chatOpen && (
          <div style={{ width: '255px', borderLeft: '1px solid rgba(255,255,255,0.07)', background: 'rgba(10,10,16,0.85)', display: 'flex', flexDirection: 'column', flexShrink: 0, animation: 'slideIn 0.25s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.2em' }}>GROUP CHAT</span>
              <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(74,74,92,0.4)', letterSpacing: '0.15em' }}>NO MESSAGES YET</span>
                </div>
              ) : messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isSelf ? 'flex-end' : 'flex-start', gap: '3px', animation: 'fadeIn 0.2s ease' }}>
                  <div style={{
                    maxWidth: '85%', padding: '8px 12px', fontSize: '12px', lineHeight: 1.5, borderRadius: '10px',
                    background: msg.isSelf ? 'rgba(0,255,136,0.12)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${msg.isSelf ? 'rgba(0,255,136,0.22)' : 'rgba(255,255,255,0.07)'}`,
                    color: '#e8e8f0',
                  }}>
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '10px', color: '#4a4a5c' }}>{msg.sender} · {msg.time}</span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
            <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Type message..."
                style={{ flex: 1, background: 'transparent', border: 'none', color: '#e8e8f0', fontSize: '12px', padding: '10px 12px', outline: 'none' }} />
              <button onClick={sendMessage} style={{ background: 'none', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.07)', color: '#00ff88', cursor: 'pointer', padding: '0 14px', fontSize: '16px' }}>➤</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes scan { 0%{top:-2px}100%{top:102%} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        @keyframes floatUp { 0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-120px) scale(1.3)} }
        @keyframes slideIn { from{transform:translateX(100%)}to{transform:translateX(0)} }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>
    </div>
  );
}

// Peer tile for remote users
function PeerTile({ peer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && peer.stream) {
      ref.current.srcObject = peer.stream;
      ref.current.play().catch(() => {});
    }
  }, [peer.stream]);

  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', minHeight: 0, aspectRatio: '16/9', background: '#0a0a10', border: '1px solid rgba(255,255,255,0.07)', animation: 'fadeIn 0.4s ease' }}>
      {peer.stream ? (
        <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.65)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{peer.name}</span>
      </div>
    </div>
  );
}

// Control button
function CtrlBtn({ onClick, active, activeColor, title, children }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '44px', height: '44px', borderRadius: '50%', border: 'none', cursor: 'pointer',
        fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? (activeColor || 'rgba(255,107,53,0.25)') : h ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
        boxShadow: active ? `0 0 0 2px ${activeColor ? activeColor.replace('0.35','0.7').replace('0.25','0.6') : 'rgba(255,107,53,0.6)'}` : 'none',
        transition: 'all 0.2s', transform: h ? 'scale(1.05)' : 'scale(1)',
      }}>
      {children}
    </button>
  );
}
