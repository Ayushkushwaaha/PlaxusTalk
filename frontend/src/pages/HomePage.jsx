import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useTheme } from '../lib/ThemeContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const STATS = [
  { label: 'Avg Latency', value: '110ms', sub: 'beats Zoom by 68%', accent: true },
  { label: 'P2P Rate',    value: '95%',   sub: 'direct connections', accent: false },
  { label: 'Encryption',  value: 'E2E',   sub: 'DTLS-SRTP',          accent: false },
  { label: 'Relay Usage', value: '0%',    sub: 'pure peer-to-peer',   accent: false },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [joinInput, setJoinInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [activeTab, setActiveTab] = useState('create');

  async function createRoom() {
    setIsCreating(true);
    try {
      const token = localStorage.getItem('pt_token');
      const res = await fetch(`${BACKEND_URL}/api/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const { roomId } = await res.json();
      navigate(`/room/${roomId}`);
    } catch {
      const id = Math.random().toString(36).slice(2, 10).toUpperCase();
      navigate(`/room/${id}`);
    } finally { setIsCreating(false); }
  }

  function joinRoom() {
    const id = joinInput.trim().toUpperCase();
    if (!id) { setJoinError('Enter a room ID'); return; }
    if (id.length < 4) { setJoinError('Invalid room ID'); return; }
    navigate(`/room/${id}`);
  }

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-accent opacity-[0.03] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-info opacity-[0.04] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border bg-panel/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 relative">
            <div className="absolute inset-0 border-2 border-accent rotate-45" />
            <div className="absolute inset-[4px] bg-accent rotate-45" />
          </div>
          <span className="font-display text-accent text-lg tracking-widest glow-accent-text">PLEXUSTALK</span>
        </div>

        <nav className="flex items-center gap-4">
          {/* Day/Night toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center border border-border hover:border-accent/40 bg-panel transition-all"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="font-display text-xs text-muted tracking-widest hidden sm:block">POLYGON MUMBAI</span>
          {user && (
            <>
              <div className="h-3 w-px bg-border" />
              <Link to="/friends" className="font-display text-xs text-muted hover:text-accent tracking-widest uppercase transition-colors hidden sm:block">FRIENDS</Link>
              <Link to="/history" className="font-display text-xs text-muted hover:text-accent tracking-widest uppercase transition-colors hidden sm:block">HISTORY</Link>
              <Link to="/profile" className="font-display text-xs text-muted hover:text-accent tracking-widest uppercase transition-colors">
                {user.name.split(' ')[0].toUpperCase()}
              </Link>
              {user.isAdmin && (
                <Link to="/admin" className="font-display text-xs text-warn hover:text-warn/70 tracking-widest uppercase transition-colors hidden sm:block">ADMIN</Link>
              )}
              <button onClick={() => { logout(); navigate('/login'); }} className="font-display text-xs text-muted hover:text-warn tracking-widest uppercase transition-colors">
                SIGN OUT
              </button>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center mb-12 animate-slide-up">
          <div className="inline-flex items-center gap-2 border border-accent/20 px-4 py-2 mb-8 text-accent font-display text-xs tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            SOVEREIGN P2P VIDEO — BLOCKCHAIN VERIFIED
          </div>
          <h1 className="font-display text-5xl md:text-7xl text-white leading-none mb-6">
            CALL WITHOUT<br />
            <span className="text-accent glow-accent-text">SURVEILLANCE</span>
          </h1>
          <p className="font-body text-muted text-lg max-w-md mx-auto leading-relaxed">
            Direct peer-to-peer video with chat, screen sharing, recording, and blockchain verification.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border w-full max-w-2xl mb-10">
          {STATS.map((s) => (
            <div key={s.label} className="stat-card bg-panel flex flex-col items-center text-center p-5">
              <span className={`font-display text-2xl font-bold ${s.accent ? 'text-accent glow-accent-text' : 'text-white'}`}>{s.value}</span>
              <span className="font-body text-xs text-muted mt-1">{s.label}</span>
              <span className="font-body text-xs text-accent/60 mt-0.5">{s.sub}</span>
            </div>
          ))}
        </div>

        {/* Action panel */}
        <div className="w-full max-w-md terminal-border bg-panel/80 backdrop-blur">
          <div className="flex border-b border-border">
            {['create', 'join'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setJoinError(''); }}
                className={`flex-1 py-4 font-display text-xs tracking-widest uppercase transition-all
                  ${activeTab === tab ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-muted hover:text-white'}`}
              >
                {tab === 'create' ? '+ New Room' : '→ Join Room'}
              </button>
            ))}
          </div>

          <div className="p-8">
            {activeTab === 'create' ? (
  <div className="flex flex-col gap-4">
    <p className="font-body text-sm text-muted">Start an encrypted session with chat, screen share and recording.</p>
    <button onClick={createRoom} disabled={isCreating} className="btn-primary w-full flex items-center justify-center gap-2">
  {isCreating ? (
    <><span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />GENERATING...</>
  ) : 'CREATE SECURE ROOM'}
</button>
<button
  onClick={async () => {
    try {
      const token = localStorage.getItem('pt_token');
      const res = await fetch(`${BACKEND_URL}/api/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const roomId = data.roomId || Math.random().toString(36).slice(2,10).toUpperCase();
      navigate(`/group/${roomId}`);
    } catch {
      navigate(`/group/${Math.random().toString(36).slice(2,10).toUpperCase()}`);
    }
  }}
  className="btn-secondary w-full flex items-center justify-center gap-2"
>
  👥 CREATE GROUP ROOM (UP TO 8)
</button>
<p className="font-display text-xs text-muted/60 text-center">E2E encrypted · Chat · Screen share · Recording</p>
  </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="font-body text-sm text-muted">Enter a room ID shared by your peer.</p>
                <input
                  value={joinInput}
                  onChange={(e) => { setJoinInput(e.target.value.toUpperCase()); setJoinError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  placeholder="ROOM-ID"
                  maxLength={12}
                  className="w-full bg-void border border-border text-white font-display tracking-widest
                             placeholder-muted/40 text-center text-lg py-4 px-4 outline-none
                             focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
                {joinError && <p className="font-display text-xs text-warn text-center">{joinError}</p>}
                <button onClick={joinRoom} className="btn-secondary w-full">JOIN ROOM →</button>
              </div>
            )}
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {['Chat', 'Screen Share', 'Recording', 'Picture-in-Picture', 'Real Latency', 'Friends', 'Polygon Verified', 'Admin Dashboard'].map((f) => (
            <span key={f} className="font-display text-xs text-muted/60 border border-border px-3 py-1 tracking-wider">{f}</span>
          ))}
        </div>

        {/* Quick links */}
        <div className="flex gap-6 mt-8">
          <Link to="/friends" className="font-display text-xs text-muted/50 hover:text-accent tracking-widest transition-colors">FRIENDS</Link>
          <Link to="/history" className="font-display text-xs text-muted/50 hover:text-accent tracking-widest transition-colors">CALL HISTORY</Link>
          <Link to="/profile" className="font-display text-xs text-muted/50 hover:text-accent tracking-widest transition-colors">PROFILE</Link>
          <Link to="/web3profile" className="font-display text-xs text-muted/50 hover:text-info tracking-widest transition-colors">WEB3 PROFILE</Link>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border px-6 py-4 flex items-center justify-between">
        <span className="font-display text-xs text-muted/40 tracking-widest">PLEXUSTALK v2.0</span>
        <span className="font-display text-xs text-muted/40 tracking-widest">NO SERVERS · NO LOGS</span>
      </footer>
    </div>
  );
}
