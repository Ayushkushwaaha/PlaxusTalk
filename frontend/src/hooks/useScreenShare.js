import { useState, useCallback, useRef } from 'react';

export function useScreenShare(localVideoRef, pcRef) {
  const [isSharing, setIsSharing] = useState(false);
  const screenStreamRef = useRef(null);
  const originalTrackRef = useRef(null);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' }, audio: false,
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      if (pcRef?.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) { originalTrackRef.current = sender.track; await sender.replaceTrack(screenTrack); }
      }

      screenTrack.onended = () => stopScreenShare();
      setIsSharing(true);
    } catch (err) { console.error('Screen share error:', err); }
  }, [pcRef]);

  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    if (originalTrackRef.current && pcRef?.current) {
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(originalTrackRef.current);
    }
    screenStreamRef.current = null;
    originalTrackRef.current = null;
    setIsSharing(false);
  }, [pcRef]);

  const toggleScreenShare = useCallback(() => {
    isSharing ? stopScreenShare() : startScreenShare();
  }, [isSharing, startScreenShare, stopScreenShare]);

  return { isSharing, toggleScreenShare };
}
