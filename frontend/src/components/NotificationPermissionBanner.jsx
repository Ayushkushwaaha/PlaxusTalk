// frontend/src/components/NotificationPermissionBanner.jsx
// Shows a banner asking user to enable push notifications

import React, { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuth } from '../lib/AuthContext';

export default function NotificationPermissionBanner() {
  const { user }                              = useAuth();
  const { isSupported, isSubscribed, permission, subscribe } = usePushNotifications(user);
  const [dismissed, setDismissed]             = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [success, setSuccess]                 = useState(false);

  // Don't show if: not supported, already subscribed, dismissed, or permission denied
  useEffect(() => {
    const wasDismissed = localStorage.getItem('notif_banner_dismissed');
    if (wasDismissed) setDismissed(true);
  }, []);

  if (!isSupported || isSubscribed || dismissed || permission === 'denied') return null;

  const handleEnable = async () => {
    setLoading(true);
    const ok = await subscribe();
    setLoading(false);
    if (ok) {
      setSuccess(true);
      setTimeout(() => setDismissed(true), 2000);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notif_banner_dismissed', '1');
    setDismissed(true);
  };

  return (
    <div style={{
      position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
      width: '90%', maxWidth: '480px', zIndex: 1000,
      background: 'rgba(10,10,20,0.97)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(0,255,136,0.25)', borderRadius: '16px',
      padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: '12px',
      animation: 'slideUp 0.3s ease',
    }}>
      <span style={{ fontSize: '24px', flexShrink: 0 }}>🔔</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {success ? (
          <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#00ff88', margin: 0, letterSpacing: '0.05em' }}>
            ✅ Notifications enabled! Friends can now call you.
          </p>
        ) : (
          <>
            <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#e8e8f0', margin: '0 0 2px', letterSpacing: '0.05em', fontWeight: 600 }}>
              Enable call notifications
            </p>
            <p style={{ fontFamily: 'monospace', fontSize: '10px', color: '#4a4a5c', margin: 0, letterSpacing: '0.05em' }}>
              Get notified when friends call you, even when app is closed
            </p>
          </>
        )}
      </div>
      {!success && (
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button onClick={handleEnable} disabled={loading}
            style={{ background: loading ? 'rgba(0,255,136,0.1)' : 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.35)', color: '#00ff88', fontFamily: 'monospace', fontSize: '10px', padding: '6px 12px', borderRadius: '8px', cursor: loading ? 'wait' : 'pointer', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
            {loading ? '...' : 'ENABLE'}
          </button>
          <button onClick={handleDismiss}
            style={{ background: 'none', border: 'none', color: '#4a4a5c', cursor: 'pointer', fontSize: '16px', padding: '4px', flexShrink: 0 }}>
            ✕
          </button>
        </div>
      )}
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  );
}
