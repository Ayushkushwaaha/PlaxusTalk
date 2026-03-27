import React, { useState } from 'react';

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export default function CallControls({
  isAudioMuted, isVideoOff, onToggleAudio, onToggleVideo, onHangUp,
  roomId, isSharing, onToggleScreen, isRecording, recordingTime,
  onToggleRecording, isPiP, onTogglePiP, onToggleChat, formatTime,
}) {
  const [copied, setCopied] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🔥'];

  const shareLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const Btn = ({ onClick, active, danger, children, title, className = '' }) => (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center transition-all duration-200 rounded-sm
        ${danger
          ? 'w-14 h-14 border border-warn/40 bg-warn/10 text-warn hover:bg-warn hover:text-void hover:border-warn'
          : active
          ? 'w-11 h-11 border border-accent/50 bg-accent/10 text-accent hover:bg-accent/20'
          : `w-11 h-11 border border-border bg-panel text-muted hover:border-accent/40 hover:text-accent ${className}`
        }`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-2 border border-warn/30 bg-warn/5 px-4 py-1.5">
          <div className="w-2 h-2 rounded-full bg-warn animate-pulse" />
          <span className="font-display text-xs text-warn tracking-widest">
            REC {formatTime(recordingTime)}
          </span>
        </div>
      )}

      {/* Main controls */}
      <div className="flex items-center justify-center gap-2 flex-wrap py-2">
        {/* Mic */}
        <Btn onClick={onToggleAudio} active={isAudioMuted} title={isAudioMuted ? 'Unmute' : 'Mute'}>
          {isAudioMuted ? '🔇' : '🎤'}
        </Btn>

        {/* Hang up */}
        <Btn onClick={onHangUp} danger title="End call">
          📵
        </Btn>

        {/* Camera */}
        <Btn onClick={onToggleVideo} active={isVideoOff} title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
          {isVideoOff ? '📷' : '📹'}
        </Btn>

        {/* Screen share */}
        <Btn onClick={onToggleScreen} active={isSharing} title={isSharing ? 'Stop sharing' : 'Share screen'}>
          🖥️
        </Btn>

        {/* Record */}
        <Btn onClick={onToggleRecording} active={isRecording} title={isRecording ? 'Stop recording' : 'Start recording'}>
          {isRecording ? '⏹️' : '⏺️'}
        </Btn>

        {/* PiP */}
        <Btn onClick={onTogglePiP} active={isPiP} title="Picture in Picture">
          ⧉
        </Btn>

        {/* Chat */}
        <button
          onClick={onToggleChat}
          className="flex items-center gap-1.5 border border-border bg-panel text-muted
                     hover:text-accent hover:border-accent/30 px-3 h-11 font-display text-xs
                     tracking-widest uppercase transition-all rounded-sm"
        >
          💬 CHAT
        </button>

        {/* Reactions */}
        <div className="relative">
          <Btn onClick={() => setShowReactions((s) => !s)} active={showReactions} title="Reactions">
            😊
          </Btn>
          {showReactions && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-panel border border-border
                            px-3 py-2 flex gap-2 z-50 shadow-xl">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => { /* handled in RaiseHand/Reactions */ setShowReactions(false); }}
                  className="text-xl hover:scale-125 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Share */}
        <button
          onClick={shareLink}
          className="flex items-center gap-1.5 border border-border bg-panel text-muted
                     hover:text-accent hover:border-accent/30 px-3 h-11 font-display text-xs
                     tracking-widest uppercase transition-all rounded-sm"
        >
          {copied ? '✓ COPIED' : '🔗 SHARE'}
        </button>
      </div>
    </div>
  );
}
