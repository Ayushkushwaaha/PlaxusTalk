import { useRef, useState, useCallback, useEffect } from 'react';
import { getSocket } from '../lib/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: 'b1ddb764e1d0b66a7267de87',
      credential: 'Z838/HM7L1qC+HDP',
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
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
  const localStreamRef  = useRef(null);
  const localVideoRef   = useRef(null);
  const peerConnections = useRef({});       // socketId → RTCPeerConnection
  const screenStreamRef = useRef(null);     // FIX 1 — screen share stream
  const facingModeRef   = useRef('user');   // FIX 8 — camera facing mode

  const [peers,          setPeers]          = useState([]);
  const [isAudioMuted,   setIsAudioMuted]   = useState(false);
  const [isVideoOff,     setIsVideoOff]     = useState(false);
  const [isCameraStarted,setIsCameraStarted]= useState(false);
  const [peerCount,      setPeerCount]      = useState(0);
  const [roomFull,       setRoomFull]       = useState(false);
  const [isSharing,      setIsSharing]      = useState(false); // FIX 1
  const [isRecording,    setIsRecording]    = useState(false); // FIX 2
  const [recordingTime,  setRecordingTime]  = useState(0);     // FIX 2
  const [facingMode,     setFacingMode]     = useState('user');// FIX 8

  const mediaRecorderRef = useRef(null);
  const recordingChunks  = useRef([]);
  const recordingTimer   = useRef(null);

  const socket = getSocket();

  // ── FIX 3+4 — Start camera with correct constraints ───────────────────────
  const startLocalStream = useCallback(async (facing = 'user') => {
    // Stop existing tracks first
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    try {
      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          // FIX 4 — limit resolution on mobile to avoid zoomed face
          width:  isMobile ? { ideal: 640,  max: 1280 } : { ideal: 1280 },
          height: isMobile ? { ideal: 480,  max: 720  } : { ideal: 720  },
          aspectRatio: { ideal: 1.777 }, // 16:9
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      localStreamRef.current = stream;

      // FIX 3 — always update localVideoRef srcObject
      if (localVideoRef.current) 
        {
  localVideoRef.current.srcObject = stream;
  localVideoRef.current.play().catch(() => {});
}

      // Replace tracks in all active peer connections
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      Object.values(peerConnections.current).forEach(pc => {
        pc.getSenders().forEach(sender => {
          if (sender.track?.kind === 'video' && videoTrack) {
            sender.replaceTrack(videoTrack).catch(() => {});
          }
          if (sender.track?.kind === 'audio' && audioTrack) {
            sender.replaceTrack(audioTrack).catch(() => {});
          }
        });
      });

      setIsCameraStarted(true);
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      // FIX 3 — try without video if camera fails
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioOnly;
        setIsCameraStarted(true);
        return audioOnly;
      } catch { return null; }
    }
  }, []);

  // ── FIX 8 — Toggle front/back camera ─────────────────────────────────────
  const switchCamera = useCallback(async () => {
    const newFacing = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = newFacing;
    setFacingMode(newFacing);
    await startLocalStream(newFacing);
  }, [startLocalStream]);

  // ── Create peer connection ────────────────────────────────────────────────
  const createPC = useCallback((targetSocketId) => {
    if (peerConnections.current[targetSocketId]) {
      peerConnections.current[targetSocketId].close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[targetSocketId] = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track =>
        pc.addTrack(track, localStreamRef.current)
      );
    }

    pc.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('group-ice', { roomId, to: targetSocketId, candidate: e.candidate });
      }
    };

    pc.ontrack = e => {
      if (e.streams?.[0]) {
        setPeers(prev => {
          const exists = prev.find(p => p.socketId === targetSocketId);
          if (exists) {
            return prev.map(p =>
              p.socketId === targetSocketId ? { ...p, stream: e.streams[0] } : p
            );
          }
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

  // ── FIX 10 — Join room by ID ──────────────────────────────────────────────
  const joinRoom = useCallback(async (userName) => {
    const stream = await startLocalStream(facingModeRef.current);
    if (!socket.connected) socket.connect();
    const id = roomId?.toUpperCase();
    socket.emit('group-join', { roomId: id, userName: userName || 'Guest' });
  }, [roomId, socket, startLocalStream]);

  // ── FIX 1 — Screen share ─────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' }, audio: false,
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack).catch(() => {});
      });

      // Show in local video
      if (localVideoRef.current) {
        const combined = new MediaStream([
          screenTrack,
          ...(localStreamRef.current?.getAudioTracks() || []),
        ]);
        localVideoRef.current.srcObject = combined;
      }

      screenTrack.onended = () => stopScreenShare();
      setIsSharing(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError') console.error('Screen share error:', err);
    }
  }, []);

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    // Restore camera track
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(cameraTrack).catch(() => {});
      });
    }
    // FIX 3 — restore local preview
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setIsSharing(false);
  }, []);

  const toggleScreenShare = useCallback(() => {
    if (isSharing) stopScreenShare(); else startScreenShare();
  }, [isSharing, startScreenShare, stopScreenShare]);

  // ── FIX 2 — Recording ────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    try {
      const tracks = [
        ...(localStreamRef.current?.getTracks() || []),
      ];
      const stream = new MediaStream(tracks);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
      recordingChunks.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) recordingChunks.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PlexusTalk-Group-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimer.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) { console.error('Recording error:', err); }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordingTimer.current);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording(); else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const formatTime = t => `${String(Math.floor(t / 60)).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}`;

  // ── Socket events ─────────────────────────────────────────────────────────
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
      if (pc) {
        try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); }
        catch (e) { console.error('setRemote error:', e); }
      }
    };

    const onGroupIce = async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc && candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { }
      }
    };

    const onGroupPeerLeft = ({ socketId }) => {
      setPeerCount(c => Math.max(0, c - 1));
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
    };

    // FIX 9 — Peer muted status
    const onPeerMuted = ({ socketId, isMuted }) => {
      setPeers(prev => prev.map(p =>
        p.socketId === socketId ? { ...p, isMuted } : p
      ));
    };

    const onGroupFull = () => setRoomFull(true);

    socket.on('group-peers',       onGroupPeers);
    socket.on('group-peer-joined', onGroupPeerJoined);
    socket.on('group-offer',       onGroupOffer);
    socket.on('group-answer',      onGroupAnswer);
    socket.on('group-ice',         onGroupIce);
    socket.on('group-peer-left',   onGroupPeerLeft);
    socket.on('group-room-full',   onGroupFull);
    socket.on('group-peer-muted',  onPeerMuted); // FIX 9

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

  // ── Controls ──────────────────────────────────────────────────────────────
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMuted = !isAudioMuted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setIsAudioMuted(newMuted);
    // FIX 9 — broadcast mute status to peers
    socket.emit('group-peer-muted', { roomId: roomId?.toUpperCase(), isMuted: newMuted });
  }, [isAudioMuted, roomId, socket]);

  // FIX 3 — Toggle video properly and restore preview
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current) return;
    const newVideoOff = !isVideoOff;
    if (newVideoOff) {
      // Turn off — just disable tracks
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = false; });
      setIsVideoOff(true);
    } else {
      // Turn back on — re-request camera to restore preview
      const tracks = localStreamRef.current.getVideoTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        tracks.forEach(t => { t.enabled = true; });
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        setIsVideoOff(false);
      } else {
        // Track ended — restart camera
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
  }, [roomId, socket, isRecording, stopRecording]);

  return {
    localVideoRef, localStreamRef,
    peers, peerCount, roomFull,
    isCameraStarted, isAudioMuted, isVideoOff,
    isSharing, isRecording, recordingTime, formatTime,
    facingMode,
    joinRoom, toggleAudio, toggleVideo, hangUp,
    toggleScreenShare, toggleRecording, switchCamera,
    maxPeers: MAX_PEERS,
  };
}