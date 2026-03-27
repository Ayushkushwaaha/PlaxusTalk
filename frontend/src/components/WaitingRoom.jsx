import React from 'react';

export default function WaitingRoom({ roomId, onCopy }) {
  return (
    <div className="min-h-screen bg-void grid-bg flex items-center justify-center px-4">
      <div className="text-center animate-slide-up">
        <div className="w-20 h-20 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto mb-8" />
        <h2 className="font-display text-3xl text-white mb-3">WAITING FOR PEER</h2>
        <p className="font-body text-muted mb-8">Share the room ID with someone to start the call</p>
        <div className="terminal-border bg-panel p-6 inline-block text-left">
          <p className="font-display text-xs text-muted tracking-widest mb-2">ROOM ID</p>
          <p className="font-display text-4xl text-accent glow-accent-text mb-4">{roomId}</p>
          <button
            onClick={onCopy}
            className="btn-secondary w-full text-center text-xs py-2"
          >
            COPY INVITE LINK
          </button>
        </div>
        <p className="font-display text-xs text-muted/40 tracking-widest mt-6">
          CALL STARTS AUTOMATICALLY WHEN PEER JOINS
        </p>
      </div>
    </div>
  );
}
