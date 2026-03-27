import { useState, useEffect, useRef, useCallback } from 'react';

export function useRealLatency(pcRef, isConnected) {
  const [stats, setStats] = useState({
    latency: null,
    jitter: null,
    packetLoss: null,
    bitrate: null,
    resolution: null,
    fps: null,
    quality: null, // 'excellent' | 'good' | 'fair' | 'poor'
  });
  const intervalRef = useRef(null);
  const prevBytesRef = useRef(0);

  const getStats = useCallback(async () => {
    if (!pcRef?.current || !isConnected) return;
    try {
      const reports = await pcRef.current.getStats();
      let rtt = null, jitter = null, lost = null, received = null;
      let bytesSent = 0, frameWidth = null, frameHeight = null, fps = null;

      reports.forEach((r) => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime) {
          rtt = Math.round(r.currentRoundTripTime * 1000);
        }
        if (r.type === 'inbound-rtp' && r.kind === 'audio') {
          jitter = r.jitter ? Math.round(r.jitter * 1000) : null;
          lost = r.packetsLost || 0;
          received = r.packetsReceived || 0;
        }
        if (r.type === 'outbound-rtp' && r.kind === 'video') {
          bytesSent = r.bytesSent || 0;
          frameWidth = r.frameWidth;
          frameHeight = r.frameHeight;
          fps = r.framesPerSecond ? Math.round(r.framesPerSecond) : null;
        }
      });

      const packetLoss = received && lost
        ? Math.round((lost / (lost + received)) * 100 * 10) / 10
        : 0;

      const bitrate = Math.round(((bytesSent - prevBytesRef.current) * 8) / 1000);
      prevBytesRef.current = bytesSent;

      const quality = !rtt ? null
        : rtt < 100 && packetLoss < 1 ? 'excellent'
        : rtt < 200 && packetLoss < 3 ? 'good'
        : rtt < 400 && packetLoss < 8 ? 'fair'
        : 'poor';

      setStats({
        latency: rtt,
        jitter,
        packetLoss,
        bitrate: bitrate > 0 ? bitrate : null,
        resolution: frameWidth && frameHeight ? `${frameWidth}×${frameHeight}` : null,
        fps,
        quality,
      });
    } catch (err) {
      console.error('getStats error:', err);
    }
  }, [pcRef, isConnected]);

  useEffect(() => {
    if (isConnected) {
      intervalRef.current = setInterval(getStats, 2000);
      getStats();
    } else {
      clearInterval(intervalRef.current);
      setStats({ latency: null, jitter: null, packetLoss: null, bitrate: null, resolution: null, fps: null, quality: null });
    }
    return () => clearInterval(intervalRef.current);
  }, [isConnected, getStats]);

  return stats;
}
