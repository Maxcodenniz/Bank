import React, { useEffect, useRef, useState } from 'react';
import { createClient, createLocalTracks, generateToken, joinChannel, leaveChannel, updateStreamStatus } from '../lib/agoraClient';
import { Camera, Mic, MicOff, Video, VideoOff, X, Users, Clock, Gift, RotateCcw } from 'lucide-react';

const ModernStreamingStudio: React.FC<{ concert: any }> = ({ concert }) => {
  const [client, setClient] = useState<any | null>(null);
  const [localTracks, setLocalTracks] = useState<any | null>(null);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamingUid, setStreamingUid] = useState<number | null>(null);
  const [streamDuration, setStreamDuration] = useState(0);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLDivElement | null>(null);
  const streamStartTimeRef = useRef<number | null>(null);

  const channelName = `event_${concert.id}`;

  useEffect(() => {
    const c = createClient({ mode: 'live', codec: 'vp8' });

    c.on('user-joined', () => setViewerCount(v => v + 1));
    c.on('user-left', () => setViewerCount(v => Math.max(0, v - 1)));
    c.on('connection-state-change', (curState: string) => {
      if (curState === 'DISCONNECTED' && isStreaming) {
        setError('Connection lost. Please check your internet.');
      }
    });

    setClient(c);

    return () => {
      if (localTracks) {
        try {
          localTracks[0].close();
          localTracks[1].close();
        } catch (e) {}
      }
      try { c.leave(); } catch (e) {}
    };
  }, []);

  useEffect(() => {
    if (isStreaming) {
      streamStartTimeRef.current = Date.now();
      const interval = setInterval(() => {
        if (streamStartTimeRef.current) {
          setStreamDuration(Math.floor((Date.now() - streamStartTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      streamStartTimeRef.current = null;
      setStreamDuration(0);
    }
  }, [isStreaming]);

  const fetchDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(stream => stream.getTracks().forEach(track => track.stop()));

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');

      if (cameras[0]) setSelectedCameraId(cameras[0].deviceId);
      if (microphones[0]) setSelectedMicrophoneId(microphones[0].deviceId);
    } catch (err) {
      setError('Failed to access camera and microphone');
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  const initializeCamera = async () => {
    if (cameraInitialized || cameraLoading) return;
    setCameraLoading(true);
    setError(null);

    try {
      const tracks = await createLocalTracks(
        selectedMicrophoneId,
        selectedCameraId,
        {
          width: 720,
          height: 1280,
          frameRate: 30
        }
      );
      setLocalTracks(tracks);

      if (videoRef.current) {
        tracks[1].play(videoRef.current);
      }

      setCameraInitialized(true);
      setSuccess('Camera ready');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      let errorMessage = 'Failed to initialize camera';
      if (err.message.includes('Permission denied')) {
        errorMessage = 'Camera/microphone access denied';
      }
      setError(errorMessage);
    } finally {
      setCameraLoading(false);
    }
  };

  const checkCanStartStream = () => {
    const eventStartTime = new Date(concert.start_time).getTime();
    const now = Date.now();
    const fiveMinutesBeforeStart = eventStartTime - (5 * 60 * 1000);

    return now >= fiveMinutesBeforeStart;
  };

  const getTimeUntilCanStart = () => {
    const eventStartTime = new Date(concert.start_time).getTime();
    const now = Date.now();
    const fiveMinutesBeforeStart = eventStartTime - (5 * 60 * 1000);
    const diff = fiveMinutesBeforeStart - now;

    if (diff <= 0) return null;

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { minutes, seconds };
  };

  const startStream = async () => {
    setError(null);
    if (!client) return setError('Client not ready');
    if (!localTracks) return setError('Initialize camera first');

    if (!checkCanStartStream()) {
      const timeLeft = getTimeUntilCanStart();
      if (timeLeft) {
        setError(`You can start streaming 5 minutes before the event. Please wait ${timeLeft.minutes}m ${timeLeft.seconds}s`);
        return;
      }
    }

    try {
      const connectionState = client.connectionState;
      if (connectionState !== 'DISCONNECTED') {
        await client.leave();
      }

      const uid = (crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647) + 1;
      setStreamingUid(uid);

      const tokenData = await generateToken(channelName, uid, 'publisher', 3600);
      await client.setClientRole('host');
      await joinChannel(client, channelName, tokenData, uid, localTracks);

      setIsStreaming(true);
      await updateStreamStatus(concert.id, 'live', 0);

      setSuccess('You are LIVE!');
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      setIsStreaming(false);
      setStreamingUid(null);
      setError('Failed to start stream');
    }
  };

  const stopStream = async () => {
    if (!client) return;

    try {
      await leaveChannel(client, localTracks);
      await updateStreamStatus(concert.id, 'ended');

      setIsStreaming(false);
      setStreamingUid(null);
      setViewerCount(0);

      setSuccess('Stream ended');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError('Failed to stop stream');
    }
  };

  const toggleCamera = async () => {
    if (localTracks && localTracks[1]) {
      const newState = !isCameraOn;
      await localTracks[1].setEnabled(newState);
      setIsCameraOn(newState);
    }
  };

  const toggleMic = async () => {
    if (localTracks && localTracks[0]) {
      const newState = !isMicOn;
      await localTracks[0].setEnabled(newState);
      setIsMicOn(newState);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3">
            <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl aspect-[9/16] max-w-md mx-auto">
              {!cameraInitialized && !cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900 to-pink-900">
                  <button
                    onClick={initializeCamera}
                    className="px-8 py-4 bg-white text-purple-900 rounded-full font-bold text-lg hover:scale-105 transform transition-all shadow-lg"
                  >
                    Start Camera
                  </button>
                </div>
              )}

              {cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
                    <p className="text-lg">Initializing camera...</p>
                  </div>
                </div>
              )}

              <div ref={videoRef} className="w-full h-full bg-black" />

              {cameraInitialized && (
                <>
                  {isStreaming && (
                    <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
                      <div className="flex items-center space-x-2 bg-red-600 px-4 py-2 rounded-full shadow-lg animate-pulse">
                        <div className="w-3 h-3 bg-white rounded-full"></div>
                        <span className="font-bold text-sm">LIVE</span>
                      </div>
                      <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full">
                        <Clock size={16} />
                        <span className="font-mono text-sm">{formatDuration(streamDuration)}</span>
                      </div>
                    </div>
                  )}

                  {isStreaming && (
                    <div className="absolute top-20 right-6 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full flex items-center space-x-2">
                      <Users size={18} />
                      <span className="font-bold">{viewerCount}</span>
                    </div>
                  )}

                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center justify-around bg-black/50 backdrop-blur-sm rounded-2xl p-4">
                      <button
                        onClick={toggleCamera}
                        className={`p-4 rounded-full transition-all ${
                          isCameraOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
                      </button>

                      <button
                        onClick={toggleMic}
                        className={`p-4 rounded-full transition-all ${
                          isMicOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                      </button>

                      <button
                        onClick={() => {}}
                        className="p-4 rounded-full bg-white/20 hover:bg-white/30 transition-all"
                        disabled
                      >
                        <RotateCcw size={24} />
                      </button>

                      <button
                        className="p-4 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 transition-all"
                        disabled
                      >
                        <Gift size={24} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="lg:w-1/3 space-y-4">
            <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
              <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {concert.title}
              </h2>

              {error && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4 flex items-center space-x-2">
                  <X size={18} className="flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 mb-4">
                  <p className="text-sm">{success}</p>
                </div>
              )}

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className={isStreaming ? 'text-green-400 font-bold' : 'text-gray-400'}>
                    {isStreaming ? '🔴 LIVE' : 'Offline'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Camera:</span>
                  <span className={cameraInitialized ? 'text-green-400' : 'text-gray-400'}>
                    {cameraInitialized ? 'Ready' : 'Not initialized'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Viewers:</span>
                  <span className="text-white font-bold">{viewerCount}</span>
                </div>
              </div>

              {!isStreaming ? (
                <button
                  onClick={startStream}
                  disabled={!cameraInitialized || cameraLoading}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
                >
                  {cameraInitialized ? 'Go Live' : 'Start Camera First'}
                </button>
              ) : (
                <button
                  onClick={stopStream}
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  End Stream
                </button>
              )}
            </div>

            {isStreaming && (
              <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
                <h3 className="font-bold mb-3 flex items-center">
                  <Users size={20} className="mr-2" />
                  Live Tips
                </h3>
                <ul className="text-sm text-gray-300 space-y-2">
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    <span>Keep your internet connection stable</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    <span>Ensure good lighting for better quality</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    <span>Engage with your viewers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-400 mr-2">•</span>
                    <span>Monitor viewer count</span>
                  </li>
                </ul>
              </div>
            )}

            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 rounded-xl p-6 shadow-lg border border-purple-500/20">
              <h3 className="font-bold mb-2">Stream Info</h3>
              <p className="text-xs text-gray-300">Channel: {channelName}</p>
              {streamingUid && (
                <p className="text-xs text-gray-300 mt-1">UID: {streamingUid}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernStreamingStudio;
