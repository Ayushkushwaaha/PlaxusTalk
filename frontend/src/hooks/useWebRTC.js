import { useRef, useState, useCallback, useEffect } from 'react';
import { getSocket } from '../lib/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

export function useWebRTC(roomId) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  const [connectionState, setConnectionState] = useState('idle');
  // idle | connecting | connected | disconnected | failed
  const [iceState, setIceState] = useState('new');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [latency, setLatency] = useState(null);
  const [isP2P, setIsP2P] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [callId, setCallId] = useState(null);

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
        // Detect P2P via candidate type
        pc.getStats().then((stats) => {
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              setIsP2P(report.localCandidateId !== undefined);
            }
          });
        });
      }
      if (pc.iceConnectionState === 'failed') setConnectionState('failed');
      if (pc.iceConnectionState === 'disconnected') setConnectionState('disconnected');
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Attach local tracks
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
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      setConnectionState('failed');
      return null;
    }
  }, []);

  const joinRoom = useCallback(
    async (wallet) => {
      await startLocalStream();
      socket.connect();
      socket.emit('join-room', { roomId, wallet });
      setConnectionState('connecting');
    },
    [roomId, socket, startLocalStream]
  );

  // Socket event handlers
  useEffect(() => {
    const onJoined = async ({ isInitiator, peerCount: count, callId: cid }) => {
      setPeerCount(count);
      setCallId(cid);
      if (!isInitiator) return; // wait for peer to join before creating offer
    };

    const onPeerJoined = async ({ userCount }) => {
      setPeerCount(userCount);
      if (userCount === 2) {
        // Create offer only if we were first (isInitiator)
        const pc = createPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { roomId, offer });
      }
    };

    const onOffer = async ({ offer }) => {
      const pc = createPeerConnection();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { roomId, answer });
    };

    const onAnswer = async ({ answer }) => {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIceCandidate = async ({ candidate }) => {
      try {
        await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('ICE candidate error:', e);
      }
    };

    const onPeerLeft = ({ userCount }) => {
      setPeerCount(userCount);
      setConnectionState('disconnected');
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };

    const onRoomFull = () => setConnectionState('failed');

    const onLatencyUpdate = ({ latency: l, p2p }) => {
      setLatency(l);
      setIsP2P(p2p);
    };

    socket.on('joined-room', onJoined);
    socket.on('peer-joined', onPeerJoined);
    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('peer-left', onPeerLeft);
    socket.on('room-full', onRoomFull);
    socket.on('latency-update', onLatencyUpdate);

    return () => {
      socket.off('joined-room', onJoined);
      socket.off('peer-joined', onPeerJoined);
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('peer-left', onPeerLeft);
      socket.off('room-full', onRoomFull);
      socket.off('latency-update', onLatencyUpdate);
    };
  }, [roomId, socket, createPeerConnection]);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsAudioMuted((m) => !m);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsVideoOff((v) => !v);
  }, []);

  const hangUp = useCallback(() => {
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    socket.disconnect();
    setConnectionState('idle');
  }, [socket]);

  return {
    localVideoRef,
    remoteVideoRef,
    connectionState,
    iceState,
    isAudioMuted,
    isVideoOff,
    latency,
    isP2P,
    peerCount,
    callId,
    joinRoom,
    toggleAudio,
    toggleVideo,
    hangUp,
  };
}
