import { useRef, useState, useCallback, useEffect } from 'react';
import { getSocket } from '../lib/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'b1ddb764e1d0b66a7267de87',
      credential: 'Z838/HM7L1qC+HDP',
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: 'b1ddb764e1d0b66a7267de87',
      credential: 'Z838/HM7L1qC+HDP',
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: 'b1ddb764e1d0b66a7267de87',
      credential: 'Z838/HM7L1qC+HDP',
    },
  ],
};

const MAX_PEERS = 8;

export function useGroupWebRTC(roomId) {
  const localStreamRef = useRef(null);
  const localVideoRef  = useRef(null);
  const peerConnections = useRef({}); // socketId → RTCPeerConnection
  const [peers, setPeers] = useState([]); // [{socketId, stream, name}]
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff,   setIsVideoOff]   = useState(false);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [roomFull, setRoomFull] = useState(false);
  const socket = getSocket();

  // ── Start local camera ────────────────────────────────────────────────────
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setIsCameraStarted(true);
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      return null;
    }
  }, []);

  // ── Create peer connection to a specific peer ─────────────────────────────
  const createPC = useCallback((targetSocketId) => {
    if (peerConnections.current[targetSocketId]) {
      peerConnections.current[targetSocketId].close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetSocketId] = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) =>
        pc.addTrack(track, localStreamRef.current)
      );
    }

    // ICE candidates
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('group-ice', { roomId, to: targetSocketId, candidate: e.candidate });
      }
    };

    // Remote stream
    pc.ontrack = (e) => {
      if (e.streams && e.streams[0]) {
        setPeers((prev) => {
          const exists = prev.find((p) => p.socketId === targetSocketId);
          if (exists) {
            return prev.map((p) =>
              p.socketId === targetSocketId ? { ...p, stream: e.streams[0] } : p
            );
          }
          return [...prev, { socketId: targetSocketId, stream: e.streams[0], name: 'Peer' }];
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setPeers((prev) => prev.filter((p) => p.socketId !== targetSocketId));
        delete peerConnections.current[targetSocketId];
      }
    };

    return pc;
  }, [roomId, socket]);

  // ── Join room ─────────────────────────────────────────────────────────────
  const joinRoom = useCallback(async (userName) => {
    await startLocalStream();
    socket.connect();
    socket.emit('group-join', { roomId, userName: userName || 'Guest' });
  }, [roomId, socket, startLocalStream]);

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Someone already in room — we need to offer them
    const onGroupPeers = async ({ peers: existingPeers }) => {
      setPeerCount(existingPeers.length + 1);
      for (const peer of existingPeers) {
        const pc = createPC(peer.socketId);
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        socket.emit('group-offer', { roomId, to: peer.socketId, offer });
        // Set peer name
        setPeers((prev) => {
          if (prev.find((p) => p.socketId === peer.socketId)) return prev;
          return [...prev, { socketId: peer.socketId, stream: null, name: peer.name || 'Peer' }];
        });
      }
    };

    // New peer joined — they will send us an offer
    const onGroupPeerJoined = ({ socketId, name }) => {
      setPeerCount((c) => c + 1);
      setPeers((prev) => {
        if (prev.find((p) => p.socketId === socketId)) return prev;
        return [...prev, { socketId, stream: null, name: name || 'Peer' }];
      });
    };

    // Receive offer from new peer
    const onGroupOffer = async ({ from, offer, name }) => {
      const pc = createPC(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('group-answer', { roomId, to: from, answer });
      setPeers((prev) => {
        if (prev.find((p) => p.socketId === from)) return prev;
        return [...prev, { socketId: from, stream: null, name: name || 'Peer' }];
      });
    };

    // Receive answer
    const onGroupAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    // Receive ICE candidate
    const onGroupIce = async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { }
      }
    };

    // Peer left
    const onGroupPeerLeft = ({ socketId }) => {
      setPeerCount((c) => Math.max(0, c - 1));
      setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
    };

    const onGroupFull = () => setRoomFull(true);

    socket.on('group-peers',       onGroupPeers);
    socket.on('group-peer-joined', onGroupPeerJoined);
    socket.on('group-offer',       onGroupOffer);
    socket.on('group-answer',      onGroupAnswer);
    socket.on('group-ice',         onGroupIce);
    socket.on('group-peer-left',   onGroupPeerLeft);
    socket.on('group-room-full',   onGroupFull);

    return () => {
      socket.off('group-peers',       onGroupPeers);
      socket.off('group-peer-joined', onGroupPeerJoined);
      socket.off('group-offer',       onGroupOffer);
      socket.off('group-answer',      onGroupAnswer);
      socket.off('group-ice',         onGroupIce);
      socket.off('group-peer-left',   onGroupPeerLeft);
      socket.off('group-room-full',   onGroupFull);
    };
  }, [roomId, socket, createPC]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsAudioMuted((m) => !m);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setIsVideoOff((v) => !v);
  }, []);

  const hangUp = useCallback(() => {
    Object.values(peerConnections.current).forEach((pc) => pc.close());
    peerConnections.current = {};
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    socket.emit('group-leave', { roomId });
    socket.disconnect();
    setPeers([]);
  }, [roomId, socket]);

  return {
    localVideoRef,
    localStreamRef,
    peers,
    peerCount,
    roomFull,
    isCameraStarted,
    isAudioMuted,
    isVideoOff,
    joinRoom,
    toggleAudio,
    toggleVideo,
    hangUp,
    maxPeers: MAX_PEERS,
  };
}
