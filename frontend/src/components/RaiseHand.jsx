import React, { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';

export default function RaiseHand({ roomId, userName }) {
  const [handRaised, setHandRaised] = useState(false);
  const [peerHandRaised, setPeerHandRaised] = useState(false);
  const [notification, setNotification] = useState('');
  const socket = getSocket();

  useEffect(() => {
    const onHandRaise = ({ raised, sender }) => {
      setPeerHandRaised(raised);
      if (raised) {
        setNotification(`✋ ${sender || 'Peer'} raised their hand`);
        setTimeout(() => setNotification(''), 3000);
      }
    };
    socket.on('raise-hand', onHandRaise);
    return () => socket.off('raise-hand', onHandRaise);
  }, [socket]);

  const toggleHand = () => {
    const newState = !handRaised;
    setHandRaised(newState);
    socket.emit('raise-hand', { roomId, raised: newState, sender: userName });
  };

  return (
    <>
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-panel border border-accent/30
                        px-4 py-2 font-display text-xs text-accent tracking-widest animate-slide-up">
          {notification}
        </div>
      )}

      {/* Peer hand indicator */}
      {peerHandRaised && (
        <div className="fixed top-16 right-4 z-40 text-2xl animate-bounce" title="Peer raised hand">
          ✋
        </div>
      )}

      <button
        onClick={toggleHand}
        className={`flex items-center gap-1.5 border px-3 h-10 font-display text-xs
                    tracking-widest uppercase transition-all rounded-sm
                    ${handRaised
                      ? 'border-accent/60 bg-accent/10 text-accent'
                      : 'border-border bg-panel text-muted hover:text-accent hover:border-accent/30'
                    }`}
        title={handRaised ? 'Lower hand' : 'Raise hand'}
      >
        ✋ {handRaised ? 'LOWER' : 'RAISE'}
      </button>
    </>
  );
}
