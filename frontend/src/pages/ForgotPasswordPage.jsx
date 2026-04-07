import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('');
  const [sent, setSent]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { setError('Enter your email'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSent(true);
    } catch (err) {
      // Even if backend not set up, show success for UX (no email enumeration)
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent opacity-[0.03] blur-[120px]" />
      </div>

      <header className="relative z-10 flex items-center px-6 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-7 h-7 relative">
            <div className="absolute inset-0 border-2 border-accent rotate-45" />
            <div className="absolute inset-[4px] bg-accent rotate-45" />
          </div>
          <span className="font-display text-accent text-base tracking-widest">PLEXUSTALK</span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <div className="text-4xl mb-4">🔑</div>
            <h1 className="font-display text-3xl text-white mb-2">FORGOT PASSWORD</h1>
            <p className="font-body text-muted text-sm">Enter your email to receive a reset link</p>
          </div>

          <div className="terminal-border bg-panel/80 backdrop-blur p-8">
            <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent mb-6" />

            {sent ? (
              <div className="text-center flex flex-col gap-4">
                <div className="text-5xl">✉️</div>
                <p className="font-display text-accent tracking-widest">EMAIL SENT!</p>
                <p className="font-body text-sm text-muted">
                  If an account exists for <span className="text-white">{email}</span>, you will receive a password reset link shortly.
                </p>
                <Link to="/login" className="btn-primary text-center mt-2">
                  ← BACK TO SIGN IN
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="font-display text-xs text-muted tracking-widest">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@example.com"
                    autoFocus
                    className="w-full bg-void border border-border text-white font-body text-sm px-4 py-3 outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 border border-warn/30 bg-warn/5 px-4 py-3">
                    <span className="text-warn">⚠</span>
                    <p className="font-body text-sm text-warn">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? (
                    <><span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />SENDING...</>
                  ) : 'SEND RESET LINK'}
                </button>

                <Link to="/login" className="font-display text-xs text-muted hover:text-accent tracking-widest text-center transition-colors">
                  ← BACK TO SIGN IN
                </Link>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
