// frontend/src/components/PersistentChat.jsx
// Drop-in chat component with localStorage persistence + socket relay

import React, { useEffect, useState, useRef, useCallback } from 'react';

const MAX_STORED = 100; // max messages stored per room

export function usePersistentChat(roomId, user, socket) {
  const storageKey = `chat_${roomId}`;

  // Load from localStorage on mount
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Save to localStorage whenever messages change
  useEffect(() => {
    try {
      const toStore = messages.slice(-MAX_STORED);
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch { }
  }, [messages, storageKey]);

  // Listen for incoming messages from peer via socket
  useEffect(() => {
    if (!socket) return;

    const onMsg = (msg) => {
      // Don't add duplicates (in case of re-render)
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, { ...msg, isSelf: msg.senderId === user?.id }];
      });
    };

    socket.on('chat-message', onMsg);
    return () => socket.off('chat-message', onMsg);
  }, [socket, user?.id]);

  // Send a message
  const sendMessage = useCallback((text) => {
    if (!text?.trim() || !socket) return;

    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: text.trim(),
      sender: user?.name || 'You',
      senderId: user?.id || socket.id,
      roomId: roomId?.toUpperCase(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
    };

    // Add to own messages immediately
    setMessages(prev => [...prev, msg]);

    // Send to peer via socket
    socket.emit('chat-message', { roomId: roomId?.toUpperCase(), message: msg });
  }, [socket, roomId, user]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    try { localStorage.removeItem(storageKey); } catch { }
  }, [storageKey]);

  return { messages, sendMessage, clearMessages };
}

// ── Chat UI Component ─────────────────────────────────────────────────────────
export default function PersistentChat({ roomId, user, socket, compact = false, style = {} }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const { messages, sendMessage, clearMessages } = usePersistentChat(roomId, user, socket);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, ...style }}>
      {/* Messages list */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: compact ? '8px 10px' : '12px 14px',
        display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0,
      }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80px', gap: '6px' }}>
            <span style={{ fontSize: '24px' }}>💬</span>
            <span style={{ fontSize: '11px', color: 'rgba(74,74,92,0.6)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
              No messages yet
            </span>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.isSelf ? 'flex-end' : 'flex-start', gap: '3px' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: compact ? '6px 10px' : '8px 12px',
                  fontSize: compact ? '12px' : '13px',
                  lineHeight: 1.5,
                  borderRadius: m.isSelf ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  background: m.isSelf
                    ? 'linear-gradient(135deg, rgba(0,255,136,0.18), rgba(0,200,100,0.12))'
                    : 'rgba(255,255,255,0.07)',
                  border: `1px solid ${m.isSelf ? 'rgba(0,255,136,0.28)' : 'rgba(255,255,255,0.1)'}`,
                  color: '#e8e8f0',
                  wordBreak: 'break-word',
                  boxShadow: m.isSelf ? '0 2px 8px rgba(0,255,136,0.08)' : 'none',
                }}>
                  {m.text}
                </div>
                <span style={{ fontSize: '10px', color: 'rgba(74,74,92,0.7)', paddingLeft: '4px', paddingRight: '4px' }}>
                  {m.isSelf ? 'You' : m.sender} · {m.time}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: compact ? '6px 8px' : '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            color: '#e8e8f0',
            fontSize: '13px',
            padding: '8px 14px',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(0,255,136,0.4)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
        <button
          onClick={handleSend}
          style={{
            width: '36px', height: '36px', borderRadius: '50%', border: 'none',
            cursor: 'pointer', fontSize: '15px', flexShrink: 0,
            background: input.trim()
              ? 'linear-gradient(135deg, rgba(0,255,136,0.4), rgba(0,200,100,0.3))'
              : 'rgba(255,255,255,0.06)',
            color: input.trim() ? '#00ff88' : '#4a4a5c',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            transform: 'scale(1)',
          }}
          onMouseOver={e => { if (input.trim()) e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
