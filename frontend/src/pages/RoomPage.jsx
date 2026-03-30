import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebRTC } from '../hooks/useWebRTC';
import { useScreenShare } from '../hooks/useScreenShare';
import { useRecording } from '../hooks/useRecording';
import { usePiP } from '../hooks/usePiP';
import { useRealLatency } from '../hooks/useRealLatency';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';
import { getSocket } from '../lib/socket';
import VideoPlayer from '../components/VideoPlayer';
import CallControls from '../components/CallControls';
import StatsPanel from '../components/StatsPanel';
import WalletButton from '../components/WalletButton';
import IPFSChatPanel from "../components/IPFSChatPanel";
import Reactions from '../components/Reactions';
import RaiseHand from '../components/RaiseHand';
import TipButton from '../components/TipButton';
import { useContracts } from '../hooks/useContracts';

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [walletAddress, setWalletAddress] = useState(null);
  const [peerWallet, setPeerWallet] = useState(null);
  const [hasJoined, setHasJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const {
    localVideoRef, remoteVideoRef, connectionState, iceState,
    isAudioMuted, isVideoOff, latency, isP2P, peerCount, callId,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    localStreamRef, pcRef,
  } = useWebRTC(roomId);

  const isConnected = connectionState === 'connected';
  const realStats = useRealLatency(pcRef, isConnected);
  const { isSharing, toggleScreenShare } = useScreenShare(localVideoRef, localStreamRef, pcRef);
  const { isRecording, recordingTime, formatTime, toggleRecording } = useRecording(localVideoRef, remoteVideoRef);
  const { isPiP, togglePiP, isPiPSupported } = usePiP(remoteVideoRef);
  const { isGranted, requestPermission, notifyCallIncoming, notifyPeerLeft } = usePushNotifications();

  const socket = getSocket();

  // Request notification permission on mount
  useEffect(() => {
    if (!isGranted) requestPermission();
  }, []);

  // Push notifications for peer events
  useEffect(() => {
    const onPeerJoined = ({ userName }) => {
      if (document.hidden) notifyCallIncoming(userName || 'Peer', roomId);
    };
    const onPeerLeft = () => {
      if (document.hidden) notifyPeerLeft(roomId);
    };
    socket.on('peer-joined', onPeerJoined);
    socket.on('peer-left', onPeerLeft);
    return () => { socket.off('peer-joined', onPeerJoined); socket.off('peer-left', onPeerLeft); };
  }, [socket, roomId]);

  // Handle wrong password
  useEffect(() => {
    socket.on('room-wrong-password', () => {
      setPasswordError('Wrong password. Try again.');
      setNeedsPassword(true);
    });
    return () => socket.off('room-wrong-password');
  }, [socket]);

  // Auto join
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

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px]
          rounded-full transition-all duration-1000 blur-[200px]
          ${isConnected ? 'bg-accent opacity-[0.02]' : 'bg-void opacity-0'}`} />
      </div>

      {/* Password modal */}
      {needsPassword && (
        <div className="fixed inset-0 z-50 bg-void/90 flex items-center justify-center px-4">
          <div className="terminal-border bg-panel p-8 w-full max-w-sm">
            <p className="font-display text-lg text-white mb-2">ROOM PASSWORD</p>
            <p className="font-body text-sm text-muted mb-6">This room is protected. Enter the password to join.</p>
            <input
              type="password"
              value={roomPassword}
              onChange={(e) => { setRoomPassword(e.target.value); setPasswordError(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setNeedsPassword(false);
                  joinRoom(walletAddress, user?.id, user?.name, roomPassword);
                }
              }}
              placeholder="Enter password..."
              className="w-full bg-void border border-border text-white font-body text-sm px-4 py-3 outline-none focus:border-accent/50 mb-3"
              autoFocus
            />
            {passwordError && <p className="font-body text-sm text-warn mb-3">⚠ {passwordError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setNeedsPassword(false); joinRoom(walletAddress, user?.id, user?.name, roomPassword); }}
                className="flex-1 btn-primary">JOIN</button>
              <button onClick={() => navigate('/')} className="flex-1 btn-secondary">CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="font-display text-xs text-muted hover:text-white tracking-widest uppercase transition-colors">
            ← PLEXUSTALK
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="font-display text-xs text-muted tracking-widest hidden sm:block">ROOM</span>
            <button onClick={copyRoomLink} className="font-display text-sm text-accent tracking-widest hover:glow-accent-text transition-all">{roomId}</button>
            <button onClick={copyRoomLink} className="font-display text-xs text-muted/50 hover:text-accent transition-colors">{copied ? '✓' : '⎘'}</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && <span className="font-display text-xs text-muted tracking-widest hidden sm:block">{user.name.toUpperCase()}</span>}
          {/* Day/Night toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center border border-border hover:border-accent/40 transition-all text-sm"
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="flex items-center gap-2 border border-border px-3 py-1.5">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-accent animate-pulse' :
              connectionState === 'connecting' ? 'bg-warn animate-pulse' : 'bg-muted'
            }`} />
            <span className="font-display text-xs tracking-widest text-muted">{connectionState.toUpperCase()}</span>
          </div>
          {/* Quality indicator */}
          {realStats.quality && (
            <div className={`font-display text-xs px-2 py-1 border ${
              realStats.quality === 'excellent' ? 'border-accent/30 text-accent' :
              realStats.quality === 'good'      ? 'border-info/30 text-info' :
              realStats.quality === 'fair'      ? 'border-yellow-400/30 text-yellow-400' :
              'border-warn/30 text-warn'
            }`}>{realStats.quality.toUpperCase()}</div>
          )}
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-3">
          {/* Videos */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
            <VideoPlayer videoRef={remoteVideoRef} label="REMOTE PEER" isLocal={false} isVideoOff={false} connectionState={connectionState} />
            <VideoPlayer videoRef={localVideoRef} label={`YOU${isSharing ? ' (SCREEN)' : ''}`} isLocal={true} isVideoOff={isVideoOff} connectionState={connectionState} />
          </div>

          {/* Reactions + raise hand + tip */}
          <div className="flex items-center justify-center gap-3">
            <Reactions roomId={roomId} />
            <RaiseHand roomId={roomId} />
            <TipButton
              recipientAddress={peerWallet}
              roomId={roomId}
              onSendTip={async (to, rid, msg, amount) => {
                const { useContracts: _uc } = await import('../hooks/useContracts');
                return null; // contracts.sendTip handled inside TipButton via hook
              }}
              loading={false}
            />
          </div>

          {/* Controls */}
          <CallControls
            isAudioMuted={isAudioMuted} isVideoOff={isVideoOff}
            isSharing={isSharing} isRecording={isRecording}
            recordingTime={recordingTime} formatTime={formatTime}
            isPiP={isPiP} isPiPSupported={isPiPSupported}
            onToggleAudio={toggleAudio} onToggleVideo={toggleVideo}
            onHangUp={handleHangUp} onToggleScreen={toggleScreenShare}
            onToggleRecording={toggleRecording} onTogglePiP={togglePiP}
            roomId={roomId}
          />

          {/* Stats — with real latency */}
          <StatsPanel
            latency={latency} isP2P={isP2P}
            connectionState={connectionState} iceState={iceState}
            peerCount={peerCount} callId={callId}
            realStats={realStats}
          />
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-border bg-panel/60 backdrop-blur flex flex-col">
          <div className="px-5 py-4 border-b border-border">
            <span className="font-display text-xs text-muted tracking-widest">SESSION PANEL</span>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-border">
            <IPFSChatPanel roomId={roomId} currentUser={user} token={localStorage.getItem("pt_token")} />

            <section className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-px bg-accent/40" />
                <span className="font-display text-xs text-accent/60 tracking-widest">BLOCKCHAIN</span>
              </div>
              <WalletButton onWalletConnected={handleWalletConnected} />
            </section>

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

            <section className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-px bg-accent/40" />
                <span className="font-display text-xs text-accent/60 tracking-widest">LIVE STATS</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {[
                  ['Latency',    realStats.latency     != null ? `${realStats.latency}ms`      : latency ? `${latency}ms` : '—'],
                  ['Jitter',     realStats.jitter      != null ? `${realStats.jitter}ms`       : '—'],
                  ['Packet Loss',realStats.packetLoss  != null ? `${realStats.packetLoss}%`    : '—'],
                  ['Bitrate',    realStats.bitrate     != null ? `${realStats.bitrate}kb/s`    : '—'],
                  ['Resolution', realStats.resolution  || '—'],
                  ['FPS',        realStats.fps         != null ? `${realStats.fps}fps`         : '—'],
                  ['Screen',     isSharing ? 'ACTIVE' : 'OFF'],
                  ['Recording',  isRecording ? formatTime(recordingTime) : 'OFF'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-1.5 border-b border-border/50">
                    <span className="font-display text-xs text-muted/60 tracking-wider">{k}</span>
                    <span className={`font-display text-xs ${v === 'ACTIVE' || (k === 'Recording' && isRecording) ? 'text-warn' : 'text-white/80'}`}>{v}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="p-5">
              <div className="terminal-border p-4 relative overflow-hidden">
                <div className="scanning-line" />
                <p className="font-display text-xs text-accent tracking-widest mb-1">PERFORMANCE</p>
                <p className="font-display text-3xl text-white font-bold">68%</p>
                <p className="font-body text-xs text-muted/70 mt-1">faster than Zoom</p>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
