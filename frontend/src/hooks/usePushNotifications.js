// frontend/src/hooks/usePushNotifications.js
import { useState, useEffect, useCallback } from 'react';

const VAPID_PUBLIC_KEY = 'BMxz0c46aPWBqI1LOeYx9Oxb6K9u18BLFw1D9INCFaE4tE8WVd9vr6n4Nzy9MSrDkQ5W0cUJUKCR0HiCw3-F1KM';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
}

export function usePushNotifications(user) {
  const [permission,    setPermission]    = useState(Notification.permission);
  const [subscription,  setSubscription]  = useState(null);
  const [isSupported,   setIsSupported]   = useState(false);
  const [isSubscribed,  setIsSubscribed]  = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);

  // Register service worker
  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => console.error('SW registration failed:', err));

    // Listen for messages from SW (navigate to room when notification tapped)
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'NAVIGATE_TO_ROOM') {
        const { roomId, callType } = e.data;
        window.location.href = callType === 'group' ? `/group/${roomId}` : `/room/${roomId}`;
      }
    });
  }, [isSupported]);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { setSubscription(sub); setIsSubscribed(true); }
    } catch (err) { console.error('Check subscription error:', err); }
  };

  // Request permission + subscribe
  const subscribe = useCallback(async () => {
    if (!isSupported || !user?.id) return false;

    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;

      // Get SW registration
      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      setSubscription(sub);
      setIsSubscribed(true);

      // Send subscription to backend
      const token = localStorage.getItem('pt_token');
      await fetch(`${BACKEND_URL}/api/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          subscription: sub.toJSON(),
        }),
      });

      return true;
    } catch (err) {
      console.error('Subscribe error:', err);
      return false;
    }
  }, [isSupported, user?.id]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!subscription) return;
    try {
      await subscription.unsubscribe();
      const token = localStorage.getItem('pt_token');
      await fetch(`${BACKEND_URL}/api/push/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: user?.id }),
      });
      setSubscription(null);
      setIsSubscribed(false);
    } catch (err) { console.error('Unsubscribe error:', err); }
  }, [subscription, user?.id]);

  // Call a friend — sends push notification to them
  const callFriend = useCallback(async (friendId, friendName, roomId, callType = 'p2p') => {
    try {
      const token = localStorage.getItem('pt_token');
      const res = await fetch(`${BACKEND_URL}/api/push/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          callerId: user?.id,
          callerName: user?.name || 'Someone',
          receiverId: friendId,
          receiverName: friendName,
          roomId,
          callType,
        }),
      });
      return res.ok;
    } catch (err) {
      console.error('Call friend error:', err);
      return false;
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    callFriend,
  };
}
