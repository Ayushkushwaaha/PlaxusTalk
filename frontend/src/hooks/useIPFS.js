import { useState, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export function useIPFS() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const getHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('pt_token')}`,
    'Content-Type': 'application/json',
  });

  // Save chat history to IPFS
  const saveChatToIPFS = useCallback(async (roomId, messages) => {
    if (!messages || messages.length === 0) return null;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ipfs/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ roomId, messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data; // { cid, url }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  // Fetch chat history from IPFS
  const fetchChatFromIPFS = useCallback(async (cid) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ipfs/chat/${cid}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  // Save profile to IPFS
  const saveProfileToIPFS = useCallback(async (profileData) => {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ipfs/profile`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data; // { cid, url }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  // Fetch my profile from IPFS
  const fetchMyProfile = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ipfs/profile/me`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data; // { cid, url, profile }
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  // Fetch any profile from IPFS by CID
  const fetchProfileByCID = useCallback(async (cid) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/ipfs/profile/${cid}`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  return {
    uploading,
    error,
    saveChatToIPFS,
    fetchChatFromIPFS,
    saveProfileToIPFS,
    fetchMyProfile,
    fetchProfileByCID,
  };
}
