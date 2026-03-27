import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function ProfilePage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setMsg(''); setError('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, email: form.email, ...(form.password && { password: form.password }) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg('Profile updated successfully');
      setForm((f) => ({ ...f, password: '', confirm: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void grid-bg">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-7 h-7 relative">
            <div className="absolute inset-0 border-2 border-accent rotate-45" />
            <div className="absolute inset-[4px] bg-accent rotate-45" />
          </div>
          <span className="font-display text-accent text-base tracking-widest">PLAXUSTALK</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/profile/web3" className="font-display text-xs text-info border border-info/30 px-3 py-1 hover:bg-info/10 tracking-widest uppercase transition-colors">⬡ WEB3 PROFILE</Link>
          <Link to="/" className="font-display text-xs text-muted hover:text-white tracking-widest uppercase transition-colors">← HOME</Link>
          <button onClick={() => { logout(); navigate('/login'); }} className="font-display text-xs text-muted hover:text-warn tracking-widest uppercase transition-colors">SIGN OUT</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-10 animate-slide-up">
          <div className="inline-flex items-center gap-2 border border-accent/20 px-4 py-1.5 mb-4 text-accent font-display text-xs tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            YOUR ACCOUNT
          </div>
          <h1 className="font-display text-4xl text-white">PROFILE</h1>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-6 mb-8 p-6 terminal-border bg-panel/60">
          <div className="w-16 h-16 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center">
            <span className="font-display text-2xl text-accent">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="font-display text-lg text-white">{user?.name}</p>
            <p className="font-body text-sm text-muted">{user?.email}</p>
            <p className="font-display text-xs text-accent/60 tracking-widest mt-1">MEMBER · PLAXUSTALK</p>
          </div>
        </div>

        {/* Edit form */}
        <form onSubmit={handleSave} className="terminal-border bg-panel/60 p-8 flex flex-col gap-5">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent mb-2" />

          {[
            { label: 'FULL NAME', name: 'name', type: 'text' },
            { label: 'EMAIL', name: 'email', type: 'email' },
            { label: 'NEW PASSWORD', name: 'password', type: 'password', placeholder: 'Leave blank to keep current' },
            { label: 'CONFIRM PASSWORD', name: 'confirm', type: 'password', placeholder: 'Repeat new password' },
          ].map(({ label, name, type, placeholder }) => (
            <div key={name} className="flex flex-col gap-2">
              <label className="font-display text-xs text-muted tracking-widest">{label}</label>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full bg-void border border-border text-white font-body text-sm
                           placeholder-muted/40 px-4 py-3 outline-none
                           focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>
          ))}

          {msg && <div className="border border-accent/30 bg-accent/5 px-4 py-3 font-body text-sm text-accent">{msg}</div>}
          {error && <div className="border border-warn/30 bg-warn/5 px-4 py-3 font-body text-sm text-warn">⚠ {error}</div>}

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <><span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />SAVING...</> : 'SAVE CHANGES →'}
          </button>
        </form>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Link to="/history" className="stat-card p-5 hover:border-accent/30 transition-all cursor-pointer">
            <p className="font-display text-xs text-muted tracking-widest mb-2">CALL HISTORY</p>
            <p className="font-display text-2xl text-white">📞</p>
            <p className="font-body text-xs text-muted/60 mt-1">View past calls</p>
          </Link>
          <Link to="/" className="stat-card p-5 hover:border-accent/30 transition-all cursor-pointer">
            <p className="font-display text-xs text-muted tracking-widest mb-2">START CALL</p>
            <p className="font-display text-2xl text-white">🎥</p>
            <p className="font-body text-xs text-muted/60 mt-1">Create a new room</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
