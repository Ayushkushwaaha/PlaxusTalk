import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function IPFSChatPanel({ roomId, currentUser, token }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportCid, setExportCid] = useState(null);
  const [ipfsEnabled, setIpfsEnabled] = useState(false);
  const bottomRef = useRef(null);
  const socket = getSocket();

  // Check if IPFS is configured
  useEffect(() => {
    if (!token) return;
    fetch(`${BACKEND_URL}/api/ipfs/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setIpfsEnabled(d.configured))
      .catch(() => {});
  }, [token]);

  // Load past messages from DB on open
  useEffect(() => {
    if (!isOpen || !token) return;
    fetch(`${BACKEND_URL}/api/ipfs/chat/${roomId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.messages?.length) {
          const loaded = d.messages.map((m) => ({
            id: m._id,
            text: m.text,
            sender: m.senderName,
            senderId: m.senderId,
            time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            cid: m.cid,
            isSelf: m.senderId === currentUser?.id,
          }));
          setMessages(loaded);
        }
      })
      .catch(() => {});
  }, [isOpen, roomId, token]);

  // Socket message listener
  useEffect(() => {
    const onMessage = (msg) => {
      setMessages((prev) => {
        // Avoid duplicate if already added by sender
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, { ...msg, isSelf: false }];
      });
      if (!isOpen) setUnread((u) => u + 1);
    };

    // IPFS storage confirmation
    const onStored = ({ messageId, cid, ipfsUrl }) => {
      setMessages((prev) => prev.map((m) =>
        m.id === messageId ? { ...m, cid, ipfsUrl, stored: true } : m
      ));
    };

    socket.on('chat-message', onMessage);
    socket.on('message-stored', onStored);
    return () => {
      socket.off('chat-message', onMessage);
      socket.off('message-stored', onStored);
    };
  }, [socket, isOpen, currentUser]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isOpen, messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    const msg = {
      id: Date.now(),
      text,
      sender: currentUser?.name || 'You',
      senderId: currentUser?.id || socket.id,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
      stored: false,
    };

    // Add to local state immediately
    setMessages((prev) => [...prev, msg]);
    setInput('');

    // Send via socket (backend will store to IPFS)
    socket.emit('chat-message', { roomId, message: msg });

    // Also save to DB via REST
    if (token) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/ipfs/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ roomId, text, senderName: currentUser?.name }),
        });
        const data = await res.json();
        if (data.cid) {
          setMessages((prev) => prev.map((m) =>
            m.id === msg.id ? { ...m, cid: data.cid, ipfsUrl: data.ipfsUrl, stored: true } : m
          ));
        }
      } catch { }
    }
  };

  const exportToIPFS = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ipfs/chat/${roomId}/export`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.cid) {
        setExportCid(data.cid);
      }
    } catch { } finally {
      setIsExporting(false);
    }
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
          {ipfsEnabled && (
            <span className="font-display text-xs text-info/60 tracking-widest border border-info/20 px-1.5 py-0.5">
              IPFS
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <span className="w-5 h-5 rounded-full bg-accent text-void font-display text-xs flex items-center justify-center">
              {unread}
            </span>
          )}
          <span className="text-muted text-xs">{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col">
          {/* IPFS status bar */}
          {ipfsEnabled && (
            <div className="flex items-center justify-between px-4 py-2 bg-info/5 border-b border-info/10">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
                <span className="font-display text-xs text-info/70 tracking-widest">STORED ON IPFS</span>
              </div>
              <button
                onClick={exportToIPFS}
                disabled={isExporting || messages.length === 0}
                className="font-display text-xs text-info hover:text-info/70 tracking-widest transition-colors disabled:opacity-40"
              >
                {isExporting ? 'EXPORTING...' : '↗ EXPORT ALL'}
              </button>
            </div>
          )}

          {/* Export CID */}
          {exportCid && (
            <div className="px-4 py-2 bg-accent/5 border-b border-accent/10">
              <p className="font-display text-xs text-accent tracking-widest mb-1">✓ EXPORTED TO IPFS</p>
              <a
                href={`https://gateway.pinata.cloud/ipfs/${exportCid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-display text-xs text-muted/60 hover:text-accent transition-colors truncate block"
              >
                {exportCid.slice(0, 30)}...
              </a>
            </div>
          )}

          {/* Messages */}
          <div className="overflow-y-auto p-4 flex flex-col gap-3 min-h-[180px] max-h-[280px]">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="font-display text-xs text-muted/40 tracking-widest">NO MESSAGES YET</span>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={msg.id || i} className={`flex flex-col gap-1 ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 text-sm font-body ${
                    msg.isSelf
                      ? 'bg-accent/20 border border-accent/30 text-white'
                      : 'bg-panel border border-border text-white'
                  }`}>
                    {msg.text}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xs text-muted/50">
                      {msg.isSelf ? 'You' : msg.sender} · {msg.time}
                    </span>
                    {/* IPFS storage indicator */}
                    {msg.cid ? (
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${msg.cid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Stored on IPFS: ${msg.cid}`}
                        className="font-display text-xs text-info/60 hover:text-info transition-colors"
                      >
                        ⬡ IPFS
                      </a>
                    ) : ipfsEnabled ? (
                      <span className="font-display text-xs text-muted/30">○</span>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex border-t border-border">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={ipfsEnabled ? 'Type — stored on IPFS...' : 'Type a message...'}
              className="flex-1 bg-void text-white text-sm font-body px-4 py-3 outline-none placeholder-muted/40"
            />
            <button
              onClick={sendMessage}
              className="px-4 text-accent hover:text-accent-dim border-l border-border font-display text-xs tracking-widest transition-colors"
            >
              SEND
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
