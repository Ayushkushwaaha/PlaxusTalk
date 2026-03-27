import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('All fields are required'); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent opacity-[0.03] blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-info opacity-[0.04] blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center px-6 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-7 h-7 relative">
            <div className="absolute inset-0 border-2 border-accent rotate-45" />
            <div className="absolute inset-[4px] bg-accent rotate-45" />
          </div>
          <span className="font-display text-accent text-base tracking-widest glow-accent-text">PLAXUSTALK</span>
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-slide-up">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 border border-accent/20 px-4 py-1.5 mb-5 text-accent font-display text-xs tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              SECURE ACCESS
            </div>
            <h1 className="font-display text-4xl text-white mb-2">SIGN IN</h1>
            <p className="font-body text-muted text-sm">Welcome back to PlaxusTalk</p>
          </div>

          {/* Form card */}
          <div className="terminal-border bg-panel/80 backdrop-blur p-8">
            {/* Top accent bar */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent mb-8" />

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Email */}
              <div className="flex flex-col gap-2">
                <label className="font-display text-xs text-muted tracking-widest">EMAIL</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full bg-void border border-border text-white font-body text-sm
                             placeholder-muted/40 px-4 py-3 outline-none
                             focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-2">
                <label className="font-display text-xs text-muted tracking-widest">PASSWORD</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-void border border-border text-white font-body text-sm
                               placeholder-muted/40 px-4 py-3 pr-12 outline-none
                               focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-accent transition-colors font-display text-xs"
                  >
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 border border-warn/30 bg-warn/5 px-4 py-3">
                  <span className="text-warn text-sm">⚠</span>
                  <p className="font-body text-sm text-warn">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-void border-t-transparent rounded-full animate-spin" />
                    SIGNING IN...
                  </>
                ) : (
                  'SIGN IN →'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="font-display text-xs text-muted/40 tracking-widest">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Signup link */}
            <p className="text-center font-body text-sm text-muted">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-accent hover:text-accent-dim font-display text-xs tracking-widest transition-colors"
              >
                CREATE ACCOUNT
              </Link>
            </p>
          </div>

          {/* Security note */}
          <p className="text-center font-display text-xs text-muted/40 tracking-widest mt-6">
            JWT SECURED · 7-DAY SESSION · E2E ENCRYPTED CALLS
          </p>
        </div>
      </main>
    </div>
  );
}
