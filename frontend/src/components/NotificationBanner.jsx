import React, { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function NotificationBanner() {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('notif_dismissed') === 'true'
  );

  if (!isSupported || permission === 'granted' || dismissed) return null;

  const handleAllow = async () => {
    await requestPermission();
    setDismissed(true);
    localStorage.setItem('notif_dismissed', 'true');
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('notif_dismissed', 'true');
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="terminal-border bg-panel p-4 flex items-start gap-4 shadow-2xl">
        <div className="text-2xl mt-0.5">🔔</div>
        <div className="flex-1">
          <p className="font-display text-sm text-white tracking-wide mb-1">ENABLE NOTIFICATIONS</p>
          <p className="font-body text-xs text-muted mb-3">
            Get notified when peers join, leave, or send you a friend request
          </p>
          <div className="flex gap-2">
            <button onClick={handleAllow} className="btn-primary text-xs py-1.5 px-4">ALLOW</button>
            <button onClick={handleDismiss}
              className="font-display text-xs text-muted hover:text-white tracking-widest transition-colors">
              NOT NOW
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted hover:text-white text-lg transition-colors">✕</button>
      </div>
    </div>
  );
}
