import React, { useState, useEffect } from 'react';
import { getSocket } from '../lib/socket';

const EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🔥', '🎉', '😢'];

export default function Reactions({ roomId }) {
  const [floating, setFloating] = useState([]);
  const socket = getSocket();

  useEffect(() => {
    const onReaction = ({ emoji, id }) => {
      addFloating(emoji, id);
    };
    socket.on('reaction', onReaction);
    return () => socket.off('reaction', onReaction);
  }, [socket]);

  const addFloating = (emoji, id = Date.now()) => {
    const left = 20 + Math.random() * 60;
    setFloating((prev) => [...prev, { emoji, id, left }]);
    setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== id)), 3000);
  };

  const sendReaction = (emoji) => {
    const id = Date.now();
    socket.emit('reaction', { roomId, emoji, id });
    addFloating(emoji, id);
  };

  return (
    <div className="relative">
      {/* Floating reactions */}
      <div className="fixed bottom-32 left-0 right-0 pointer-events-none z-50 overflow-hidden h-48">
        {floating.map((f) => (
          <div
            key={f.id}
            className="absolute text-3xl animate-bounce"
            style={{
              left: `${f.left}%`,
              bottom: 0,
              animation: 'floatUp 3s ease-out forwards',
            }}
          >
            {f.emoji}
          </div>
        ))}
      </div>

      {/* Emoji picker */}
      <div className="flex gap-1 flex-wrap justify-center">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => sendReaction(emoji)}
            className="text-xl hover:scale-125 transition-transform active:scale-95 p-1"
            title={`Send ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-180px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
