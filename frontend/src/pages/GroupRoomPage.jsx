import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
} from '@livekit/components-react';
import '@livekit/components-styles';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function GroupRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [livekitToken, setLivekitToken] = useState(null);
  const [livekitUrl, setLivekitUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get LiveKit token from backend
    fetch(`${BACKEND_URL}/api/livekit/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        roomName: roomId,
        participantName: user?.name || 'Guest',
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setLivekitToken(data.token);
        setLivekitUrl(data.url);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [roomId, token, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <span className="font-display text-xs text-muted tracking-widest">JOINING ROOM...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-warn mb-4">⚠ {error}</p>
          <button onClick={() => navigate('/')} className="btn-secondary">← GO BACK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="font-display text-xs text-muted hover:text-white tracking-widest uppercase transition-colors">
            ← PLAXUSTALK
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="font-display text-sm text-accent tracking-widest">{roomId}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="font-display text-xs text-accent tracking-widest">GROUP ROOM · UP TO 15 PEERS</span>
        </div>
      </header>

      {/* LiveKit Room */}
      <div className="flex-1" data-lk-theme="default">
        <LiveKitRoom
          video={true}
          audio={true}
          token={livekitToken}
          serverUrl={livekitUrl}
          onDisconnected={() => navigate('/')}
          style={{ height: '100%' }}
        >
          <VideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}