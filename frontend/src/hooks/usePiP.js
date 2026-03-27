import { useState, useCallback } from 'react';

export function usePiP(remoteVideoRef) {
  const [isPiP, setIsPiP] = useState(false);

  const togglePiP = useCallback(async () => {
    const video = remoteVideoRef?.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
        video.addEventListener('leavepictureinpicture', () => setIsPiP(false), { once: true });
      }
    } catch (err) { console.error('PiP error:', err); }
  }, [remoteVideoRef]);

  return { isPiP, togglePiP };
}
