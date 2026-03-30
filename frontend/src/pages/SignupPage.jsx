import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.confirm) {
      setError('All fields are required'); return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters'); return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match'); return;
    }
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Password strength
  const strength = (() => {
    const p = form.password;
    if (!p) return null;
    if (p.length < 6) return { label: 'WEAK', color: 'bg-warn', width: 'w-1/4' };
    if (p.length < 10) return { label: 'FAIR', color: 'bg-yellow-400', width: 'w-2/4' };
    if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { label: 'GOOD', color: 'bg-info', width: 'w-3/4' };
    return { label: 'STRONG', color: 'bg-accent', width: 'w-full' };
  })();

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-info opacity-[0.03] blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent opacity-[0.03] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center px-6 py-5 border-b border-border">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-7 h-7 relative">
            <div className="absolute inset-0 border-2 border-accent rotate-45" />
            <div className="absolute inset-[4px] bg-accent rotate-45" />
          </div>
          <span className="font-display text-accent text-base tracking-widest glow-accent-text">PLEXUSTALK</span>
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-slide-up">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 border border-accent/20 px-4 py-1.5 mb-5 text-accent font-display text-xs tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              NEW ACCOUNT
            </div>
            <h1 className="font-display text-4xl text-white mb-2">CREATE ACCOUNT</h1>
            <p className="font-body text-muted text-sm">Join PlexusTalk — sovereign P2P video</p>
          </div>

          {/* Form card */}
          <div className="terminal-border bg-panel/80 backdrop-blur p-8">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/40 to-transparent mb-8" />

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Name */}
              <div className="flex flex-col gap-2">
                <label className="font-display text-xs text-muted tracking-widest">FULL NAME</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ayush Kumar"
                  autoComplete="name"
                  className="w-full bg-void border border-border text-white font-body text-sm
                             placeholder-muted/40 px-4 py-3 outline-none
                             focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                />
              </div>

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
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
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
                {/* Strength bar */}
                {strength && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                      <div className={`h-full ${strength.color} ${strength.width} transition-all duration-300`} />
                    </div>
                    <span className={`font-display text-xs tracking-widest ${
                      strength.label === 'STRONG' ? 'text-accent' :
                      strength.label === 'GOOD' ? 'text-info' :
                      strength.label === 'FAIR' ? 'text-yellow-400' : 'text-warn'
                    }`}>{strength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-2">
                <label className="font-display text-xs text-muted tracking-widest">CONFIRM PASSWORD</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirm"
                  value={form.confirm}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className={`w-full bg-void border text-white font-body text-sm
                             placeholder-muted/40 px-4 py-3 outline-none transition-all
                             ${form.confirm && form.confirm !== form.password
                               ? 'border-warn/50 focus:ring-warn/20'
                               : form.confirm && form.confirm === form.password
                               ? 'border-accent/50 focus:ring-accent/20'
                               : 'border-border focus:border-accent/50 focus:ring-accent/20'
                             } focus:ring-1`}
                />
                {form.confirm && form.confirm === form.password && (
                  <p className="font-display text-xs text-accent">✓ PASSWORDS MATCH</p>
                )}
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
                    CREATING ACCOUNT...
                  </>
                ) : (
                  'CREATE ACCOUNT →'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="font-display text-xs text-muted/40 tracking-widest">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Login link */}
            <p className="text-center font-body text-sm text-muted">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-accent hover:text-accent-dim font-display text-xs tracking-widest transition-colors"
              >
                SIGN IN
              </Link>
            </p>
          </div>

          <p className="text-center font-display text-xs text-muted/40 tracking-widest mt-6">
            BCRYPT HASHED · JWT TOKENS · NO PLAINTEXT STORAGE
          </p>
        </div>
      </main>
    </div>
  );
}
