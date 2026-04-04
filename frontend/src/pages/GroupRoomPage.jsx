import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useGroupWebRTC } from '../hooks/useGroupWebRTC';

const REACTIONS = ['👍','❤️','😂','😮','👏','🔥','🎉','😢'];

// ── Remote Video Tile ─────────────────────────────────────────────────────────
function RemoteVideoTile({ stream, name, isMuted }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div style={{
      position: 'relative',
      background: '#0d0d12',
      border: '1px solid #1a1a24',
      borderRadius: '12px',
      overflow: 'hidden',
      aspectRatio: '16/9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', color: '#00ff88', fontWeight: 700,
          }}>
            {name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <span style={{ fontSize: '11px', color: '#4a4a5c', letterSpacing: '0.1em' }}>CONNECTING...</span>
        </>
      )}

      {isMuted && (
        <div style={{
          position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,107,53,0.8)', borderRadius: '20px',
          padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 10,
        }}>
          <span style={{ fontSize: '11px' }}>🔇</span>
          <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600 }}>MUTED</span>
        </div>
      )}

      <div style={{
        position: 'absolute', bottom: '8px', left: '8px',
        display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10,
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4da6ff' }} />
        <span style={{
          fontSize: '11px', color: 'rgba(255,255,255,0.9)',
          background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px',
        }}>{name}</span>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GroupRoomPage() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [hasJoined,     setHasJoined]     = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [chatOpen,      setChatOpen]      = useState(false);
  const [messages,      setMessages]      = useState([]);
  const [chatInput,     setChatInput]     = useState('');
  const [reaction,      setReaction]      = useState(null);
  const [menuOpen,      setMenuOpen]      = useState(false);

  const chatBottomRef = useRef(null);
  const menuRef       = useRef(null);
  const localVidRef   = useRef(null); // direct ref for local video element

  const {
    localVideoRef, peers, peerCount, roomFull,
    isAudioMuted, isVideoOff, isSharing, isRecording, recordingTime, formatTime,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    toggleScreenShare, toggleRecording, switchCamera,
    maxPeers,
  } = useGroupWebRTC(roomId);

  // Sync localVideoRef from hook into our local direct ref
  useEffect(() => {
    if (localVideoRef && localVidRef.current) {
      localVideoRef.current = localVidRef.current;
    }
  }, [localVideoRef]);

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
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleHangUp = () => { hangUp(); navigate('/'); };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/group/${roomId}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const sendReaction = (emoji) => {
    setReaction(emoji);
    setTimeout(() => setReaction(null), 2500);
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    setMessages(prev => [...prev, {
      text: chatInput.trim(),
      sender: user?.name || 'You',
      isSelf: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }]);
    setChatInput('');
  };

  const totalParticipants = peers.length + 1;

  // Grid columns based on count
  const gridCols = totalParticipants <= 1 ? 1
    : totalParticipants <= 2 ? 2
    : totalParticipants <= 4 ? 2
    : totalParticipants <= 6 ? 3
    : 4;

  if (roomFull) {
    return (
      <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#0d0d12', border: '1px solid #1a1a24', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ color: 'white', fontFamily: 'monospace', marginBottom: '12px' }}>ROOM FULL</h2>
          <p style={{ color: '#4a4a5c', fontSize: '14px', marginBottom: '24px' }}>
            This room already has {maxPeers} participants.
          </p>
          <button onClick={() => navigate('/')}
            style={{ background: '#00ff88', color: '#060608', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#060608', overflow: 'hidden' }}>

      {/* Floating reaction */}
      {reaction && (
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: '80px', animation: 'bounce 0.5s ease infinite' }}>{reaction}</div>
        </div>
      )}

      {/* HEADER — fixed height */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid #1a1a24',
        background: 'rgba(13,13,18,0.9)', backdropFilter: 'blur(10px)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '12px', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
            ← PLEXUSTALK
          </button>
          <div style={{ width: '1px', height: '16px', background: '#1a1a24' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#4a4a5c' }}>GROUP</span>
          <button onClick={copyLink}
            style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontFamily: 'monospace', fontSize: '14px', letterSpacing: '0.15em' }}>
            {roomId}
          </button>
          <span onClick={copyLink} style={{ cursor: 'pointer', color: '#4a4a5c', fontSize: '12px' }}>{copied ? '✓' : '⎘'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', padding: '4px 10px', borderRadius: '20px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff6b35', animation: 'pulse 1s infinite' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#ff6b35' }}>{formatTime(recordingTime)}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #1a1a24', padding: '5px 12px', borderRadius: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#00ff88' }}>{totalParticipants}/{maxPeers} PEERS</span>
          </div>
        </div>
      </div>

      {/* BODY — takes remaining height */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* VIDEO + CONTROLS AREA */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '10px', minHeight: 0, overflow: 'hidden' }}>

          {/* VIDEO GRID — flex:1 means it takes available space */}
          <div style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: '10px',
            minHeight: 0,
            overflow: 'hidden',
          }}>

            {/* LOCAL VIDEO — direct video element, always visible */}
            <div style={{
              position: 'relative',
              background: '#0d0d12',
              border: '1px solid #1a1a24',
              borderRadius: '12px',
              overflow: 'hidden',
              minHeight: 0,
            }}>
              {isVideoOff ? (
                <div style={{
                  width: '100%', height: '100%', minHeight: '120px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '22px', color: '#00ff88', fontWeight: 700,
                  }}>
                    {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <span style={{ fontSize: '11px', color: '#4a4a5c', letterSpacing: '0.1em' }}>CAM OFF</span>
                </div>
              ) : (
                <video
                  ref={localVidRef}
                  autoPlay playsInline muted
                  style={{
                    width: '100%', height: '100%', minHeight: '120px',
                    objectFit: 'cover', display: 'block', background: '#000',
                  }}
                />
              )}

              {isAudioMuted && (
                <div style={{
                  position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(255,107,53,0.85)', borderRadius: '20px',
                  padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 10,
                }}>
                  <span style={{ fontSize: '11px' }}>🔇</span>
                  <span style={{ fontSize: '10px', color: '#fff', fontWeight: 600 }}>MUTED</span>
                </div>
              )}

              <div style={{
                position: 'absolute', bottom: '8px', left: '8px',
                display: 'flex', alignItems: 'center', gap: '6px', zIndex: 10,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88' }} />
                <span style={{
                  fontSize: '11px', color: 'rgba(255,255,255,0.9)',
                  background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px',
                  fontFamily: 'monospace', letterSpacing: '0.05em',
                }}>
                  {user?.name || 'You'} (YOU)
                </span>
              </div>
            </div>

            {/* REMOTE PEERS */}
            {peers.map(peer => (
              <RemoteVideoTile
                key={peer.socketId}
                stream={peer.stream}
                name={peer.name}
                isMuted={peer.isMuted}
              />
            ))}

            {/* EMPTY SLOTS */}
            {Array.from({ length: Math.max(0, (gridCols * Math.ceil(totalParticipants / gridCols)) - totalParticipants) }).map((_, i) => (
              <div key={`empty-${i}`} style={{
                background: 'rgba(13,13,18,0.3)', border: '1px dashed rgba(26,26,36,0.6)',
                borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: '8px', minHeight: '80px',
              }}>
                <span style={{ fontSize: '24px', color: '#1a1a24' }}>+</span>
                <span style={{ fontSize: '10px', color: 'rgba(74,74,92,0.4)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>AWAITING PEER</span>
              </div>
            ))}
          </div>

          {/* REACTIONS */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexShrink: 0 }}>
            {REACTIONS.map(emoji => (
              <button key={emoji} onClick={() => sendReaction(emoji)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', transition: 'transform 0.15s', padding: '2px' }}
                onMouseOver={e => e.target.style.transform = 'scale(1.3)'}
                onMouseOut={e => e.target.style.transform = 'scale(1)'}>
                {emoji}
              </button>
            ))}
          </div>

          {/* CONTROL BAR */}
          <div style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(13,13,18,0.9)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '40px',
              padding: '8px 16px',
            }}>
              {[
                { icon: isAudioMuted ? '🔇' : '🎤', action: toggleAudio, active: isAudioMuted, title: 'Mic' },
                { icon: isVideoOff ? '📷' : '📹', action: toggleVideo, active: isVideoOff, title: 'Camera' },
                { icon: '🔄', action: switchCamera, active: false, title: 'Switch cam', mobileOnly: true },
                { icon: '🖥', action: toggleScreenShare, active: isSharing, title: 'Share screen', activeColor: '#4da6ff' },
                { icon: '💬', action: () => setChatOpen(o => !o), active: chatOpen, title: 'Chat', activeColor: '#00ff88' },
              ].map((btn, i) => (
                <button key={i} onClick={btn.action} title={btn.title}
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                    cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: btn.active
                      ? `rgba(${btn.activeColor === '#4da6ff' ? '77,166,255' : btn.activeColor === '#00ff88' ? '0,255,136' : '255,107,53'},0.2)`
                      : 'rgba(255,255,255,0.08)',
                    boxShadow: btn.active
                      ? `0 0 0 2px ${btn.activeColor || 'rgba(255,107,53,0.5)'}`
                      : 'none',
                    transition: 'all 0.2s',
                  }}>
                  {btn.icon}
                </button>
              ))}

              {/* Divider */}
              <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

              {/* Hang up */}
              <button onClick={handleHangUp}
                style={{
                  width: '52px', height: '44px', borderRadius: '14px', border: 'none',
                  cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  boxShadow: '0 4px 15px rgba(239,68,68,0.4)', transition: 'all 0.2s',
                }}>
                📵
              </button>

              {/* Divider */}
              <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

              {/* Record */}
              <button onClick={toggleRecording} title="Record"
                style={{
                  width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                  cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isRecording ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.08)',
                  boxShadow: isRecording ? '0 0 0 2px rgba(255,107,53,0.5)' : 'none', transition: 'all 0.2s',
                }}>
                {isRecording ? '⏹' : '⏺'}
              </button>

              {/* 3-dot menu */}
              <div style={{ position: 'relative' }} ref={menuRef}>
                <button onClick={() => setMenuOpen(o => !o)}
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                    cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: menuOpen ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.08)', transition: 'all 0.2s',
                    color: 'white',
                  }}>
                  ⋮
                </button>
                {menuOpen && (
                  <div style={{
                    position: 'absolute', bottom: '54px', right: 0,
                    width: '210px', background: '#0d0d12', border: '1px solid #1a1a24',
                    borderRadius: '14px', overflow: 'hidden', zIndex: 200,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  }}>
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid #1a1a24' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.2em' }}>MORE OPTIONS</span>
                    </div>
                    {[
                      { icon: '🔗', label: copied ? 'Copied!' : 'Copy invite link', action: () => { copyLink(); setMenuOpen(false); } },
                      { icon: isSharing ? '⏹' : '🖥', label: isSharing ? 'Stop sharing' : 'Share screen', action: () => { toggleScreenShare(); setMenuOpen(false); } },
                      { icon: isRecording ? '⏹' : '⏺', label: isRecording ? 'Stop recording' : 'Start recording', action: () => { toggleRecording(); setMenuOpen(false); } },
                      { icon: '💬', label: 'Open chat', action: () => { setChatOpen(true); setMenuOpen(false); } },
                      { icon: '🔄', label: 'Switch camera', action: () => { switchCamera(); setMenuOpen(false); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 16px', background: 'none', border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                          color: 'white', textAlign: 'left', fontSize: '13px',
                          transition: 'background 0.15s',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}>
                        <span style={{ fontSize: '16px' }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* STATS BAR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', flexShrink: 0 }}>
            {[
              { label: 'PARTICIPANTS', value: `${totalParticipants}/${maxPeers}`, color: '#00ff88' },
              { label: 'ARCHITECTURE', value: 'MESH P2P', color: '#e8e8f0' },
              { label: 'ENCRYPTION',   value: 'DTLS-SRTP', color: '#4da6ff' },
            ].map(s => (
              <div key={s.label} style={{
                background: '#0d0d12', border: '1px solid #1a1a24', borderRadius: '10px',
                padding: '10px', textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c', letterSpacing: '0.15em', marginBottom: '4px' }}>{s.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CHAT SIDEBAR */}
        {chatOpen && (
          <div style={{
            width: '260px', borderLeft: '1px solid #1a1a24',
            background: 'rgba(13,13,18,0.8)', display: 'flex', flexDirection: 'column',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid #1a1a24',
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.2em' }}>GROUP CHAT</span>
              <button onClick={() => setChatOpen(false)}
                style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '10px', color: 'rgba(74,74,92,0.4)', letterSpacing: '0.15em' }}>NO MESSAGES YET</span>
                </div>
              ) : messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isSelf ? 'flex-end' : 'flex-start', gap: '3px' }}>
                  <div style={{
                    maxWidth: '85%', padding: '8px 12px', fontSize: '12px', lineHeight: 1.5,
                    borderRadius: '10px',
                    background: msg.isSelf ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${msg.isSelf ? 'rgba(0,255,136,0.25)' : '#1a1a24'}`,
                    color: '#e8e8f0',
                  }}>
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '10px', color: '#4a4a5c' }}>{msg.sender} · {msg.time}</span>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <div style={{ display: 'flex', borderTop: '1px solid #1a1a24' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Type message..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', color: '#e8e8f0',
                  fontSize: '12px', padding: '10px 12px', outline: 'none',
                }}
              />
              <button onClick={sendMessage}
                style={{
                  background: 'none', border: 'none', borderLeft: '1px solid #1a1a24',
                  color: '#00ff88', cursor: 'pointer', padding: '0 14px', fontSize: '16px',
                }}>
                ➤
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)} }
      `}</style>
    </div>
  );
}
