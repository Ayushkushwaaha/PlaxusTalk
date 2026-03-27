import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';
import { useIPFS } from '../hooks/useIPFS';

export default function ChatPanel({ roomId, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [savedCID, setSavedCID] = useState(null);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef(null);
  const socket = getSocket();
  const { saveChatToIPFS } = useIPFS();

  useEffect(() => {
    const onMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
      if (!isOpen) setUnread((u) => u + 1);
    };
    socket.on('chat-message', onMessage);
    return () => socket.off('chat-message', onMessage);
  }, [socket, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    const msg = {
      id: Date.now(),
      text,
      sender: currentUser?.name || 'You',
      senderId: socket.id,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    socket.emit('chat-message', { roomId, message: msg });
    setMessages((prev) => [...prev, { ...msg, isSelf: true }]);
    setInput('');
  };

  const saveToIPFS = async () => {
    if (messages.length === 0) return;
    setSaving(true);
    const result = await saveChatToIPFS(roomId, messages);
    if (result) setSavedCID(result.cid);
    setSaving(false);
  };

  return (
    <div className="flex flex-col">
      {/* Toggle */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-3 border-b border-border hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-accent text-sm">💬</span>
          <span className="font-display text-xs text-accent/60 tracking-widest">CHAT</span>
          {savedCID && <span className="font-display text-xs text-info tracking-widest">· IPFS</span>}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <span className="w-5 h-5 rounded-full bg-accent text-void font-display text-xs flex items-center justify-center">{unread}</span>
          )}
          <span className="text-muted text-xs">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col">
          {/* Messages */}
          <div className="overflow-y-auto p-4 flex flex-col gap-3 min-h-[200px] max-h-[280px]">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="font-display text-xs text-muted/40 tracking-widest">NO MESSAGES YET</span>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col gap-1 ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-sm font-body ${
                    msg.isSelf ? 'bg-accent/20 border border-accent/30 text-white' : 'bg-panel border border-border text-white'
                  }`}>{msg.text}</div>
                  <span className="font-display text-xs text-muted/50">
                    {msg.isSelf ? 'You' : msg.sender} · {msg.time}
                  </span>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* IPFS save button */}
          {messages.length > 0 && (
            <div className="px-4 py-2 border-t border-border/50">
              {savedCID ? (
                <div className="flex items-center gap-2">
                  <span className="text-accent text-xs">📌</span>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${savedCID}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display text-xs text-info hover:text-info/70 tracking-widest transition-colors"
                  >
                    SAVED TO IPFS →
                  </a>
                </div>
              ) : (
                <button
                  onClick={saveToIPFS}
                  disabled={saving}
                  className="flex items-center gap-2 font-display text-xs text-muted hover:text-accent tracking-widest transition-colors"
                >
                  {saving ? (
                    <><span className="w-3 h-3 border border-accent/50 border-t-accent rounded-full animate-spin" />SAVING...</>
                  ) : (
                    <>📡 SAVE CHAT TO IPFS</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Input */}
          <div className="flex border-t border-border">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-void text-white text-sm font-body px-4 py-3 outline-none placeholder-muted/40"
            />
            <button onClick={sendMessage}
              className="px-4 text-accent hover:text-accent-dim border-l border-border font-display text-xs tracking-widest transition-colors">
              SEND
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
