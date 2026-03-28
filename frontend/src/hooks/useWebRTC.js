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

export function useWebRTC(roomId) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef          = useRef(null);
  const localStreamRef = useRef(null);
  const isInitiatorRef = useRef(false);

  const [connectionState, setConnectionState] = useState('idle');
  const [iceState,        setIceState]        = useState('new');
  const [isAudioMuted,    setIsAudioMuted]    = useState(false);
  const [isVideoOff,      setIsVideoOff]      = useState(false);
  const [latency,         setLatency]         = useState(null);
  const [isP2P,           setIsP2P]           = useState(false);
  const [peerCount,       setPeerCount]       = useState(0);
  const [callId,          setCallId]          = useState(null);

  const socket = getSocket();

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) pcRef.current.close();

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      setIceState(pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionState('connected');
        setIsP2P(true);
      }
      if (pc.iceConnectionState === 'failed')       setConnectionState('failed');
      if (pc.iceConnectionState === 'disconnected') setConnectionState('disconnected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected')    setConnectionState('connected');
      if (pc.connectionState === 'failed')       setConnectionState('failed');
      if (pc.connectionState === 'disconnected') setConnectionState('disconnected');
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    return pc;
  }, [roomId, socket]);

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      setConnectionState('failed');
      return null;
    }
  }, []);

  const joinRoom = useCallback(
    async (wallet, userId, userName, password) => {
      await startLocalStream();
      socket.connect();
      socket.emit('join-room', { roomId, wallet, userId, userName, password });
      setConnectionState('connecting');
    },
    [roomId, socket, startLocalStream]
  );

  useEffect(() => {
    const onJoined = ({ isInitiator, peerCount: count, callId: cid }) => {
      setPeerCount(count);
      setCallId(cid);
      isInitiatorRef.current = isInitiator;
    };

    const onPeerJoined = async ({ userCount }) => {
      setPeerCount(userCount);
      if (userCount === 2 && isInitiatorRef.current) {
        try {
          const pc = createPeerConnection();
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          socket.emit('offer', { roomId, offer });
        } catch (err) {
          console.error('Offer error:', err);
        }
      }
    };

    const onOffer = async ({ offer }) => {
      try {
        const pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { roomId, answer });
      } catch (err) {
        console.error('Answer error:', err);
      }
    };

    const onAnswer = async ({ answer }) => {
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (err) {
        console.error('setRemoteDescription error:', err);
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      try {
        if (pcRef.current && candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('ICE candidate error:', err);
      }
    };

    const onPeerLeft = ({ userCount }) => {
      setPeerCount(userCount);
      setConnectionState('disconnected');
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    const onRoomFull      = () => setConnectionState('failed');
    const onLatencyUpdate = ({ latency: l, p2p }) => { setLatency(l); setIsP2P(p2p); };

    socket.on('joined-room',    onJoined);
    socket.on('peer-joined',    onPeerJoined);
    socket.on('offer',          onOffer);
    socket.on('answer',         onAnswer);
    socket.on('ice-candidate',  onIceCandidate);
    socket.on('peer-left',      onPeerLeft);
    socket.on('room-full',      onRoomFull);
    socket.on('latency-update', onLatencyUpdate);

    return () => {
      socket.off('joined-room',    onJoined);
      socket.off('peer-joined',    onPeerJoined);
      socket.off('offer',          onOffer);
      socket.off('answer',         onAnswer);
      socket.off('ice-candidate',  onIceCandidate);
      socket.off('peer-left',      onPeerLeft);
      socket.off('room-full',      onRoomFull);
      socket.off('latency-update', onLatencyUpdate);
    };
  }, [roomId, socket, createPeerConnection]);

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
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    socket.disconnect();
    setConnectionState('idle');
  }, [socket]);

  return {
    localVideoRef, remoteVideoRef, connectionState, iceState,
    isAudioMuted, isVideoOff, latency, isP2P, peerCount, callId,
    localStreamRef, pcRef, joinRoom, toggleAudio, toggleVideo, hangUp,
  };
}