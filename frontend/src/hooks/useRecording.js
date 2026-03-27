import { useState, useRef, useCallback } from 'react';

export function useRecording(localVideoRef) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState([]);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = useCallback(() => {
    const video = localVideoRef?.current;
    const stream = video?.srcObject;
    if (!stream) return;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordings((p) => [...p, { url, timestamp: new Date().toLocaleString(), size: blob.size }]);
        chunksRef.current = [];
      };
      recorder.start(1000);
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) { console.error('Recording error:', err); }
  }, [localVideoRef]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      recorderRef.current = null;
      clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
    }
  }, [isRecording]);

  const toggleRecording = useCallback(() => {
    isRecording ? stopRecording() : startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const downloadRecording = useCallback((url, index) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `plaxustalk-rec-${index + 1}.webm`;
    a.click();
  }, []);

  const deleteRecording = useCallback((index) => {
    setRecordings((prev) => { URL.revokeObjectURL(prev[index].url); return prev.filter((_, i) => i !== index); });
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return { isRecording, recordingTime, recordings, toggleRecording, downloadRecording, deleteRecording, formatTime };
}
