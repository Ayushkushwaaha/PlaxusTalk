import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from '../lib/AuthContext';
import { getSocket } from '../lib/socket';
import VideoPlayer from './VideoPlayer';
import CallControls from './CallControls';
import StatsPanel from './StatsPanel';
import WalletButton from './WalletButton';
import ChatPanel from './ChatPanel';
import Reactions from './Reactions';
import RaiseHand from './RaiseHand';

// ── Screen Share (fixed) ──────────────────────────────────────────────────────
function useScreenShare(localVideoRef, localStreamRef, pcRef) {
  const [isSharing, setIsSharing] = useState(false);
  const screenStreamRef = useRef(null);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in ALL peer connections
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(screenTrack);
        } else {
          // Add track if none exists
          pcRef.current.addTrack(screenTrack, screenStream);
        }
      }

      // Show in local video
      if (localVideoRef.current) {
        const combined = new MediaStream([
          screenTrack,
          ...(localStreamRef.current?.getAudioTracks() || []),
        ]);
        localVideoRef.current.srcObject = combined;
      }

      // Auto stop when browser UI stop button clicked
      screenTrack.onended = () => stopScreenShare();
      setIsSharing(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('Screen share error:', err);
      }
    }
  }, [localVideoRef, localStreamRef, pcRef]);

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    // Restore camera
    if (pcRef.current && localStreamRef.current) {
      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack);
      }
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setIsSharing(false);
  }, [localVideoRef, localStreamRef, pcRef]);

  const toggleScreenShare = useCallback(() => {
    if (isSharing) stopScreenShare();
    else startScreenShare();
  }, [isSharing, startScreenShare, stopScreenShare]);

  return { isSharing, toggleScreenShare };
}

// ── Recording ─────────────────────────────────────────────────────────────────
function useRecording(localVideoRef, remoteVideoRef) {
  const [isRecording, setIsRecording]     = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef                  = useRef(null);
  const chunksRef                         = useRef([]);
  const timerRef                          = useRef(null);

  const startRecording = useCallback(async () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280; canvas.height = 360;
      const ctx = canvas.getContext('2d');
      const local = localVideoRef.current;
      const remote = remoteVideoRef.current;

      const draw = () => {
        if (mediaRecorderRef.current?.state !== 'recording') return;
        ctx.fillStyle = '#060608';
        ctx.fillRect(0, 0, 1280, 360);
        if (remote?.srcObject) ctx.drawImage(remote, 0, 0, 640, 360);
        if (local?.srcObject)  ctx.drawImage(local,  640, 0, 640, 360);
        requestAnimationFrame(draw);
      };

      const canvasStream = canvas.captureStream(30);
      local?.srcObject?.getAudioTracks().forEach((t) => canvasStream.addTrack(t));

      const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp8,opus' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = `PlexusTalk-${new Date().toISOString().slice(0, 19)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      draw();
    } catch (err) { console.error('Recording error:', err); }
  }, [localVideoRef, remoteVideoRef]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const toggleRecording = () => { if (isRecording) stopRecording(); else startRecording(); };
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return { isRecording, recordingTime, formatTime, toggleRecording };
}

// ── PiP ───────────────────────────────────────────────────────────────────────
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

