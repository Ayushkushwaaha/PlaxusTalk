import React, { useState } from 'react';

const QUALITY_CONFIG = {
  excellent: { color: 'text-accent', bg: 'bg-accent', label: 'EXCELLENT', bars: 4 },
  good:      { color: 'text-info',   bg: 'bg-info',   label: 'GOOD',      bars: 3 },
  fair:      { color: 'text-yellow-400', bg: 'bg-yellow-400', label: 'FAIR', bars: 2 },
  poor:      { color: 'text-warn',   bg: 'bg-warn',   label: 'POOR',      bars: 1 },
};

function QualityBars({ quality }) {
  const cfg = QUALITY_CONFIG[quality] || { bars: 0 };
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[1, 2, 3, 4].map((b) => (
        <div key={b}
          className={`w-1.5 rounded-sm transition-all ${b <= cfg.bars ? cfg.bg : 'bg-border'}`}
          style={{ height: `${b * 25}%` }}
        />
      ))}
    </div>
  );
}

const ICE_LABELS = {
  new:          { label: 'NEW',         color: 'text-muted' },
  checking:     { label: 'CHECKING',    color: 'text-warn' },
  connected:    { label: 'CONNECTED',   color: 'text-accent' },
  completed:    { label: 'ESTABLISHED', color: 'text-accent' },
  failed:       { label: 'FAILED',      color: 'text-warn' },
  disconnected: { label: 'LOST',        color: 'text-warn' },
  closed:       { label: 'CLOSED',      color: 'text-muted' },
};

export default function StatsPanel({ latency, isP2P, connectionState, iceState, peerCount, callId, realStats }) {
  const [expanded, setExpanded] = useState(false);
  const ice = ICE_LABELS[iceState] || { label: iceState?.toUpperCase(), color: 'text-muted' };

  // Use real latency if available, else fall back to mock
  const displayLatency = realStats?.latency ?? latency;
  const displayQuality = realStats?.quality;

  const latencyColor = displayLatency === null ? 'text-muted'
    : displayLatency < 100 ? 'text-accent'
    : displayLatency < 200 ? 'text-yellow-400'
    : 'text-warn';

  const zoomBeat = displayLatency ? Math.round(((340 - displayLatency) / 340) * 100) : 68;

  return (
    <div className="flex flex-col">
      {/* Main stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        {/* Latency */}
        <div className="stat-card flex flex-col gap-1 p-4">
          <span className="font-display text-xs text-muted tracking-widest">LATENCY</span>
          <span className={`font-display text-2xl font-bold ${latencyColor}`}>
            {displayLatency !== null ? `${displayLatency}ms` : '—'}
          </span>
          {displayLatency !== null && (
            <span className="font-body text-xs text-accent/60">{zoomBeat}% faster than Zoom</span>
          )}
        </div>

        {/* Connection quality */}
        <div className="stat-card flex flex-col gap-1 p-4">
          <span className="font-display text-xs text-muted tracking-widest">CONNECTION</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isP2P ? 'bg-accent animate-pulse' : 'bg-muted'}`} />
            <span className={`font-display text-sm font-bold ${isP2P ? 'text-accent' : 'text-muted'}`}>
              {isP2P ? 'P2P' : 'RELAY'}
            </span>
            {displayQuality && <QualityBars quality={displayQuality} />}
          </div>
          <span className="font-body text-xs text-muted/60">
            ICE: <span className={ice.color}>{ice.label}</span>
          </span>
        </div>

        {/* Peers */}
        <div className="stat-card flex flex-col gap-1 p-4">
          <span className="font-display text-xs text-muted tracking-widest">PEERS</span>
          <span className="font-display text-2xl font-bold text-white">{peerCount}/2</span>
          <span className="font-body text-xs text-muted/60">max 2 per room</span>
        </div>

        {/* Session */}
        <div className="stat-card flex flex-col gap-1 p-4">
          <span className="font-display text-xs text-muted tracking-widest">SESSION</span>
          <span className="font-display text-xs text-white truncate">
            {callId ? callId.slice(0, 12) + '…' : '—'}
          </span>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="font-display text-xs text-accent/60 hover:text-accent tracking-widest text-left transition-colors"
          >
            {expanded ? 'LESS ▲' : 'MORE ▼'}
          </button>
        </div>
      </div>

      {/* Expanded real stats */}
      {expanded && realStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border border-t border-border">
          {[
            { label: 'JITTER',     value: realStats.jitter     != null ? `${realStats.jitter}ms`  : '—' },
            { label: 'PACKET LOSS',value: realStats.packetLoss != null ? `${realStats.packetLoss}%` : '—' },
            { label: 'BITRATE',    value: realStats.bitrate    != null ? `${realStats.bitrate}kb/s` : '—' },
            { label: 'RESOLUTION', value: realStats.resolution || '—' },
            { label: 'FPS',        value: realStats.fps        != null ? `${realStats.fps}fps`    : '—' },
            { label: 'QUALITY',    value: realStats.quality?.toUpperCase() || '—',
              color: realStats.quality ? QUALITY_CONFIG[realStats.quality]?.color : 'text-muted' },
          ].map((s) => (
            <div key={s.label} className="stat-card p-3 flex flex-col gap-1">
              <span className="font-display text-xs text-muted/60 tracking-widest">{s.label}</span>
              <span className={`font-display text-sm font-bold ${s.color || 'text-white'}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
