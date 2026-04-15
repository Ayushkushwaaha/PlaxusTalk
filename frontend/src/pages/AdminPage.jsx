import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function api(path, token, options = {}) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  }).then((r) => r.json());
}

const StatCard = ({ label, value, sub, accent }) => (
  <div className="stat-card p-6 flex flex-col gap-1">
    <span className="font-display text-xs text-muted tracking-widest">{label}</span>
    <span className={`font-display text-3xl font-bold ${accent ? 'text-accent glow-accent-text' : 'text-white'}`}>{value ?? '—'}</span>
    {sub && <span className="font-body text-xs text-muted/60">{sub}</span>}
  </div>
);

export default function AdminPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [stats, setStats]   = useState(null);
  const [users, setUsers]   = useState([]);
  const [calls, setCalls]   = useState([]);
  const [rooms, setRooms]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.isAdmin) { navigate('/'); return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, u, c, r] = await Promise.all([
        api('/api/admin/stats', token),
        api('/api/admin/users', token),
        api('/api/admin/calls', token),
        api('/api/admin/rooms', token),
      ]);
      setStats(s);
      setUsers(u.users || []);
      setCalls(c.calls || []);
      setRooms(r.rooms || []);
    } finally { setLoading(false); }
  };

  const banUser = async (id, banned) => {
    await api(`/api/admin/users/${id}/ban`, token, { method: 'POST' });
    setUsers((prev) => prev.map((u) => u._id === id ? { ...u, banned: !banned } : u));
    setMsg(`User ${banned ? 'unbanned' : 'banned'}`);
    setTimeout(() => setMsg(''), 2000);
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user permanently?')) return;
    await api(`/api/admin/users/${id}`, token, { method: 'DELETE' });
    setUsers((prev) => prev.filter((u) => u._id !== id));
    setMsg('User deleted');
    setTimeout(() => setMsg(''), 2000);
  };

  const endRoom = async (roomId) => {
    await api(`/api/admin/rooms/${roomId}`, token, { method: 'DELETE' });
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setMsg(`Room ${roomId} ended`);
    setTimeout(() => setMsg(''), 2000);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '—';

  const formatDur = (s) => s ? (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`) : '—';

  const TABS = ['overview', 'users', 'calls', 'rooms'];

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-warn opacity-[0.02] blur-[120px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-7 h-7 relative">
              <div className="absolute inset-0 border-2 border-accent rotate-45" />
              <div className="absolute inset-[4px] bg-accent rotate-45" />
            </div>
            <span className="font-display text-accent text-base tracking-widest">PLEXUSTALK</span>
          </Link>
          <div className="h-4 w-px bg-border" />
          <span className="font-display text-xs text-warn tracking-widest border border-warn/30 px-2 py-1">ADMIN</span>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="font-display text-xs text-accent tracking-widest">{msg}</span>}
          <button onClick={loadAll} className="font-display text-xs text-muted hover:text-accent tracking-widest uppercase transition-colors">↺ REFRESH</button>
          <button onClick={() => { logout(); navigate('/login'); }}
            className="font-display text-xs text-muted hover:text-warn tracking-widest uppercase transition-colors">SIGN OUT</button>
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 border border-warn/30 px-4 py-1.5 mb-4 text-warn font-display text-xs tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-warn animate-pulse" />
            ADMIN DASHBOARD
          </div>
          <h1 className="font-display text-3xl text-white">CONTROL PANEL</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-8 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 font-display text-xs tracking-widest uppercase whitespace-nowrap transition-all ${
                tab === t ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-white'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Overview */}
            {tab === 'overview' && stats && (
              <div className="flex flex-col gap-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
                  <StatCard label="TOTAL USERS"    value={stats.totalUsers}   sub={`+${stats.newUsers7d} this week`} accent />
                  <StatCard label="TOTAL CALLS"    value={stats.totalCalls}   sub={`${stats.callsToday} today`} />
                  <StatCard label="TOTAL MINUTES"  value={stats.totalMinutes} sub="all time" />
                  <StatCard label="AVG LATENCY"    value={stats.avgLatency ? `${stats.avgLatency}ms` : null} sub="across all calls" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
                  <StatCard label="ACTIVE ROOMS"   value={rooms.length}  sub="right now" />
                  <StatCard label="ONLINE USERS"   value={users.filter((u) => u.isOnline).length} sub="right now" />
                  <StatCard label="BANNED USERS"   value={users.filter((u) => u.banned).length} sub="total" />
                </div>

                {/* Recent calls mini table */}
                <div className="terminal-border bg-panel/60">
                  <div className="px-6 py-4 border-b border-border">
                    <span className="font-display text-xs text-accent/60 tracking-widest">RECENT CALLS</span>
                  </div>
                  {calls.slice(0, 5).map((c) => (
                    <div key={c._id} className="grid grid-cols-3 px-6 py-3 border-b border-border/50 hover:bg-accent/5 transition-colors">
                      <span className="font-display text-xs text-accent">{c.room_id}</span>
                      <span className="font-body text-xs text-muted">{formatDate(c.start_time)}</span>
                      <span className="font-display text-xs text-white">{formatDur(c.duration)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users */}
            {tab === 'users' && (
              <div className="terminal-border bg-panel/60">
                <div className="grid grid-cols-5 px-6 py-3 border-b border-border">
                  {['NAME', 'EMAIL', 'STATUS', 'JOINED', 'ACTIONS'].map((h) => (
                    <span key={h} className="font-display text-xs text-muted tracking-widest">{h}</span>
                  ))}
                </div>
                {users.map((u) => (
                  <div key={u._id} className={`grid grid-cols-5 px-6 py-4 border-b border-border/50 hover:bg-accent/5 transition-colors items-center ${u.banned ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${u.isOnline ? 'bg-accent' : 'bg-muted'}`} />
                      <span className="font-display text-xs text-white">{u.name}</span>
                      {u.isAdmin && <span className="font-display text-xs text-warn border border-warn/30 px-1">ADM</span>}
                    </div>
                    <span className="font-body text-xs text-muted truncate">{u.email}</span>
                    <span className={`font-display text-xs ${u.banned ? 'text-warn' : u.isOnline ? 'text-accent' : 'text-muted'}`}>
                      {u.banned ? 'BANNED' : u.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <span className="font-body text-xs text-muted">{formatDate(u.createdAt)}</span>
                    <div className="flex gap-2">
                      {!u.isAdmin && (
                        <>
                          <button onClick={() => banUser(u._id, u.banned)}
                            className={`font-display text-xs tracking-widest px-2 py-1 border transition-all ${u.banned ? 'border-accent/30 text-accent hover:bg-accent/10' : 'border-warn/30 text-warn hover:bg-warn/10'}`}>
                            {u.banned ? 'UNBAN' : 'BAN'}
                          </button>
                          <button onClick={() => deleteUser(u._id)}
                            className="font-display text-xs text-warn/50 hover:text-warn border border-transparent hover:border-warn/30 px-2 py-1 transition-all">
                            DEL
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Calls */}
            {tab === 'calls' && (
              <div className="terminal-border bg-panel/60">
                <div className="grid grid-cols-4 px-6 py-3 border-b border-border">
                  {['ROOM ID', 'START TIME', 'DURATION', 'AVG LATENCY'].map((h) => (
                    <span key={h} className="font-display text-xs text-muted tracking-widest">{h}</span>
                  ))}
                </div>
                {calls.map((c) => (
                  <div key={c._id} className="grid grid-cols-4 px-6 py-4 border-b border-border/50 hover:bg-accent/5 transition-colors">
                    <span className="font-display text-sm text-accent">{c.room_id}</span>
                    <span className="font-body text-sm text-muted">{formatDate(c.start_time)}</span>
                    <span className="font-display text-sm text-white">{formatDur(c.duration)}</span>
                    <span className={`font-display text-sm ${c.avg_latency < 150 ? 'text-accent' : 'text-warn'}`}>
                      {c.avg_latency ? `${c.avg_latency}ms` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Rooms */}
            {tab === 'rooms' && (
              <div className="flex flex-col gap-3">
                {rooms.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <span className="font-display text-5xl text-border">◈</span>
                    <span className="font-display text-xs text-muted/40 tracking-widest">NO ACTIVE ROOMS</span>
                  </div>
                ) : (
                  rooms.map((r) => (
                    <div key={r.id} className="terminal-border bg-panel/60 p-5 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="font-display text-lg text-accent">{r.id}</p>
                          <p className="font-display text-xs text-muted tracking-widest">{r.userCount}/2 USERS</p>
                        </div>
                        <div className="flex gap-3">
                          {r.hasPassword && <span className="font-display text-xs text-info border border-info/30 px-2 py-1">🔒 PASSWORD</span>}
                          <span className={`font-display text-xs px-2 py-1 border ${r.userCount > 0 ? 'border-accent/30 text-accent' : 'border-border text-muted'}`}>
                            {r.userCount > 0 ? '● LIVE' : '○ EMPTY'}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => endRoom(r.id)}
                        className="border border-warn/40 text-warn font-display text-xs tracking-widest px-4 py-2 hover:bg-warn/10 transition-all">
                        END ROOM
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
