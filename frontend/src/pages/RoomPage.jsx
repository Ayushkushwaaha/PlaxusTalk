import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from '../lib/AuthContext';
import { getSocket } from '../lib/socket';
import VideoPlayer from '../components/VideoPlayer';
import StatsPanel from '../components/StatsPanel';
import WalletButton from '../components/WalletButton';
import ChatPanel from '../components/ChatPanel';
import Reactions from '../components/Reactions';
import RaiseHand from '../components/RaiseHand';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// ── Screen Share Hook ─────────────────────────────────────────────────────────
function useScreenShare(localVideoRef, localStreamRef, pcRef) {
  const [isSharing, setIsSharing] = useState(false);
  const screenStreamRef = useRef(null);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' }, audio: false,
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) await sender.replaceTrack(screenTrack);
        else pcRef.current.addTrack(screenTrack, screenStream);
      }

      if (localVideoRef.current) {
        const combined = new MediaStream([
          screenTrack,
          ...(localStreamRef.current?.getAudioTracks() || []),
        ]);
        localVideoRef.current.srcObject = combined;
      }

      screenTrack.onended = () => stopScreenShare();
      setIsSharing(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError') console.error('Screen share error:', err);
    }
  }, [localVideoRef, localStreamRef, pcRef]);

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (pcRef.current && cameraTrack) {
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(cameraTrack);
    }
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setIsSharing(false);
  }, [localVideoRef, localStreamRef, pcRef]);

  const toggleScreenShare = () => { if (isSharing) stopScreenShare(); else startScreenShare(); };
  return { isSharing, toggleScreenShare };
}

// ── Recording Hook ────────────────────────────────────────────────────────────
function useRecording(localVideoRef) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);
  const timerRef    = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const video = localVideoRef.current;
      if (!video?.srcObject) return;
      const recorder = new MediaRecorder(video.srcObject, { mimeType: 'video/webm;codecs=vp8,opus' });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PlexusTalk-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) { console.error('Recording error:', err); }
  }, [localVideoRef]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const toggleRecording = () => { if (isRecording) stopRecording(); else startRecording(); };
  const formatTime = t => `${String(Math.floor(t / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}`;
  return { isRecording, recordingTime, formatTime, toggleRecording };
}

// ── PiP Hook ──────────────────────────────────────────────────────────────────
function usePiP(remoteVideoRef) {
  const [isPiP, setIsPiP] = useState(false);
  const togglePiP = useCallback(async () => {
    if (!remoteVideoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture(); setIsPiP(false);
      } else {
        await remoteVideoRef.current.requestPictureInPicture(); setIsPiP(true);
        remoteVideoRef.current.onleavepictureinpicture = () => setIsPiP(false);
      }
    } catch (err) { console.error('PiP error:', err); }
  }, [remoteVideoRef]);
  return { isPiP, togglePiP, isPiPSupported: !!document.pictureInPictureEnabled };
}

