import React, { useState, useRef, useEffect } from 'react';

export default function CallControls({
  isAudioMuted, isVideoOff, isSharing, isRecording, recordingTime, formatTime,
  isPiP, isPiPSupported,
  onToggleAudio, onToggleVideo, onHangUp, onToggleScreen,
  onToggleRecording, onTogglePiP, onScrollToChat,
  roomId,
}) {
  const [copied, setCopied]         = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const menuRef                     = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const shareLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    setMenuOpen(false);
  };

  const BtnBase = ({ onClick, active, danger, title, children, className = '' }) => (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-full
        transition-all duration-200 active:scale-95 focus:outline-none
        ${danger
          ? 'bg-warn hover:bg-warn/80 text-void'
          : active
          ? 'bg-white/20 text-white hover:bg-white/30 ring-2 ring-warn/60'
          : 'bg-white/10 text-white hover:bg-white/20'
        } ${className}`}
    >
      {children}
    </button>
  );

  // Icons as SVG for crisp rendering
  const MicIcon = () => isAudioMuted
    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;

  const CamIcon = () => isVideoOff
    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34"/><path d="M23 7l-7 5 7 5V7z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
    : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;

  const ShareIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;

  const PhoneIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M13.73 21a2 2 0 01-3.46 0l-8-14a2 2 0 013.46-2l6.27 11 6.27-11a2 2 0 013.46 2z" transform="rotate(135,12,12)"/><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.43 9.01a19.79 19.79 0 01-3.07-8.67A2 2 0 012.36.34h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.34 8.15"/></svg>;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 bg-warn/20 border border-warn/40 px-4 py-1.5 rounded-full">
          <div className="w-2 h-2 rounded-full bg-warn animate-pulse" />
          <span className="font-display text-xs text-warn tracking-widest">REC {formatTime(recordingTime)}</span>
        </div>
      )}

      {/* Main control bar — Google Meet style */}
      <div className="flex items-center gap-2 bg-void/80 backdrop-blur border border-border/60 rounded-full px-4 py-2 shadow-2xl">

        {/* Mic with chevron */}
        <div className="flex items-center">
          <BtnBase onClick={onToggleAudio} active={isAudioMuted} title={isAudioMuted ? 'Unmute' : 'Mute mic'}>
            <MicIcon />
          </BtnBase>
        </div>

        {/* Camera */}
        <BtnBase onClick={onToggleVideo} active={isVideoOff} title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
          <CamIcon />
        </BtnBase>

        {/* Screen share */}
        <BtnBase
          onClick={onToggleScreen}
          active={isSharing}
          title={isSharing ? 'Stop sharing' : 'Share screen'}
          className={isSharing ? 'ring-2 ring-info/60 bg-info/20' : ''}
        >
          <ShareIcon />
        </BtnBase>

        {/* Chat — scrolls to chat */}
        <BtnBase onClick={onScrollToChat} title="Open chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </BtnBase>

        {/* Raise hand / Reactions */}
        <BtnBase title="Reactions" onClick={() => {}}>
          <span className="text-lg">😊</span>
        </BtnBase>

        {/* Raise hand */}
        <BtnBase title="Raise hand" onClick={() => {}}>
          <span className="text-lg">✋</span>
        </BtnBase>

        {/* Divider */}
        <div className="h-8 w-px bg-border/60 mx-1" />

        {/* Hang up — center prominent */}
        <BtnBase onClick={onHangUp} danger title="Leave call" className="w-16 h-14">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.43 9.01a19.79 19.79 0 01-3.07-8.67A2 2 0 012.36.34h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.34 8.15"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        </BtnBase>

        {/* Divider */}
        <div className="h-8 w-px bg-border/60 mx-1" />

        {/* PiP */}
        {isPiPSupported && (
          <BtnBase onClick={onTogglePiP} active={isPiP} title="Picture in picture">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2"/><rect x="12" y="10" width="8" height="5" rx="1"/>
            </svg>
          </BtnBase>
        )}

        {/* Record */}
        <BtnBase
          onClick={onToggleRecording}
          active={isRecording}
          title={isRecording ? 'Stop recording' : 'Record call'}
          className={isRecording ? 'ring-2 ring-warn/60' : ''}
        >
          <div className={`w-4 h-4 rounded-full border-2 ${isRecording ? 'bg-warn border-warn' : 'border-white'}`} />
        </BtnBase>

        {/* 3-dot more menu */}
        <div className="relative" ref={menuRef}>
          <BtnBase onClick={() => setMenuOpen((o) => !o)} active={menuOpen} title="More options">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </BtnBase>

          {/* Dropdown menu */}
          {menuOpen && (
            <div className="absolute bottom-16 right-0 w-56 bg-panel border border-border rounded-lg shadow-2xl overflow-hidden z-50 animate-fade-in">
              <div className="px-4 py-2 border-b border-border">
                <span className="font-display text-xs text-muted tracking-widest">MORE OPTIONS</span>
              </div>

              {[
                { icon: '🔗', label: copied ? 'Link Copied!' : 'Copy invite link', action: shareLink },
                { icon: '⧉', label: 'Picture in Picture', action: () => { onTogglePiP?.(); setMenuOpen(false); } },
                { icon: isRecording ? '⏹' : '⏺', label: isRecording ? 'Stop recording' : 'Start recording', action: () => { onToggleRecording?.(); setMenuOpen(false); } },
                { icon: '🖥', label: isSharing ? 'Stop screen share' : 'Share screen', action: () => { onToggleScreen?.(); setMenuOpen(false); } },
                { icon: '💬', label: 'Open chat', action: () => { onScrollToChat?.(); setMenuOpen(false); } },
                { icon: '📊', label: 'View stats', action: () => { document.getElementById('stats-panel')?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false); } },
              ].map((item) => (
                <button key={item.label} onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-border/30 last:border-0">
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-body text-sm text-white">{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcut hints */}
      <div className="flex items-center gap-4 opacity-40">
        {[
          { key: 'M', label: 'Mute' },
          { key: 'V', label: 'Video' },
          { key: 'S', label: 'Share' },
          { key: 'C', label: 'Chat' },
        ].map((s) => (
          <span key={s.key} className="font-display text-xs text-muted tracking-widest">
            <kbd className="border border-border px-1 py-0.5 rounded text-xs">{s.key}</kbd> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
