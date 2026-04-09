import { useRef, useState, useCallback, useEffect } from 'react';
import { getSocket } from '../lib/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:80', username: 'b1ddb764e1d0b66a7267de87', credential: 'Z838/HM7L1qC+HDP' },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: 'b1ddb764e1d0b66a7267de87', credential: 'Z838/HM7L1qC+HDP' },
    { urls: 'turn:global.relay.metered.ca:443', username: 'b1ddb764e1d0b66a7267de87', credential: 'Z838/HM7L1qC+HDP' },
    { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'b1ddb764e1d0b66a7267de87', credential: 'Z838/HM7L1qC+HDP' },
  ],
};

const MAX_PEERS = 8;

export function useGroupWebRTC(roomId) {
  const localStreamRef  = useRef(null);
  const localVideoRef   = useRef(null);
  const peerConnections = useRef({});
  const screenStreamRef = useRef(null);
  const facingModeRef   = useRef('user');

  const [peers,         setPeers]         = useState([]);
  const [isAudioMuted,  setIsAudioMuted]  = useState(false);
  const [isVideoOff,    setIsVideoOff]    = useState(false);
  const [cameraReady,   setCameraReady]   = useState(false);
  const [peerCount,     setPeerCount]     = useState(0);
  const [roomFull,      setRoomFull]      = useState(false);
  const [isSharing,     setIsSharing]     = useState(false);
  const [isRecording,   setIsRecording]   = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode,    setFacingMode]    = useState('user');

  const recorderRef = useRef(null);
  const recChunks   = useRef([]);
  const recTimer    = useRef(null);
  const socket = getSocket();

  const startLocalStream = useCallback(async (facing = 'user') => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    try {
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width:  isMobile ? { ideal: 640 } : { ideal: 1280 },
          height: isMobile ? { ideal: 480 } : { ideal: 720 },
        },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }
      stream.getTracks().forEach(newTrack => {
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === newTrack.kind);
          if (sender) sender.replaceTrack(newTrack).catch(() => {});
        });
      });
      setCameraReady(true);
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      return null;
    }
  }, []);

  // Ref callback — attach stream when video element mounts
  const setLocalVideoRef = useCallback((el) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current) {
      el.srcObject = localStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const newFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = newFacing;
    setFacingMode(newFacing);
    await startLocalStream(newFacing);
  }, [startLocalStream]);

  const createPC = useCallback((targetSocketId) => {
    if (peerConnections.current[targetSocketId]) {
      peerConnections.current[targetSocketId].close();
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetSocketId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track =>
        pc.addTrack(track, localStreamRef.current)
      );
    }

    pc.onicecandidate = e => {
      if (e.candidate) socket.emit('group-ice', { roomId, to: targetSocketId, candidate: e.candidate });
    };

    pc.ontrack = e => {
      if (e.streams?.[0]) {
        setPeers(prev => {
          const exists = prev.find(p => p.socketId === targetSocketId);
          if (exists) return prev.map(p => p.socketId === targetSocketId ? { ...p, stream: e.streams[0] } : p);
          return [...prev, { socketId: targetSocketId, stream: e.streams[0], name: 'Peer', isMuted: false }];
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setPeers(prev => prev.filter(p => p.socketId !== targetSocketId));
        delete peerConnections.current[targetSocketId];
      }
    };

    return pc;
  }, [roomId, socket]);

  const joinRoom = useCallback(async (userName) => {
    await startLocalStream(facingModeRef.current);
    if (!socket.connected) socket.connect();
    socket.emit('group-join', { roomId: roomId?.toUpperCase(), userName: userName || 'Guest' });
  }, [roomId, socket, startLocalStream]);

  const startScreenShare = useCallback(async () => {
    try {
      const ss = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      screenStreamRef.current = ss;
      const screenTrack = ss.getVideoTracks()[0];
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack).catch(() => {});
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = new MediaStream([screenTrack, ...(localStreamRef.current?.getAudioTracks() || [])]);
      }
      screenTrack.onended = () => stopScreenShare();
      setIsSharing(true);
    } catch (err) { if (err.name !== 'NotAllowedError') console.error(err); }
  }, []);

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    const camTrack = localStreamRef.current?.getVideoTracks()[0];
    if (camTrack) {
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack).catch(() => {});
      });
    }
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
    setIsSharing(false);
  }, []);

  const toggleScreenShare = useCallback(() => {
    if (isSharing) stopScreenShare(); else startScreenShare();
  }, [isSharing, startScreenShare, stopScreenShare]);

  const startRecording = useCallback(() => {
    try {
      if (!localStreamRef.current) return;
      const rec = new MediaRecorder(localStreamRef.current, { mimeType: 'video/webm;codecs=vp8,opus' });
      recorderRef.current = rec;
      recChunks.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) recChunks.current.push(e.data); };
      rec.onstop = () => {
        const url = URL.createObjectURL(new Blob(recChunks.current, { type: 'video/webm' }));
        Object.assign(document.createElement('a'), { href: url, download: `PlexusTalk-Group-${Date.now()}.webm` }).click();
        URL.revokeObjectURL(url);
      };
      rec.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      recTimer.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) { console.error(err); }
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    clearInterval(recTimer.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const formatTime = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

  useEffect(() => {
    const onGroupPeers = async ({ peers: existingPeers }) => {
      setPeerCount(existingPeers.length + 1);
      for (const peer of existingPeers) {
        const pc = createPC(peer.socketId);
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          socket.emit('group-offer', { roomId: roomId?.toUpperCase(), to: peer.socketId, offer });
        } catch (e) { console.error('Offer error:', e); }
        setPeers(prev => {
          if (prev.find(p => p.socketId === peer.socketId)) return prev;
          return [...prev, { socketId: peer.socketId, stream: null, name: peer.name || 'Peer', isMuted: false }];
        });
      }
    };

    const onGroupPeerJoined = ({ socketId, name }) => {
      setPeerCount(c => c + 1);
      setPeers(prev => {
        if (prev.find(p => p.socketId === socketId)) return prev;
        return [...prev, { socketId, stream: null, name: name || 'Peer', isMuted: false }];
      });
    };

    const onGroupOffer = async ({ from, offer, name }) => {
      try {
        const pc = createPC(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('group-answer', { roomId: roomId?.toUpperCase(), to: from, answer });
        setPeers(prev => {
          if (prev.find(p => p.socketId === from)) return prev;
          return [...prev, { socketId: from, stream: null, name: name || 'Peer', isMuted: false }];
        });
      } catch (e) { console.error('Answer error:', e); }
    };

    const onGroupAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (pc) try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); } catch (e) { console.error(e); }
    };

    const onGroupIce = async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { }
    };

    const onGroupPeerLeft = ({ socketId }) => {
      setPeerCount(c => Math.max(0, c - 1));
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
    };

    const onPeerMuted = ({ socketId, isMuted }) => {
      setPeers(prev => prev.map(p => p.socketId === socketId ? { ...p, isMuted } : p));
    };

    const onGroupFull = () => setRoomFull(true);

    socket.on('group-peers',       onGroupPeers);
    socket.on('group-peer-joined', onGroupPeerJoined);
    socket.on('group-offer',       onGroupOffer);
    socket.on('group-answer',      onGroupAnswer);
    socket.on('group-ice',         onGroupIce);
    socket.on('group-peer-left',   onGroupPeerLeft);
    socket.on('group-room-full',   onGroupFull);
    socket.on('group-peer-muted',  onPeerMuted);

    return () => {
      socket.off('group-peers',       onGroupPeers);
      socket.off('group-peer-joined', onGroupPeerJoined);
      socket.off('group-offer',       onGroupOffer);
      socket.off('group-answer',      onGroupAnswer);
      socket.off('group-ice',         onGroupIce);
      socket.off('group-peer-left',   onGroupPeerLeft);
      socket.off('group-room-full',   onGroupFull);
      socket.off('group-peer-muted',  onPeerMuted);
    };
  }, [roomId, socket, createPC]);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMuted = !isAudioMuted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsAudioMuted(newMuted);
    socket.emit('group-peer-muted', { roomId: roomId?.toUpperCase(), isMuted: newMuted });
  }, [isAudioMuted, roomId, socket]);

  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;
    const newOff = !isVideoOff;
    if (newOff) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = false; });
      setIsVideoOff(true);
    } else {
      const tracks = localStreamRef.current.getVideoTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        tracks.forEach(t => { t.enabled = true; });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
          localVideoRef.current.play().catch(() => {});
        }
        setIsVideoOff(false);
      } else {
        await startLocalStream(facingModeRef.current);
        setIsVideoOff(false);
      }
    }
  }, [isVideoOff, startLocalStream]);

  const hangUp = useCallback(() => {
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    if (isRecording) stopRecording();
    socket.emit('group-leave', { roomId: roomId?.toUpperCase() });
    setPeers([]);
    setCameraReady(false);
  }, [roomId, socket, isRecording, stopRecording]);

  return {
    setLocalVideoRef,
    localVideoRef,
    localStreamRef,
    peers, peerCount, roomFull,
    cameraReady, isAudioMuted, isVideoOff,
    isSharing, isRecording, recordingTime, formatTime, facingMode,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    toggleScreenShare, toggleRecording, switchCamera,
    maxPeers: MAX_PEERS,
  };
}