// ── Main RoomPage ─────────────────────────────────────────────────────────────
export default function RoomPage() {
  const { roomId } = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const socket     = getSocket();

  const [walletAddress, setWalletAddress] = useState(null);
  const [hasJoined,     setHasJoined]     = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const menuRef  = useRef(null);
  const chatRef  = useRef(null);
  const sidebarRef = useRef(null);

  const {
    localVideoRef, remoteVideoRef, connectionState, iceState,
    isAudioMuted, isVideoOff, latency, isP2P, peerCount, callId,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    localStreamRef, pcRef,
  } = useWebRTC(roomId);

  const { isSharing,   toggleScreenShare }             = useScreenShare(localVideoRef, localStreamRef, pcRef);
  const { isRecording, recordingTime, formatTime, toggleRecording } = useRecording(localVideoRef);
  const { isPiP,       togglePiP, isPiPSupported }     = usePiP(remoteVideoRef);

  // FIX 6 — Auto disconnect when peer leaves
  useEffect(() => {
    const onPeerLeft = ({ userCount }) => {
      if (userCount === 0) {
        setTimeout(() => { hangUp(); navigate('/'); }, 3000);
      }
    };
    socket.on('peer-left', onPeerLeft);
    socket.on('room-ended', () => { hangUp(); navigate('/'); });
    return () => {
      socket.off('peer-left', onPeerLeft);
      socket.off('room-ended');
    };
  }, [socket, navigate, hangUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'm' || e.key === 'M') toggleAudio();
      if (e.key === 'v' || e.key === 'V') toggleVideo();
      if (e.key === 's' || e.key === 'S') toggleScreenShare();
      if (e.key === 'c' || e.key === 'C') scrollToChat();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleAudio, toggleVideo, toggleScreenShare]);

  // Close menu on outside click
  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!hasJoined) {
      setHasJoined(true);
      joinRoom(walletAddress, user?.id, user?.name);
    }
  }, []);

  const handleHangUp = () => { hangUp(); navigate('/'); };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // FIX 3 — Scroll sidebar to chat section and open it
  const scrollToChat = useCallback(() => {
    if (sidebarRef.current) {
      sidebarRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (chatRef.current) {
      chatRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const isConnected = connectionState === 'connected';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#060608', overflow: 'hidden', color: '#e8e8f0' }}>

      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid #1a1a24',
        background: 'rgba(13,13,18,0.9)', backdropFilter: 'blur(10px)',
        flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px', letterSpacing: '0.1em' }}>
            ← PLEXUSTALK
          </button>
          <div style={{ width: '1px', height: '16px', background: '#1a1a24' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c' }}>ROOM</span>
          <button onClick={copyRoomLink}
            style={{ background: 'none', border: 'none', color: '#00ff88', cursor: 'pointer', fontFamily: 'monospace', fontSize: '13px', letterSpacing: '0.15em' }}>
            {roomId}
          </button>
          <span onClick={copyRoomLink} style={{ cursor: 'pointer', color: '#4a4a5c', fontSize: '12px' }}>{copied ? '✓' : '⎘'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {user && <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c' }}>{user.name?.toUpperCase()}</span>}
          {isRecording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', padding: '4px 10px', borderRadius: '20px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff6b35', animation: 'pulse 1s infinite' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ff6b35' }}>REC {formatTime(recordingTime)}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #1a1a24', padding: '5px 12px', borderRadius: '20px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? '#00ff88' : '#ff6b35', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.1em' }}>{connectionState.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* VIDEO + CONTROLS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '10px', minHeight: 0, overflow: 'hidden' }}>

          {/* Videos */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', minHeight: 0 }}>
            <VideoPlayer videoRef={remoteVideoRef} label="REMOTE PEER" isLocal={false} isVideoOff={false} connectionState={connectionState} />
            <VideoPlayer videoRef={localVideoRef} label={isSharing ? 'YOU (SCREEN)' : 'YOU'} isLocal={true} isVideoOff={isVideoOff} connectionState={connectionState} />
          </div>

          {/* Reactions row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexShrink: 0 }}>
            <Reactions roomId={roomId} />
            <RaiseHand roomId={roomId} />
          </div>

          {/* FIX 2+5 — Google Meet style control bar */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(13,13,18,0.92)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50px',
              padding: '8px 18px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}>
              {/* Mic */}
              <Cbtn onClick={toggleAudio} active={isAudioMuted} title="Mute (M)">
                {isAudioMuted ? '🔇' : '🎤'}
              </Cbtn>

              {/* Camera */}
              <Cbtn onClick={toggleVideo} active={isVideoOff} title="Camera (V)">
                {isVideoOff ? '📷' : '📹'}
              </Cbtn>

              {/* Screen share — FIX 1 */}
              <Cbtn onClick={toggleScreenShare} active={isSharing} activeColor="#4da6ff" title="Share screen (S)">
                🖥
              </Cbtn>

              {/* FIX 3 — Chat scrolls to chat panel */}
              <Cbtn onClick={scrollToChat} title="Chat (C)">
                💬
              </Cbtn>

              {/* Reactions */}
              <Cbtn onClick={() => {}} title="Reactions">
                😊
              </Cbtn>

              {/* Raise hand */}
              <Cbtn onClick={() => {}} title="Raise hand">
                ✋
              </Cbtn>

              {/* Divider */}
              <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

              {/* Hang up — FIX 6 */}
              <button onClick={handleHangUp} title="Leave call"
                style={{
                  width: '54px', height: '46px', borderRadius: '16px', border: 'none',
                  cursor: 'pointer', fontSize: '18px',
                  background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                  boxShadow: '0 4px 14px rgba(239,68,68,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                📵
              </button>

              {/* Divider */}
              <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

              {/* PiP */}
              {isPiPSupported && (
                <Cbtn onClick={togglePiP} active={isPiP} title="Picture in Picture">
                  ⧉
                </Cbtn>
              )}

              {/* Record */}
              <Cbtn onClick={toggleRecording} active={isRecording} activeColor="#ff6b35" title="Record">
                {isRecording ? '⏹' : '⏺'}
              </Cbtn>

              {/* FIX 5 — 3-dot menu */}
              <div style={{ position: 'relative' }} ref={menuRef}>
                <Cbtn onClick={() => setMenuOpen(o => !o)} active={menuOpen} title="More options">
                  ⋮
                </Cbtn>
                {menuOpen && (
                  <div style={{
                    position: 'absolute', bottom: '54px', right: '-8px',
                    width: '210px', background: '#0d0d12',
                    border: '1px solid #1a1a24', borderRadius: '14px',
                    overflow: 'hidden', zIndex: 100,
                    boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
                  }}>
                    <div style={{ padding: '8px 16px', borderBottom: '1px solid #1a1a24' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.2em' }}>MORE OPTIONS</span>
                    </div>
                    {[
                      { icon: '🔗', label: copied ? 'Link Copied!' : 'Copy invite link', action: () => { copyRoomLink(); setMenuOpen(false); } },
                      { icon: '⧉',  label: 'Picture in Picture',  action: () => { togglePiP(); setMenuOpen(false); } },
                      { icon: isRecording ? '⏹' : '⏺', label: isRecording ? 'Stop recording' : 'Start recording', action: () => { toggleRecording(); setMenuOpen(false); } },
                      { icon: '🖥',  label: isSharing ? 'Stop screen share' : 'Share screen', action: () => { toggleScreenShare(); setMenuOpen(false); } },
                      { icon: '💬',  label: 'Open chat',          action: () => { scrollToChat(); setMenuOpen(false); } },
                      { icon: '📊',  label: 'View stats',         action: () => { document.getElementById('stats-panel')?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false); } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 16px', background: 'none', border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          cursor: 'pointer', color: '#e8e8f0', textAlign: 'left', fontSize: '13px',
                          transition: 'background 0.15s',
                        }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseOut={e => e.currentTarget.style.background = 'none'}>
                        <span style={{ fontSize: '15px', width: '20px' }}>{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Keyboard hints */}
            <div style={{ display: 'flex', gap: '16px', opacity: 0.3 }}>
              {[['M','Mute'],['V','Video'],['S','Share'],['C','Chat']].map(([k,l]) => (
                <span key={k} style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ border: '1px solid #1a1a24', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>{k}</span> {l}
                </span>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div id="stats-panel" style={{ flexShrink: 0 }}>
            <StatsPanel latency={latency} isP2P={isP2P} connectionState={connectionState} iceState={iceState} peerCount={peerCount} callId={callId} />
          </div>
        </div>

        {/* SIDEBAR */}
        <div ref={sidebarRef} style={{
          width: '272px', borderLeft: '1px solid #1a1a24',
          background: 'rgba(13,13,18,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a24' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', letterSpacing: '0.2em' }}>SESSION PANEL</span>
          </div>

          {/* FIX 3 — Chat section with ref */}
          <div ref={chatRef} style={{ borderBottom: '1px solid #1a1a24' }}>
            <ChatPanel roomId={roomId} currentUser={user} />
          </div>

          {/* Blockchain */}
          <div style={{ padding: '16px', borderBottom: '1px solid #1a1a24' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '16px', height: '1px', background: 'rgba(0,255,136,0.4)' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(0,255,136,0.6)', letterSpacing: '0.2em' }}>BLOCKCHAIN</span>
            </div>
            <WalletButton onWalletConnected={addr => { setWalletAddress(addr); socket.emit('update-wallet', { roomId, wallet: addr }); }} currentUser={user} roomId={roomId} />
          </div>

          {/* Invite */}
          <div style={{ padding: '16px', borderBottom: '1px solid #1a1a24' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '16px', height: '1px', background: 'rgba(0,255,136,0.4)' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(0,255,136,0.6)', letterSpacing: '0.2em' }}>INVITE</span>
            </div>
            <div style={{ background: '#060608', border: '1px solid #1a1a24', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '9px', color: '#4a4a5c', letterSpacing: '0.15em', marginBottom: '4px' }}>ROOM ID</div>
              <div style={{ fontFamily: 'monospace', fontSize: '18px', color: '#00ff88', letterSpacing: '0.15em' }}>{roomId}</div>
            </div>
            <button onClick={copyRoomLink}
              style={{
                width: '100%', background: 'transparent', border: '1px solid rgba(0,255,136,0.25)',
                color: '#00ff88', fontFamily: 'monospace', fontSize: '10px', letterSpacing: '0.15em',
                padding: '8px', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.2s',
              }}>
              {copied ? '✓ COPIED' : '⎘ COPY LINK'}
            </button>
          </div>

          {/* Live stats */}
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <div style={{ width: '16px', height: '1px', background: 'rgba(0,255,136,0.4)' }} />
              <span style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(0,255,136,0.6)', letterSpacing: '0.2em' }}>LIVE STATS</span>
            </div>
            {[
              ['Screen Share', isSharing ? 'ACTIVE' : 'OFF', isSharing ? '#00ff88' : '#4a4a5c'],
              ['Recording',   isRecording ? formatTime(recordingTime) : 'OFF', isRecording ? '#ff6b35' : '#4a4a5c'],
              ['Connection',  connectionState.toUpperCase(), isConnected ? '#00ff88' : '#ff6b35'],
              ['Peers',       `${peerCount}/2`, '#e8e8f0'],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c' }}>{k}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '10px', color: c, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }`}</style>
    </div>
  );
}

// ── Control Button Component ──────────────────────────────────────────────────
function Cbtn({ onClick, active, activeColor, title, children }) {
  const [hovered, setHovered] = useState(false);
  const col = activeColor || 'rgba(255,107,53,0.6)';
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '44px', height: '44px', borderRadius: '50%', border: 'none',
        cursor: 'pointer', fontSize: '17px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active
          ? `rgba(${col.includes('rgb') ? col.replace(/rgba?\(|\)/g,'').split(',').slice(0,3).join(',') : '255,107,53'},0.18)`
          : hovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
        boxShadow: active ? `0 0 0 2px ${activeColor || 'rgba(255,107,53,0.5)'}` : 'none',
        transition: 'all 0.2s',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}>
      {children}
    </button>
  );
}
