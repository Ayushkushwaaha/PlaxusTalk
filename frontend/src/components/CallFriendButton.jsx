// frontend/src/components/CallFriendButton.jsx
// Button to call a friend — sends push notification + socket event

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuth } from '../lib/AuthContext';
import { getSocket } from '../lib/socket';

export default function CallFriendButton({ friend, callType = 'p2p' }) {
  const { user }       = useAuth();
  const { callFriend } = usePushNotifications(user);
  const navigate       = useNavigate();
  const socket         = getSocket();
  const [calling,  setCalling]  = useState(false);
  const [status,   setStatus]   = useState(''); // '', 'ringing', 'accepted', 'declined', 'missed'

  const generateRoomId = () => Math.random().toString(36).slice(2, 10).toUpperCase();

  const initiateCall = async () => {
    if (calling) return;
    setCalling(true);
    setStatus('ringing');

    const roomId = generateRoomId();

    // 1. Send push notification (works even if app is closed)
    const pushSent = await callFriend(friend.id || friend._id, friend.name, roomId, callType);

    // 2. Also send via socket (works if app is open)
    socket.emit('call-friend', {
      callerId: user?.id,
      callerName: user?.name || 'Someone',
      receiverId: friend.id || friend._id,
      roomId,
      callType,
    });

    // 3. Listen for response
    const onAccepted = ({ roomId: acceptedRoom }) => {
      setStatus('accepted');
      socket.off('call-accepted', onAccepted);
      socket.off('call-declined', onDeclined);
      setTimeout(() => {
        setCalling(false); setStatus('');
        navigate(callType === 'group' ? `/group/${acceptedRoom}` : `/room/${acceptedRoom}`);
      }, 500);
    };

    const onDeclined = () => {
      setStatus('declined');
      socket.off('call-accepted', onAccepted);
      socket.off('call-declined', onDeclined);
      setTimeout(() => { setCalling(false); setStatus(''); }, 2500);
    };

    socket.on('call-accepted', onAccepted);
    socket.on('call-declined', onDeclined);

    // Auto cancel after 30 seconds if no response
    setTimeout(() => {
      if (calling) {
        socket.off('call-accepted', onAccepted);
        socket.off('call-declined', onDeclined);
        socket.emit('call-cancelled', { receiverId: friend.id || friend._id, roomId });
        setStatus('missed');
        setTimeout(() => { setCalling(false); setStatus(''); }, 2000);
      }
    }, 30000);
  };

  const cancelCall = () => {
    setCalling(false);
    setStatus('');
    socket.emit('call-cancelled', { receiverId: friend.id || friend._id });
  };

  // Status colors and labels
  const statusConfig = {
    ringing:  { color: '#ffd700', label: '🔔 Ringing...',  bg: 'rgba(255,215,0,0.15)'   },
    accepted: { color: '#00ff88', label: '✅ Accepted!',    bg: 'rgba(0,255,136,0.15)'   },
    declined: { color: '#ef4444', label: '❌ Declined',     bg: 'rgba(239,68,68,0.15)'   },
    missed:   { color: '#ff6b35', label: '⏰ No answer',    bg: 'rgba(255,107,53,0.15)'  },
  };

  const cfg = statusConfig[status];

  if (calling && status === 'ringing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)', padding: '8px 14px', borderRadius: '20px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffd700', animation: 'blink 0.8s infinite' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#ffd700', letterSpacing: '0.1em' }}>RINGING...</span>
        </div>
        <button onClick={cancelCall} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontFamily: 'monospace', fontSize: '11px', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', letterSpacing: '0.1em' }}>
          CANCEL
        </button>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      </div>
    );
  }

  if (status && status !== 'ringing') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: cfg.bg, border: `1px solid ${cfg.color}40`, padding: '8px 14px', borderRadius: '20px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: cfg.color, letterSpacing: '0.1em' }}>{cfg.label}</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {/* P2P Call */}
      <button onClick={() => initiateCall()} title={`Call ${friend.name}`}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88', fontFamily: 'monospace', fontSize: '11px', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', letterSpacing: '0.1em', transition: 'all 0.2s' }}
        onMouseOver={e => { e.currentTarget.style.background = 'rgba(0,255,136,0.2)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
        onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,255,136,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}>
        📞 CALL
      </button>
      {/* Group Call */}
      <button onClick={() => { /* navigate to group room and invite */ }} title={`Group call with ${friend.name}`}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(77,166,255,0.1)', border: '1px solid rgba(77,166,255,0.3)', color: '#4da6ff', fontFamily: 'monospace', fontSize: '11px', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', letterSpacing: '0.1em', transition: 'all 0.2s' }}
        onMouseOver={e => { e.currentTarget.style.background = 'rgba(77,166,255,0.2)'; e.currentTarget.style.transform = 'scale(1.03)'; }}
        onMouseOut={e => { e.currentTarget.style.background = 'rgba(77,166,255,0.1)'; e.currentTarget.style.transform = 'scale(1)'; }}>
        👥 GROUP
      </button>
    </div>
  );
}
