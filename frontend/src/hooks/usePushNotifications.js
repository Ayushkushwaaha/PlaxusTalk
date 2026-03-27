import { useState, useEffect, useCallback } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState(Notification?.permission || 'default');
  const [supported] = useState('Notification' in window);

  useEffect(() => {
    if (supported) setPermission(Notification.permission);
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === 'granted';
  }, [supported]);

  const notify = useCallback((title, options = {}) => {
    if (!supported || permission !== 'granted') return;
    const n = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
    // Auto close after 5s
    setTimeout(() => n.close(), 5000);
    return n;
  }, [supported, permission]);

  const notifyCallIncoming = useCallback((peerName, roomId) => {
    return notify(`📞 ${peerName} joined your room!`, {
      body: `Room: ${roomId} — Click to return to the call`,
      tag: 'incoming-call',
      requireInteraction: true,
    });
  }, [notify]);

  const notifyPeerLeft = useCallback((roomId) => {
    return notify('Call ended', {
      body: `Peer left room ${roomId}`,
      tag: 'peer-left',
    });
  }, [notify]);

  const notifyFriendRequest = useCallback((fromName) => {
    return notify(`👋 Friend request from ${fromName}`, {
      body: 'Go to Friends page to accept',
      tag: 'friend-request',
    });
  }, [notify]);

  return {
    supported,
    permission,
    isGranted: permission === 'granted',
    requestPermission,
    notify,
    notifyCallIncoming,
    notifyPeerLeft,
    notifyFriendRequest,
  };
}
