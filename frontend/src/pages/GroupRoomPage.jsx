import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useGroupWebRTC } from '../hooks/useGroupWebRTC';

// Single video tile component
function VideoTile({ stream, name, isLocal, isVideoOff }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-panel border border-border overflow-hidden rounded-sm aspect-video">
      {/* Corner brackets */}
      <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t border-l border-accent/40 z-10" />
      <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t border-r border-accent/40 z-10" />
      <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b border-l border-accent/40 z-10" />
      <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b border-r border-accent/40 z-10" />

      {stream && !isVideoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-void">
          <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center mb-2">
            <span className="font-display text-lg text-accent">
              {name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <span className="font-display text-xs text-muted tracking-widest">
            {isVideoOff ? 'CAM OFF' : 'CONNECTING...'}
          </span>
        </div>
      )}

      {/* Name badge */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${isLocal ? 'bg-accent' : 'bg-info'} animate-pulse`} />
        <span className="font-display text-xs text-white/90 bg-void/70 px-2 py-0.5 tracking-widest">
          {isLocal ? `${name} (YOU)` : name}
        </span>
      </div>
    </div>
  );
}

export default function GroupRoomPage() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [hasJoined, setHasJoined] = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [chatOpen,  setChatOpen]  = useState(false);
  const [messages,  setMessages]  = useState([]);
  const [chatInput, setChatInput] = useState('');

  const {
    localVideoRef, peers, peerCount, roomFull,
    isCameraStarted, isAudioMuted, isVideoOff,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    maxPeers,
  } = useGroupWebRTC(roomId);

  useEffect(() => {
    if (!hasJoined) {
      setHasJoined(true);
      joinRoom(user?.name || 'Guest');
    }
  }, []);

  const handleHangUp = () => { hangUp(); navigate('/'); };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/group/${roomId}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // Calculate grid layout based on participant count
  const totalParticipants = peers.length + 1; // +1 for local
  const getGridClass = () => {
    if (totalParticipants <= 1) return 'grid-cols-1';
    if (totalParticipants <= 2) return 'grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-3';
    return 'grid-cols-4';
  };

  if (roomFull) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="terminal-border bg-panel p-10 text-center max-w-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="font-display text-xl text-white mb-2">ROOM FULL</h2>
          <p className="font-body text-sm text-muted mb-6">
            This room already has {maxPeers} participants — the maximum allowed.
          </p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">← GO BACK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-panel/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="font-display text-xs text-muted hover:text-white tracking-widest uppercase transition-colors">
            ← PLAXUSTALK
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-display text-xs text-muted hidden sm:block">GROUP ROOM</span>
            <button onClick={copyLink} className="font-display text-sm text-accent tracking-widest hover:glow-accent-text transition-all">
              {roomId}
            </button>
            <button onClick={copyLink} className="font-display text-xs text-muted/50 hover:text-accent transition-colors">
              {copied ? '✓' : '⎘'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Participant count */}
          <div className="flex items-center gap-2 border border-border px-3 py-1.5">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="font-display text-xs text-accent tracking-widest">
              {totalParticipants}/{maxPeers} PEERS
            </span>
          </div>
          {/* Group badge */}
          <div className="hidden sm:flex items-center gap-2 border border-info/30 bg-info/5 px-3 py-1.5">
            <span className="font-display text-xs text-info tracking-widest">👥 GROUP CALL</span>
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-3 flex flex-col gap-3">
          <div className={`flex-1 grid ${getGridClass()} gap-3 min-h-0`}>
            {/* Local video */}
            <VideoTile
              stream={localVideoRef.current?.srcObject}
              name={user?.name || 'You'}
              isLocal={true}
              isVideoOff={isVideoOff}
            />
            {/* Local video ref holder — hidden */}
            <video ref={localVideoRef} autoPlay playsInline muted className="hidden" />

            {/* Remote peers */}
            {peers.map((peer) => (
              <VideoTile
                key={peer.socketId}
                stream={peer.stream}
                name={peer.name}
                isLocal={false}
                isVideoOff={false}
              />
            ))}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, (totalParticipants <= 2 ? 2 : totalParticipants <= 4 ? 4 : totalParticipants <= 6 ? 6 : 8) - totalParticipants) }).map((_, i) => (
              <div key={`empty-${i}`} className="relative bg-panel/30 border border-border/30 rounded-sm aspect-video flex items-center justify-center">
                <div className="text-center">
                  <div className="font-display text-3xl text-border mb-2">+</div>
                  <span className="font-display text-xs text-muted/30 tracking-widest">AWAITING PEER</span>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 py-2">
            {/* Mic */}
            <button onClick={toggleAudio}
              className={`w-12 h-12 flex items-center justify-center border transition-all rounded-sm text-lg
                ${isAudioMuted ? 'border-warn/50 bg-warn/10 text-warn' : 'border-border bg-panel text-white hover:border-accent/40'}`}
              title={isAudioMuted ? 'Unmute' : 'Mute'}>
              {isAudioMuted ? '🔇' : '🎤'}
            </button>

            {/* Hang up */}
            <button onClick={handleHangUp}
              className="w-14 h-12 flex items-center justify-center border border-warn/40 bg-warn/10 text-warn hover:bg-warn hover:text-void hover:border-warn transition-all rounded-sm text-lg"
              title="Leave call">
              📵
            </button>

            {/* Camera */}
            <button onClick={toggleVideo}
              className={`w-12 h-12 flex items-center justify-center border transition-all rounded-sm text-lg
                ${isVideoOff ? 'border-warn/50 bg-warn/10 text-warn' : 'border-border bg-panel text-white hover:border-accent/40'}`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
              {isVideoOff ? '📷' : '📹'}
            </button>

            {/* Chat toggle */}
            <button onClick={() => setChatOpen((o) => !o)}
              className={`w-12 h-12 flex items-center justify-center border transition-all rounded-sm text-lg
                ${chatOpen ? 'border-accent/50 bg-accent/10 text-accent' : 'border-border bg-panel text-white hover:border-accent/40'}`}
              title="Toggle chat">
              💬
            </button>

            {/* Share */}
            <button onClick={copyLink}
              className="flex items-center gap-1.5 border border-border bg-panel text-muted hover:text-accent hover:border-accent/30 px-3 h-12 font-display text-xs tracking-widest uppercase transition-all rounded-sm">
              {copied ? '✓ COPIED' : '⎘ SHARE'}
            </button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-px bg-border">
            <div className="stat-card p-3 text-center">
              <span className="font-display text-xs text-muted tracking-widest block">PARTICIPANTS</span>
              <span className="font-display text-xl text-accent">{totalParticipants}/{maxPeers}</span>
            </div>
            <div className="stat-card p-3 text-center">
              <span className="font-display text-xs text-muted tracking-widest block">ARCHITECTURE</span>
              <span className="font-display text-sm text-white">MESH P2P</span>
            </div>
            <div className="stat-card p-3 text-center">
              <span className="font-display text-xs text-muted tracking-widest block">ENCRYPTION</span>
              <span className="font-display text-sm text-accent">DTLS-SRTP</span>
            </div>
          </div>
        </div>

        {/* Chat sidebar */}
        {chatOpen && (
          <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-border bg-panel/60 flex flex-col">
            <div className="px-4 py-3 border-b border-border">
              <span className="font-display text-xs text-muted tracking-widest">GROUP CHAT</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-[200px] max-h-[400px]">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <span className="font-display text-xs text-muted/40 tracking-widest">NO MESSAGES YET</span>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex flex-col gap-0.5 ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 text-xs font-body ${msg.isSelf ? 'bg-accent/20 border border-accent/30 text-white' : 'bg-void border border-border text-white'}`}>
                      {msg.text}
                    </div>
                    <span className="font-display text-xs text-muted/40">{msg.sender} · {msg.time}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex border-t border-border">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && chatInput.trim()) {
                    setMessages((prev) => [...prev, {
                      text: chatInput.trim(),
                      sender: user?.name || 'You',
                      isSelf: true,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                    setChatInput('');
                  }
                }}
                placeholder="Type message..."
                className="flex-1 bg-void text-white text-xs font-body px-3 py-2.5 outline-none placeholder-muted/40"
              />
              <button
                onClick={() => {
                  if (chatInput.trim()) {
                    setMessages((prev) => [...prev, {
                      text: chatInput.trim(),
                      sender: user?.name || 'You',
                      isSelf: true,
                      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                    setChatInput('');
                  }
                }}
                className="px-3 text-accent border-l border-border font-display text-xs transition-colors hover:text-accent-dim">
                ➤
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
