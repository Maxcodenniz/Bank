import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, createLocalTracks, generateToken, joinChannel, leaveChannel, updateStreamStatus } from '../lib/agoraClient';
import { supabase } from '../lib/supabaseClient';
import { X, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2, Users, Clock, Play, Square, Heart, RefreshCw, Camera } from 'lucide-react';

interface MobileLiveStudioProps {
  concert: any;
  onClose: () => void;
}

const MobileLiveStudio: React.FC<MobileLiveStudioProps> = ({ concert, onClose }) => {
  const [client, setClient] = useState<any | null>(null);
  const [localTracks, setLocalTracks] = useState<any | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamDuration, setStreamDuration] = useState(0);
  const [viewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const videoRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamStartRef = useRef<number | null>(null);
  const applyVideoStyles = useCallback(() => {
    if (!videoRef.current) return;
    const videoEl = videoRef.current.querySelector('video') as HTMLVideoElement | null;
    if (!videoEl) return;

    // Avoid zooming the camera feed; show full frame
    videoEl.style.width = '100vw';
    videoEl.style.height = '100vh';
    videoEl.style.maxWidth = '100vw';
    videoEl.style.maxHeight = '100vh';
    videoEl.style.objectFit = 'contain';
    videoEl.style.objectPosition = 'center';
    videoEl.style.display = 'block';
    videoEl.style.position = 'absolute';
    videoEl.style.top = '0';
    videoEl.style.left = '0';
    videoEl.style.backgroundColor = '#000';
    videoEl.style.transform = 'none';
  }, []);

  const clearVideoContainer = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.innerHTML = '';
  }, []);


  const channelName = `event_${concert?.id}`;

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  }, []);

  const handleTap = useCallback(() => {
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(cameras);
        if (!selectedCameraId && cameras[0]) {
          setSelectedCameraId(cameras[0].deviceId);
        }
      } catch (err) {
        console.warn('Failed to enumerate cameras:', err);
      }
    };
    fetchCameras();
  }, [selectedCameraId]);

  useEffect(() => {
    if (!concert?.id) return;

    const fetchLikeCount = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('events')
          .select('like_count')
          .eq('id', concert.id)
          .single();
        if (!fetchError && data) {
          setLikeCount(data.like_count || 0);
        }
      } catch (err) {
        console.warn('Failed to fetch like count:', err);
      }
    };

    fetchLikeCount();

    const channel = supabase
      .channel(`event-likes-${concert.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${concert.id}` },
        (payload: any) => {
          const updated = payload.new as { like_count?: number | null };
          if (updated.like_count !== undefined) {
            setLikeCount(updated.like_count || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [concert?.id]);

  useEffect(() => {
    const c = createClient({ mode: 'live', codec: 'vp8' });
    setClient(c);
    return () => {
      try {
        c.leave();
      } catch {}
      if (localTracks) {
        try {
          localTracks[0]?.close();
          localTracks[1]?.close();
        } catch {}
      }
    };
  }, []);

  const initializePreview = useCallback(async () => {
    if (localTracks) return;
    setIsInitializing(true);
    setError(null);
    try {
      const tracks = await createLocalTracks(undefined, selectedCameraId || undefined, {
        width: 1280,
        height: 720,
        frameRate: 30,
        zoom: { min: 1.0, max: 1.0 }
      });
      if (tracks[1] && typeof tracks[1].setMirror === 'function') {
        tracks[1].setMirror(false);
      }
      if (tracks[1] && typeof tracks[1].setEncoderConfiguration === 'function') {
        tracks[1].setEncoderConfiguration({ width: 1280, height: 720, frameRate: 30 });
      }
      setLocalTracks(tracks);
      if (videoRef.current) {
        clearVideoContainer();
        try {
          tracks[1].stop();
        } catch {}
        tracks[1].play(videoRef.current);
        setTimeout(applyVideoStyles, 50);
        setTimeout(applyVideoStyles, 200);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to access camera');
    } finally {
      setIsInitializing(false);
    }
  }, [localTracks, applyVideoStyles, clearVideoContainer]);

  useEffect(() => {
    initializePreview();
  }, [initializePreview]);

  useEffect(() => {
    if (!videoRef.current) return;
    const observer = new MutationObserver(() => {
      applyVideoStyles();
    });
    observer.observe(videoRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyVideoStyles]);

  useEffect(() => {
    if (!isStreaming) {
      streamStartRef.current = null;
      setStreamDuration(0);
      return;
    }
    streamStartRef.current = Date.now();
    const interval = setInterval(() => {
      if (streamStartRef.current) {
        setStreamDuration(Math.floor((Date.now() - streamStartRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  };

  const startStream = async () => {
    if (!client) return setError('Streaming client not ready');
    if (!localTracks) return setError('Camera not ready');
    setError(null);
    try {
      const uid = (crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647) + 1;
      const tokenData = await generateToken(channelName, uid, 'publisher', 3600);
      await client.setClientRole('host');
      await joinChannel(client, channelName, tokenData, uid, localTracks);
      setIsStreaming(true);
      await updateStreamStatus(concert.id, 'live', 0);
      showControlsTemporarily();
    } catch (err: any) {
      setIsStreaming(false);
      setError(err?.message || 'Failed to start stream');
    }
  };

  const stopStream = async () => {
    if (!client) return;
    try {
      await leaveChannel(client, localTracks);
      await updateStreamStatus(concert.id, 'ended');
      setIsStreaming(false);
      showControlsTemporarily();
    } catch (err: any) {
      setError(err?.message || 'Failed to end stream');
    }
  };

  const toggleCamera = async () => {
    if (!localTracks?.[1]) return;
    const next = !isCameraOn;
    await localTracks[1].setEnabled(next);
    setIsCameraOn(next);
  };

  const switchCamera = async () => {
    if (!localTracks?.[1] || availableCameras.length < 2) return;
    const currentIndex = availableCameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];
    if (!nextCamera) return;

    try {
      if (typeof localTracks[1].setDevice === 'function') {
        await localTracks[1].setDevice(nextCamera.deviceId);
      } else {
        const tracks = await createLocalTracks(undefined, nextCamera.deviceId, {
          width: 1280,
          height: 720,
          frameRate: 30,
          zoom: { min: 1.0, max: 1.0 }
        });
        localTracks[1].close();
        setLocalTracks([localTracks[0], tracks[1]]);
      }
      setSelectedCameraId(nextCamera.deviceId);
      if (videoRef.current) {
        clearVideoContainer();
        try {
          localTracks[1].stop();
        } catch {}
        localTracks[1].play(videoRef.current);
        setTimeout(applyVideoStyles, 50);
      }
    } catch (err) {
      console.warn('Failed to switch camera:', err);
    }
  };

  const toggleMic = async () => {
    if (!localTracks?.[0]) return;
    const next = !isMicOn;
    await localTracks[0].setEnabled(next);
    setIsMicOn(next);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black text-white"
      onClick={handleTap}
      onTouchStart={handleTap}
    >
      <style>{`
        html, body, #root {
          height: 100%;
        }
        :fullscreen {
          width: 100vw !important;
          height: 100vh !important;
          background: #000 !important;
        }
        :-webkit-full-screen {
          width: 100vw !important;
          height: 100vh !important;
          background: #000 !important;
        }
        .mobile-live-preview video {
          width: 100vw !important;
          height: 100vh !important;
          object-fit: contain !important;
          object-position: center !important;
          display: block !important;
          background: #000 !important;
        }
      `}</style>

      {showEndConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-gray-900/95 border border-white/10 p-6 text-center shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">End live stream?</h3>
            <p className="text-sm text-gray-300 mb-6">This will stop the live event for all viewers.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  stopStream();
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
              >
                End Stream
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Overlay */}
      {showControls && (
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 bg-black/70 backdrop-blur-sm z-20">
          {isStreaming ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEndConfirm(true);
              }}
              className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
            >
              End
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          )}
          {isStreaming && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5" />
                <span className="font-semibold">{viewerCount}</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <Heart className="w-5 h-5 text-pink-400" />
                <span className="font-semibold">{likeCount}</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <Clock className="w-5 h-5" />
                <span className="font-semibold">{formatDuration(streamDuration)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Video Container */}
      <div className="absolute inset-0 bg-black overflow-hidden" style={{ width: '100vw', height: '100vh' }}>
        <div
          ref={videoRef}
          className="absolute inset-0 mobile-live-preview"
          style={{
            position: 'absolute',
            backgroundColor: '#000',
            width: '100vw',
            height: '100vh',
            overflow: 'hidden'
          }}
        />

        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-white">Initializing camera...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 p-4">
            <div className="bg-red-500/90 text-white p-4 rounded-lg max-w-sm text-center">
              <p className="font-semibold mb-2">Error</p>
              <p className="text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-4 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!isStreaming && !isInitializing && showControls && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
            <div className="pointer-events-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startStream();
                }}
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full font-bold text-lg shadow-2xl"
              >
                Start Stream
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Bottom Controls */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/70 backdrop-blur-sm z-20">
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMic();
              }}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isMicOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCamera();
              }}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isCameraOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                switchCamera();
              }}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              disabled={availableCameras.length < 2}
            >
              <Camera className="w-6 h-6 text-white" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isStreaming) {
                  setShowEndConfirm(true);
                } else {
                  startStream();
                }
              }}
              className={`p-4 rounded-full ${isStreaming ? 'bg-red-600' : 'bg-green-600'} text-white shadow-lg`}
            >
              {isStreaming ? <Square className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-6 h-6 text-white" /> : <Maximize2 className="w-6 h-6 text-white" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileLiveStudio;
