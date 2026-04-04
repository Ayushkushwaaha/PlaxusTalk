import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useGroupWebRTC } from '../hooks/useGroupWebRTC';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// FIX 6 — Emoji reactions list
const REACTIONS = ['👍','❤️','😂','😮','👏','🔥','🎉','😢'];

// ── Video Tile ────────────────────────────────────────────────────────────────
function VideoTile({ stream, name, isLocal, isVideoOff, isMuted }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // FIX 3 — ensure video plays after stream is set
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  // FIX 3 — also watch for track changes
  useEffect(() => {
    if (!stream || !videoRef.current) return;
    const handler = () => {
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    };
    stream.addEventListener('addtrack', handler);
    stream.addEventListener('removetrack', handler);
    return () => {
      stream.removeEventListener('addtrack', handler);
      stream.removeEventListener('removetrack', handler);
    };
  }, [stream]);

  const showVideo = stream && !isVideoOff;

  return (
    <div className="relative bg-panel border border-border overflow-hidden rounded-lg aspect-video group">
      {/* Corner brackets */}
      <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-accent/40 z-10" />
      <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-accent/40 z-10" />
      <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-accent/40 z-10" />
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-accent/40 z-10" />

      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center' }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-void gap-3">
          <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
            <span className="font-display text-xl text-accent">
              {name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <span className="font-display text-xs text-muted tracking-widest">
            {isVideoOff ? 'CAM OFF' : 'CONNECTING...'}
          </span>
        </div>
      )}

      {/* FIX 9 — Muted indicator on peer tile */}
      {isMuted && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-warn/80 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
          <span className="text-xs">🔇</span>
          <span className="font-display text-xs text-void tracking-widest">MUTED</span>
        </div>
      )}

      {/* Name badge */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${isLocal ? 'bg-accent' : 'bg-info'} animate-pulse`} />
        <span className="font-display text-xs text-white/90 bg-void/70 backdrop-blur px-2 py-0.5 rounded tracking-widest">
          {isLocal ? `${name} (YOU)` : name}
        </span>
      </div>
    </div>
  );
}

// ── Main Group Room Page ──────────────────────────────────────────────────────
export default function GroupRoomPage() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();

  const [hasJoined,     setHasJoined]     = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [chatOpen,      setChatOpen]      = useState(false);
  const [messages,      setMessages]      = useState([]);
  const [chatInput,     setChatInput]     = useState('');
  const [reaction,      setReaction]      = useState(null); // FIX 6
  const [showReactions, setShowReactions] = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  // FIX 10 — join by room ID
  const [joinById,      setJoinById]      = useState(!roomId);
  const [joinIdInput,   setJoinIdInput]   = useState('');

  const chatBottomRef = useRef(null);
  const menuRef       = useRef(null);

  const {
    localVideoRef, peers, peerCount, roomFull,
    isAudioMuted, isVideoOff, isSharing, isRecording, recordingTime, formatTime,
    facingMode,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    toggleScreenShare, toggleRecording, switchCamera,
    maxPeers,
  } = useGroupWebRTC(roomId || joinIdInput.toUpperCase());

  // FIX 11 — use socket id to detect duplicate join
  useEffect(() => {
    if (!hasJoined && roomId) {
      setHasJoined(true);
      joinRoom(user?.name || 'Guest');
    }
  }, [roomId]);

  // FIX 7 — auto scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close menu on outside click
  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleHangUp = () => { hangUp(); navigate('/'); };

  const copyLink = () => {
    const id = roomId || joinIdInput.toUpperCase();
    navigator.clipboard.writeText(`${window.location.origin}/group/${id}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // FIX 6 — Trigger reaction with animation
  const sendReaction = (emoji) => {
    setReaction(emoji);
    setShowReactions(false);
    setTimeout(() => setReaction(null), 2500);
  };

  // FIX 7 — Send chat message
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

  // FIX 10 — Join by room ID
  const handleJoinById = () => {
    const id = joinIdInput.trim().toUpperCase();
    if (!id || id.length < 4) return;
    navigate(`/group/${id}`);
  };

  // Grid layout
  const totalParticipants = peers.length + 1;
  const getGridClass = () => {
    if (totalParticipants <= 1) return 'grid-cols-1 max-w-xl mx-auto';
    if (totalParticipants <= 2) return 'grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  if (roomFull) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-4">
        <div className="terminal-border bg-panel p-10 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="font-display text-xl text-white mb-3">ROOM FULL</h2>
          <p className="font-body text-sm text-muted mb-6">
            This room already has {maxPeers} participants.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">← GO BACK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      {/* Floating reaction animation FIX 6 */}
      {reaction && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-8xl animate-bounce">{reaction}</div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-panel/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="font-display text-xs text-muted hover:text-white tracking-widest uppercase transition-colors">
            ← PLEXUSTALK
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="font-display text-xs text-muted hidden sm:block">GROUP</span>
          <button onClick={copyLink} className="font-display text-sm text-accent tracking-widest hover:underline">
            {roomId || '—'}
          </button>
          <button onClick={copyLink} className="font-display text-xs text-muted/50 hover:text-accent transition-colors">
            {copied ? '✓' : '⎘'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-1.5 border border-warn/40 bg-warn/10 px-2 py-1 rounded-full">
              <div className="w-2 h-2 rounded-full bg-warn animate-pulse" />
              <span className="font-display text-xs text-warn">{formatTime(recordingTime)}</span>
            </div>
          )}
          <div className="flex items-center gap-2 border border-border px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="font-display text-xs text-accent tracking-widest">{totalParticipants}/{maxPeers}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 border border-info/30 bg-info/5 px-3 py-1.5 rounded-full">
            <span className="font-display text-xs text-info tracking-widest">👥 GROUP</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video + Controls */}
        <div className="flex-1 p-3 flex flex-col gap-3 min-h-0">

          {/* Video Grid */}
          <div className={`flex-1 grid ${getGridClass()} gap-3 min-h-0`}>
            {/* Local tile */}
            {/* Local tile — use a dedicated video element instead of passing stream */}
<div className="relative bg-panel border border-border overflow-hidden rounded-lg aspect-video group">
  <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-accent/40 z-10" />
  <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-accent/40 z-10" />
  <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-accent/40 z-10" />
  <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-accent/40 z-10" />

  {isVideoOff ? (
    <div className="w-full h-full flex flex-col items-center justify-center bg-void gap-3">
      <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
        <span className="font-display text-xl text-accent">
          {user?.name?.charAt(0)?.toUpperCase() || 'A'}
        </span>
      </div>
      <span className="font-display text-xs text-muted tracking-widest">CAM OFF</span>
    </div>
  ) : (
    <video
      ref={localVideoRef}
      autoPlay playsInline muted
      className="w-full h-full object-cover"
    />
  )}

  {isAudioMuted && (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-warn/80 backdrop-blur px-2 py-1 rounded-full flex items-center gap-1">
      <span className="text-xs">🔇</span>
      <span className="font-display text-xs text-void tracking-widest">MUTED</span>
    </div>
  )}

  <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
    <span className="font-display text-xs text-white/90 bg-void/70 backdrop-blur px-2 py-0.5 rounded tracking-widest">
      {user?.name || 'You'} (YOU)
    </span>
  </div>
</div>

            {/* Remote peers */}
            {peers.map(peer => (
              <VideoTile
                key={peer.socketId}
                stream={peer.stream}
                name={peer.name}
                isLocal={false}
                isVideoOff={false}
                isMuted={peer.isMuted} // FIX 9
              />
            ))}

            {/* Empty slots */}
            {Array.from({
              length: Math.max(0,
                (totalParticipants <= 2 ? 2 :
                 totalParticipants <= 4 ? 4 :
                 totalParticipants <= 6 ? 6 : 8) - totalParticipants
              )
            }).map((_, i) => (
              <div key={`empty-${i}`} className="relative bg-panel/20 border border-border/30 rounded-lg aspect-video flex items-center justify-center">
                <div className="text-center">
                  <div className="font-display text-3xl text-border mb-1">+</div>
                  <span className="font-display text-xs text-muted/30 tracking-widest">AWAITING PEER</span>
                </div>
              </div>
            ))}
          </div>

          {/* FIX 6 — Reactions row */}
          <div className="flex items-center justify-center gap-2">
            {REACTIONS.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-xl hover:scale-125 transition-transform active:scale-150"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Controls — Meet style */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center gap-2 bg-panel/90 backdrop-blur border border-border/60 rounded-full px-4 py-2">

              {/* Mic */}
              <button onClick={toggleAudio}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all
                  ${isAudioMuted ? 'bg-warn/20 ring-2 ring-warn/50' : 'bg-white/10 hover:bg-white/20'}`}
                title={isAudioMuted ? 'Unmute' : 'Mute'}>
                {isAudioMuted ? '🔇' : '🎤'}
              </button>

              {/* Camera */}
              <button onClick={toggleVideo}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all
                  ${isVideoOff ? 'bg-warn/20 ring-2 ring-warn/50' : 'bg-white/10 hover:bg-white/20'}`}
                title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
                {isVideoOff ? '📷' : '📹'}
              </button>

              {/* FIX 8 — Switch camera (mobile) */}
              <button onClick={switchCamera}
                className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-lg transition-all sm:hidden"
                title="Switch camera">
                🔄
              </button>

              {/* FIX 1 — Screen share */}
              <button onClick={toggleScreenShare}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all
                  ${isSharing ? 'bg-info/20 ring-2 ring-info/50' : 'bg-white/10 hover:bg-white/20'}`}
                title={isSharing ? 'Stop sharing' : 'Share screen'}>
                🖥
              </button>

              {/* FIX 7 — Chat */}
              <button onClick={() => setChatOpen(o => !o)}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all
                  ${chatOpen ? 'bg-accent/20 ring-2 ring-accent/50' : 'bg-white/10 hover:bg-white/20'}`}
                title="Chat">
                💬
              </button>

              {/* Divider */}
              <div className="h-7 w-px bg-border/60 mx-1" />

              {/* Hang up */}
              <button onClick={handleHangUp}
                className="w-14 h-11 rounded-2xl bg-warn flex items-center justify-center text-lg hover:bg-warn/80 transition-all"
                title="Leave call">
                📵
              </button>

              {/* Divider */}
              <div className="h-7 w-px bg-border/60 mx-1" />

              {/* FIX 2 — Recording */}
              <button onClick={toggleRecording}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all
                  ${isRecording ? 'bg-warn/20 ring-2 ring-warn/50' : 'bg-white/10 hover:bg-white/20'}`}
                title={isRecording ? 'Stop recording' : 'Record'}>
                {isRecording ? '⏹' : '⏺'}
              </button>

              {/* 3-dot menu */}
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenuOpen(o => !o)}
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-lg transition-all
                    ${menuOpen ? 'bg-accent/20' : 'bg-white/10 hover:bg-white/20'}`}>
                  ⋮
                </button>
                {menuOpen && (
                  <div className="absolute bottom-14 right-0 w-52 bg-panel border border-border rounded-xl overflow-hidden z-50 shadow-2xl">
                    <div className="px-4 py-2 border-b border-border">
                      <span className="font-display text-xs text-muted tracking-widest">MORE OPTIONS</span>
                    </div>
                    {[
                      { icon: '🔗', label: copied ? 'Copied!' : 'Copy invite link', action: () => { copyLink(); setMenuOpen(false); } },
                      { icon: isSharing ? '⏹' : '🖥', label: isSharing ? 'Stop sharing' : 'Share screen', action: () => { toggleScreenShare(); setMenuOpen(false); } },
                      { icon: isRecording ? '⏹' : '⏺', label: isRecording ? 'Stop recording' : 'Start recording', action: () => { toggleRecording(); setMenuOpen(false); } },
                      { icon: '💬', label: 'Open chat', action: () => { setChatOpen(true); setMenuOpen(false); } },
                      { icon: '🔄', label: 'Switch camera', action: () => { switchCamera(); setMenuOpen(false); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-border/30 last:border-0">
                        <span className="text-base">{item.icon}</span>
                        <span className="font-body text-sm text-white">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'PARTICIPANTS', value: `${totalParticipants}/${maxPeers}`, color: 'text-accent' },
              { label: 'ARCHITECTURE', value: 'MESH P2P', color: 'text-white' },
              { label: 'ENCRYPTION',   value: 'DTLS-SRTP', color: 'text-info' },
            ].map(s => (
              <div key={s.label} className="bg-panel border border-border rounded-lg p-3 text-center">
                <span className="font-display text-xs text-muted tracking-widest block mb-1">{s.label}</span>
                <span className={`font-display text-sm font-bold ${s.color}`}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FIX 7 — Chat sidebar */}
        {chatOpen && (
          <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-panel/70 backdrop-blur flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-display text-xs text-muted tracking-widest">GROUP CHAT</span>
              <button onClick={() => setChatOpen(false)} className="text-muted hover:text-white text-lg">✕</button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0" style={{ maxHeight: '400px' }}>
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <span className="font-display text-xs text-muted/40 tracking-widest">NO MESSAGES YET</span>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col gap-0.5 ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 text-xs font-body rounded-lg
                      ${msg.isSelf
                        ? 'bg-accent/20 border border-accent/30 text-white'
                        : 'bg-void border border-border text-white'
                      }`}>
                      {msg.text}
                    </div>
                    <span className="font-display text-xs text-muted/40">{msg.sender} · {msg.time}</span>
                  </div>
                ))
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div className="flex border-t border-border">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                placeholder="Type message..."
                className="flex-1 bg-void text-white text-xs font-body px-3 py-3 outline-none placeholder-muted/40"
              />
              <button onClick={sendMessage}
                className="px-3 text-accent border-l border-border hover:text-accent/70 transition-colors text-lg">
                ➤
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
