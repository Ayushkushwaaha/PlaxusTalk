import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function CallHistoryPage() {
  const { token } = useAuth();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/calls`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setCalls(data.calls || []))
      .catch(() => setCalls([]))
      .finally(() => setLoading(false));
  }, [token]);

  const formatDuration = (s) => {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '—';

  return (
    <div className="min-h-screen bg-void grid-bg">
      <header className="flex items-center justify-between px-6 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-7 h-7 relative">
            <div className="absolute inset-0 border-2 border-accent rotate-45" />
            <div className="absolute inset-[4px] bg-accent rotate-45" />
          </div>
          <span className="font-display text-accent text-base tracking-widest">PLEXUSTALK</span>
        </Link>
        <Link to="/" className="font-display text-xs text-muted hover:text-white tracking-widest uppercase transition-colors">← HOME</Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 border border-accent/20 px-4 py-1.5 mb-4 text-accent font-display text-xs tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            CALL LOGS · MONGODB
          </div>
          <h1 className="font-display text-4xl text-white">CALL HISTORY</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : calls.length === 0 ? (
          <div className="terminal-border bg-panel/60 p-12 text-center">
            <p className="font-display text-4xl text-border mb-4">◈</p>
            <p className="font-display text-sm text-muted tracking-widest">NO CALLS YET</p>
            <p className="font-body text-xs text-muted/60 mt-2">Your call history will appear here</p>
            <Link to="/" className="btn-secondary inline-block mt-6 text-xs py-2 px-6">START A CALL</Link>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-px bg-border mb-6">
              {[
                { label: 'TOTAL CALLS', value: calls.length },
                { label: 'TOTAL MINUTES', value: Math.round(calls.reduce((a, c) => a + (c.duration || 0), 0) / 60) },
                { label: 'AVG LATENCY', value: calls.filter(c => c.avg_latency).length > 0
                  ? Math.round(calls.reduce((a, c) => a + (c.avg_latency || 0), 0) / calls.filter(c => c.avg_latency).length) + 'ms'
                  : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="stat-card p-5 text-center">
                  <p className="font-display text-2xl text-accent font-bold">{value}</p>
                  <p className="font-display text-xs text-muted tracking-widest mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Call list */}
            <div className="flex flex-col gap-px bg-border">
              {/* Header */}
              <div className="grid grid-cols-5 gap-4 bg-panel px-4 py-3">
                {['ROOM ID', 'DATE', 'DURATION', 'LATENCY', 'WALLETS'].map((h) => (
                  <span key={h} className="font-display text-xs text-muted tracking-widest">{h}</span>
                ))}
              </div>
              {calls.map((call, i) => (
                <div key={i} className="grid grid-cols-5 gap-4 bg-panel/60 hover:bg-panel px-4 py-4 transition-colors">
                  <span className="font-display text-xs text-accent tracking-widest">{call.room_id}</span>
                  <span className="font-body text-xs text-white/70">{formatDate(call.start_time)}</span>
                  <span className="font-display text-xs text-white">{formatDuration(call.duration)}</span>
                  <span className={`font-display text-xs ${call.avg_latency < 150 ? 'text-accent' : 'text-warn'}`}>
                    {call.avg_latency ? `${call.avg_latency}ms` : '—'}
                  </span>
                  <span className="font-display text-xs text-muted/60 truncate">
                    {call.user1_wallet ? call.user1_wallet.slice(0, 8) + '…' : 'No wallet'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