// ── RoomPage ──────────────────────────────────────────────────────────────────
export default function RoomPage() {
  const { roomId }  = useParams();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const chatRef     = useRef(null);  // FIX 3 — chat scroll ref
  const sidebarRef  = useRef(null);

  const [walletAddress, setWalletAddress] = useState(null);
  const [hasJoined,     setHasJoined]     = useState(false);
  const [copied,        setCopied]        = useState(false);

  const {
    localVideoRef, remoteVideoRef, connectionState, iceState,
    isAudioMuted, isVideoOff, latency, isP2P, peerCount, callId,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    localStreamRef, pcRef,
  } = useWebRTC(roomId);

  const { isSharing,   toggleScreenShare }           = useScreenShare(localVideoRef, localStreamRef, pcRef);
  const { isRecording, recordingTime, formatTime, toggleRecording } = useRecording(localVideoRef, remoteVideoRef);
  const { isPiP,       togglePiP, isPiPSupported }   = usePiP(remoteVideoRef);

  const socket = getSocket();

  // FIX 6 — Auto disconnect when peer leaves
  useEffect(() => {
    const onPeerLeft = ({ userCount }) => {
      if (userCount === 0) {
        // Peer left — auto hang up after 3 seconds if not reconnected
        setTimeout(() => {
          if (connectionState !== 'connected') {
            hangUp();
            navigate('/');
          }
        }, 3000);
      }
    };
    socket.on('peer-left', onPeerLeft);
    return () => socket.off('peer-left', onPeerLeft);
  }, [socket, navigate, hangUp, connectionState]);

  // FIX 6 — Room ended by admin
  useEffect(() => {
    const onRoomEnded = () => { hangUp(); navigate('/'); };
    socket.on('room-ended', onRoomEnded);
    return () => socket.off('room-ended', onRoomEnded);
  }, [socket, navigate, hangUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'm' || e.key === 'M') toggleAudio();
      if (e.key === 'v' || e.key === 'V') toggleVideo();
      if (e.key === 's' || e.key === 'S') toggleScreenShare();
      if (e.key === 'c' || e.key === 'C') scrollToChat();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleAudio, toggleVideo, toggleScreenShare]);

  useEffect(() => {
    if (!hasJoined) {
      setHasJoined(true);
      joinRoom(walletAddress, user?.id, user?.name);
    }
  }, []);

  const handleWalletConnected = (address) => {
    setWalletAddress(address);
    if (socket.connected) socket.emit('update-wallet', { roomId, wallet: address });
  };

  const handleHangUp = () => { hangUp(); navigate('/'); };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // FIX 3 — Scroll to chat
  const scrollToChat = useCallback(() => {
    if (chatRef.current) {
      chatRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Also open the chat panel
      const chatToggle = chatRef.current.querySelector('button');
      if (chatToggle) chatToggle.click();
    } else if (sidebarRef.current) {
      sidebarRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const isConnected = connectionState === 'connected';

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]
          rounded-full transition-all duration-1000 blur-[200px]
          ${isConnected ? 'bg-accent opacity-[0.02]' : 'bg-void opacity-0'}`} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 border-b border-border bg-void/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="font-display text-xs text-muted hover:text-white tracking-widest uppercase transition-colors">
            ← PLEXUSTALK
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-display text-xs text-muted hidden sm:block">ROOM</span>
            <button onClick={copyRoomLink} className="font-display text-sm text-accent tracking-widest hover:glow-accent-text">{roomId}</button>
            <button onClick={copyRoomLink} className="font-display text-xs text-muted/50 hover:text-accent">{copied ? '✓' : '⎘'}</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="font-display text-xs text-muted hidden sm:block">{user.name?.toUpperCase()}</span>}
          <div className="flex items-center gap-2 border border-border px-3 py-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent animate-pulse' : connectionState === 'connecting' ? 'bg-warn animate-pulse' : 'bg-muted'}`} />
            <span className="font-display text-xs tracking-widest text-muted">{connectionState.toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Video + controls */}
        <div className="flex-1 flex flex-col p-3 gap-3">
          {/* Videos */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
            <VideoPlayer videoRef={remoteVideoRef} label="REMOTE PEER" isLocal={false} isVideoOff={false} connectionState={connectionState} />
            <VideoPlayer videoRef={localVideoRef} label={`YOU${isSharing ? ' (SCREEN)' : ''}`} isLocal={true} isVideoOff={isVideoOff} connectionState={connectionState} />
          </div>

          {/* Reactions row */}
          <div className="flex items-center justify-center gap-3">
            <Reactions roomId={roomId} />
            <RaiseHand roomId={roomId} />
          </div>

          {/* Controls */}
          <CallControls
            isAudioMuted={isAudioMuted}
            isVideoOff={isVideoOff}
            isSharing={isSharing}
            isRecording={isRecording}
            recordingTime={recordingTime}
            formatTime={formatTime}
            isPiP={isPiP}
            isPiPSupported={isPiPSupported}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onHangUp={handleHangUp}
            onToggleScreen={toggleScreenShare}
            onToggleRecording={toggleRecording}
            onTogglePiP={togglePiP}
            onScrollToChat={scrollToChat}
            roomId={roomId}
          />

          {/* Stats */}
          <div id="stats-panel">
            <StatsPanel
              latency={latency} isP2P={isP2P}
              connectionState={connectionState} iceState={iceState}
              peerCount={peerCount} callId={callId}
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside ref={sidebarRef} className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-panel/60 backdrop-blur flex flex-col overflow-y-auto">
          <div className="px-5 py-4 border-b border-border">
            <span className="font-display text-xs text-muted tracking-widest">SESSION PANEL</span>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {/* FIX 3 — Chat with ref so we can scroll to it */}
            <div ref={chatRef}>
              <ChatPanel roomId={roomId} currentUser={user} />
            </div>

            {/* Wallet */}
            <section className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-px bg-accent/40" />
                <span className="font-display text-xs text-accent/60 tracking-widest">BLOCKCHAIN</span>
              </div>
              <WalletButton onWalletConnected={handleWalletConnected} currentUser={user} roomId={roomId} />
            </section>

            {/* Invite */}
            <section className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-px bg-accent/40" />
                <span className="font-display text-xs text-accent/60 tracking-widest">INVITE</span>
              </div>
              <div className="bg-void border border-border p-3 flex flex-col gap-3">
                <div>
                  <p className="font-display text-xs text-muted tracking-widest mb-1">ROOM ID</p>
                  <p className="font-display text-lg text-accent glow-accent-text">{roomId}</p>
                </div>
                <button onClick={copyRoomLink} className="btn-secondary text-center text-xs py-2">
                  {copied ? '✓ COPIED' : 'COPY LINK'}
                </button>
              </div>
            </section>

            {/* Live stats */}
            <section className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-px bg-accent/40" />
                <span className="font-display text-xs text-accent/60 tracking-widest">LIVE STATS</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  ['Screen Share', isSharing ? 'ACTIVE' : 'OFF'],
                  ['Recording',   isRecording ? formatTime(recordingTime) : 'OFF'],
                  ['Connection',  connectionState.toUpperCase()],
                  ['Peers',       `${peerCount}/2`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-1.5 border-b border-border/50">
                    <span className="font-display text-xs text-muted/60 tracking-wider">{k}</span>
                    <span className={`font-display text-xs ${v === 'ACTIVE' || (k === 'Recording' && isRecording) ? 'text-warn' : 'text-white/80'}`}>{v}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
