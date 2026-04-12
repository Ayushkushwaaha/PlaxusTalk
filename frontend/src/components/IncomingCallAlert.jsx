// frontend/src/components/IncomingCallAlert.jsx
// Shows a beautiful incoming call UI when someone calls you via socket

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../lib/socket';

export default function IncomingCallAlert() {
  const [call, setCall]     = useState(null); // { callerName, roomId, callType, callerId }
  const [timer, setTimer]   = useState(30);   // auto-decline after 30s
  const navigate            = useNavigate();
  const timerRef            = useRef(null);
  const socket              = getSocket();

  useEffect(() => {
    const onIncomingCall = (data) => {
      setCall(data);
      setTimer(30);
    };
    socket.on('incoming-call', onIncomingCall);
    return () => socket.off('incoming-call', onIncomingCall);
  }, [socket]);

  // Countdown timer
  useEffect(() => {
    if (!call) return;
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { decline(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [call]);

  // Vibrate on incoming call
  useEffect(() => {
    if (!call) return;
    if (navigator.vibrate) {
      const pattern = [500, 200, 500, 200, 500];
      const vibInterval = setInterval(() => navigator.vibrate(pattern), 2000);
      navigator.vibrate(pattern);
      return () => { clearInterval(vibInterval); navigator.vibrate(0); };
    }
  }, [call]);

  const accept = () => {
    clearInterval(timerRef.current);
    navigator.vibrate?.(0);
    const path = call.callType === 'group' ? `/group/${call.roomId}` : `/room/${call.roomId}`;
    socket.emit('call-accepted', { roomId: call.roomId, callerId: call.callerId });
    setCall(null);
    navigate(path);
  };

  const decline = () => {
    clearInterval(timerRef.current);
    navigator.vibrate?.(0);
    socket.emit('call-declined', { roomId: call.roomId, callerId: call.callerId });
    setCall(null);
  };

  if (!call) return null;

  const progress = (timer / 30) * 100;

  return (
    <>
      {/* Backdrop */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000, backdropFilter: 'blur(8px)' }} />

      {/* Call card */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9001, width: '90%', maxWidth: '360px',
        background: 'linear-gradient(145deg, #0d0d1a, #0a0a12)',
        border: '1px solid rgba(0,255,136,0.2)',
        borderRadius: '28px',
        padding: '32px 24px 28px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,255,136,0.1)',
        animation: 'slideDown 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        textAlign: 'center',
      }}>
        {/* Animated ring */}
        <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto 20px' }}>
          {/* Pulse rings */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: 'absolute', inset: `-${i * 12}px`,
              borderRadius: '50%',
              border: '2px solid rgba(0,255,136,0.3)',
              animation: `ring 2s ${i * 0.4}s ease-out infinite`,
            }} />
          ))}
          {/* Avatar */}
          <div style={{
            width: '100px', height: '100px', borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(77,166,255,0.2))',
            border: '3px solid rgba(0,255,136,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '40px', color: '#00ff88',
            fontFamily: 'monospace', fontWeight: 700,
            boxShadow: '0 0 30px rgba(0,255,136,0.2)',
          }}>
            {call.callerName?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>

        {/* Call info */}
        <p style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4a4a5c', letterSpacing: '0.3em', marginBottom: '6px', textTransform: 'uppercase' }}>
          {call.callType === 'group' ? '👥 Group Call' : '📞 Incoming Call'}
        </p>
        <h2 style={{ color: '#e8e8f0', fontFamily: 'monospace', fontSize: '24px', margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.05em' }}>
          {call.callerName}
        </h2>
        <p style={{ color: '#4a4a5c', fontFamily: 'monospace', fontSize: '11px', margin: '0 0 24px', letterSpacing: '0.15em' }}>
          wants to connect with you
        </p>

        {/* Timer bar */}
        <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', marginBottom: '28px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            background: timer > 15 ? '#00ff88' : timer > 8 ? '#ffd700' : '#ef4444',
            width: `${progress}%`,
            transition: 'width 1s linear, background 0.5s ease',
          }} />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          {/* Decline */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button onClick={decline} style={{
              width: '68px', height: '68px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 6px 20px rgba(239,68,68,0.5)',
              fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.15s',
            }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
              📵
            </button>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#ef4444', letterSpacing: '0.1em' }}>DECLINE</span>
          </div>

          {/* Accept */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button onClick={accept} style={{
              width: '68px', height: '68px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
              boxShadow: '0 6px 20px rgba(0,255,136,0.5)',
              fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'acceptPulse 1s ease infinite',
              transition: 'transform 0.15s',
            }}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.08)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
              📞
            </button>
            <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#00ff88', letterSpacing: '0.1em' }}>ACCEPT</span>
          </div>
        </div>

        {/* Auto-decline timer */}
        <p style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', margin: '20px 0 0', letterSpacing: '0.1em' }}>
          Auto-decline in {timer}s
        </p>
      </div>

      <style>{`
        @keyframes ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -60%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes acceptPulse {
          0%, 100% { box-shadow: 0 6px 20px rgba(0,255,136,0.5); }
          50%       { box-shadow: 0 6px 32px rgba(0,255,136,0.8); }
        }
      `}</style>
    </>
  );
}
