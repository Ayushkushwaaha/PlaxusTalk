import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navLinks = [
    { to: '/friends', label: 'Friends', icon: '👥' },
    { to: '/history', label: 'History', icon: '📋' },
    { to: '/profile', label: user?.name?.split(' ')[0] || 'Profile', icon: '👤' },
    ...(user?.isAdmin ? [{ to: '/admin', label: 'Admin', icon: '⚡', warn: true }] : []),
  ];

  return (
    <header className="relative z-50 border-b border-border/60 bg-void/90 backdrop-blur-md">
      {/* Top accent line */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

      <div className="flex items-center justify-between px-5 py-3">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 border-2 border-accent rotate-45 group-hover:rotate-[225deg] transition-all duration-500" />
            <div className="absolute inset-[5px] bg-accent rotate-45 group-hover:scale-110 transition-all duration-300" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-white text-base tracking-[0.2em] leading-none group-hover:text-accent transition-colors">
              PLEXUS<span className="text-accent">TALK</span>
            </span>
            <span className="font-display text-muted/50 text-[9px] tracking-[0.3em] leading-none">
              P2P · BLOCKCHAIN · ENCRYPTED
            </span>
          </div>
        </Link>

        {/* Desktop nav */}
        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 font-display text-xs tracking-widest uppercase transition-all rounded-sm
                  ${location.pathname === link.to
                    ? 'bg-accent/10 text-accent border border-accent/30'
                    : link.warn
                    ? 'text-warn hover:bg-warn/10 hover:border-warn/30 border border-transparent'
                    : 'text-muted hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
              >
                <span className="text-sm">{link.icon}</span>
                {link.label}
              </Link>
            ))}

            {/* Divider */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* Status dot */}
            <div className="flex items-center gap-1.5 px-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="font-display text-xs text-muted/60 tracking-widest hidden lg:block">ONLINE</span>
            </div>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 font-display text-xs tracking-widest uppercase text-muted hover:text-warn hover:bg-warn/5 border border-transparent hover:border-warn/20 transition-all rounded-sm"
            >
              <span className="text-sm">🚪</span>
              OUT
            </button>
          </nav>
        )}

        {/* Mobile menu button */}
        {user && (
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden flex items-center gap-2 border border-border px-3 py-1.5 font-display text-xs text-muted hover:text-accent hover:border-accent/30 transition-all"
          >
            {mobileOpen ? '✕ CLOSE' : '☰ MENU'}
          </button>
        )}
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && user && (
        <div className="md:hidden border-t border-border bg-panel/95 backdrop-blur">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-5 py-3 font-display text-xs tracking-widest uppercase border-b border-border/50 transition-colors
                ${link.warn ? 'text-warn' : 'text-muted hover:text-white hover:bg-white/5'}`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
          <button
            onClick={() => { setMobileOpen(false); handleLogout(); }}
            className="w-full flex items-center gap-3 px-5 py-3 font-display text-xs tracking-widest uppercase text-warn hover:bg-warn/5 transition-colors"
          >
            <span>🚪</span> SIGN OUT
          </button>
        </div>
      )}
    </header>
  );
}
