import React, { useState } from 'react';

export default function RoomPasswordModal({ onSubmit, onCancel, isWrong }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-void/95 flex items-center justify-center px-4">
      <div className="w-full max-w-sm terminal-border bg-panel p-8 animate-slide-up">
        <div className="h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent mb-6" />
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">🔒</div>
          <h2 className="font-display text-xl text-white mb-2">ROOM PROTECTED</h2>
          <p className="font-body text-sm text-muted">This room requires a password to join</p>
        </div>

        {isWrong && (
          <div className="flex items-center gap-2 border border-warn/30 bg-warn/5 px-4 py-3 mb-4">
            <span className="text-warn">⚠</span>
            <p className="font-body text-sm text-warn">Incorrect password — try again</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit(password)}
              placeholder="Enter room password"
              autoFocus
              className="w-full bg-void border border-border text-white font-body text-sm px-4 py-3 pr-16 outline-none focus:border-accent/50 transition-all"
            />
            <button type="button" onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 font-display text-xs text-muted hover:text-accent transition-colors">
              {show ? 'HIDE' : 'SHOW'}
            </button>
          </div>
          <button onClick={() => onSubmit(password)} className="btn-primary w-full">JOIN ROOM →</button>
          <button onClick={onCancel}
            className="font-display text-xs text-muted hover:text-white tracking-widest text-center transition-colors">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
