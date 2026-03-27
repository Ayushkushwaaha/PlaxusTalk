import React from 'react';

export default function VideoPlayer({ videoRef, label, isLocal, isVideoOff, connectionState }) {
  return (
    <div className="video-frame w-full aspect-video rounded-sm relative">
      {/* Scanning line animation */}
      <div className="scanning-line" />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />

      {/* Overlay when no video */}
      {(isVideoOff || (connectionState !== 'connected' && !isLocal)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-void/90 z-10">
          {!isLocal && connectionState === 'connecting' ? (
            <>
              <div className="w-12 h-12 border-2 border-accent/30 border-t-accent rounded-full animate-spin mb-4" />
              <span className="font-display text-xs text-muted tracking-widest">AWAITING PEER...</span>
            </>
          ) : !isLocal && connectionState === 'disconnected' ? (
            <>
              <div className="w-12 h-12 border-2 border-warn/40 flex items-center justify-center mb-4">
                <span className="text-warn text-2xl">✕</span>
              </div>
              <span className="font-display text-xs text-warn tracking-widest">PEER DISCONNECTED</span>
            </>
          ) : isVideoOff ? (
            <>
              <div className="w-16 h-16 rounded-full bg-panel border-2 border-border flex items-center justify-center mb-3">
                <span className="text-2xl">👤</span>
              </div>
              <span className="font-display text-xs text-muted tracking-widest">CAMERA OFF</span>
            </>
          ) : (
            <div className="text-center">
              <div className="font-display text-5xl text-border mb-4">◈</div>
              <span className="font-display text-xs text-muted/40 tracking-widest">NO SIGNAL</span>
            </div>
          )}
        </div>
      )}

      {/* Label badge */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isLocal ? 'bg-accent' : connectionState === 'connected' ? 'bg-info' : 'bg-muted'} animate-pulse`} />
        <span className="font-display text-xs text-white/80 tracking-widest bg-void/70 px-2 py-0.5">
          {label}
        </span>
      </div>

      {/* Corner brackets */}
      <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-accent/30 z-20" />
      <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-accent/30 z-20" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-accent/30 z-20" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-accent/30 z-20" />
    </div>
  );
}
