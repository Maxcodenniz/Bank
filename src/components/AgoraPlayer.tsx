import React, { useEffect, useState, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'; 
import { AlertCircle, RefreshCw } from 'lucide-react';

interface AgoraPlayerProps {
  channelName: string;
  appId?: string;
  token?: string;
  uid?: number;
  onViewerJoin?: () => void;
  onViewerLeave?: () => void;
  generateTokenFn?: (channelName: string, uid: number, role: string) => Promise<{token: string, appId: string}>;
  onVideoContainerReady?: (container: HTMLDivElement | null) => void;
  onClientReady?: (client: IAgoraRTCClient) => void;
  videoQuality?: string; // 'auto', '1080p', '720p', '480p', '360p'
}

const AgoraPlayer: React.FC<AgoraPlayerProps> = ({
  channelName,
  appId: propAppId,
  token: propToken,
  uid = Math.floor(Math.random() * 1000000),
  onViewerJoin,
  onViewerLeave,
  generateTokenFn,
  onVideoContainerReady,
  onClientReady,
  videoQuality = 'auto'
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [tokenData, setTokenData] = useState<{token: string, appId: string} | null>(null);
  const [hasCalledViewerJoin, setHasCalledViewerJoin] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(100);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const remoteAudioTracksRef = useRef<Map<number, any>>(new Map());
  const remoteVideoTracksRef = useRef<Map<number, any>>(new Map());
  const videoStyleObserverRef = useRef<MutationObserver | null>(null);
  
  const [stats, setStats] = useState<{
    resolution: string;
    fps: number;
    bitrate: number;
  }>({
    resolution: '',
    fps: 0,
    bitrate: 0
  });
  const statsIntervalRef = useRef<number | null>(null);

  // Expose player controls globally
  useEffect(() => {
    window.agoraPlayer = {
      setVolume: (volume: number) => {
        const normalizedVolume = Math.max(0, Math.min(100, volume));
        setCurrentVolume(normalizedVolume);
        updateRemoteAudioVolume(normalizedVolume);
      },
      muteAudio: (mute: boolean) => {
        setIsAudioMuted(mute);
        muteAllRemoteAudio(mute);
      },
      muteVideo: (mute: boolean) => {
        setIsVideoPaused(mute);
        muteAllRemoteVideo(mute);
      },
      getVolume: () => currentVolume,
      isMuted: () => isAudioMuted,
      isPaused: () => isVideoPaused
    };

    return () => {
      if (window.agoraPlayer) {
        delete window.agoraPlayer;
      }
    };
  }, [currentVolume, isAudioMuted, isVideoPaused]);

  useEffect(() => {
    initializeAndJoin();

    return () => {
      cleanup();
    };
  }, [channelName]);

  // Expose video container ref to parent
  useEffect(() => {
    if (onVideoContainerReady && videoContainerRef.current) {
      onVideoContainerReady(videoContainerRef.current);
    }
  }, [onVideoContainerReady]);

  useEffect(() => {
    // Apply current volume to all remote audio tracks
    updateRemoteAudioVolume(currentVolume);
  }, [currentVolume]);

  useEffect(() => {
    // Apply mute state to all remote audio tracks
    muteAllRemoteAudio(isAudioMuted);
  }, [isAudioMuted]);

  useEffect(() => {
    // Apply video pause state to all remote video tracks
    muteAllRemoteVideo(isVideoPaused);
  }, [isVideoPaused]);

  const updateRemoteAudioVolume = (volume: number) => {
    const volumeLevel = volume / 100;
    remoteAudioTracksRef.current.forEach((track, uid) => {
      try {
        if (track && track.setVolume) {
          track.setVolume(Math.floor(volume));
        }
      } catch (error) {
        console.warn(`Failed to set volume for user ${uid}:`, error);
      }
    });
  };

  const muteAllRemoteAudio = (mute: boolean) => {
    remoteAudioTracksRef.current.forEach((track, uid) => {
      try {
        if (track) {
          if (mute) {
            track.setVolume(0);
          } else {
            track.setVolume(currentVolume);
          }
        }
      } catch (error) {
        console.warn(`Failed to mute/unmute audio for user ${uid}:`, error);
      }
    });
  };

  const muteAllRemoteVideo = (mute: boolean) => {
    remoteVideoTracksRef.current.forEach((track, uid) => {
      try {
        if (track && track.setEnabled) {
          track.setEnabled(!mute);
        }
      } catch (error) {
        console.warn(`Failed to mute/unmute video for user ${uid}:`, error);
      }
    });

    // Also hide/show video container
    if (videoContainerRef.current) {
      if (mute) {
        videoContainerRef.current.style.opacity = '0.3';
      } else {
        videoContainerRef.current.style.opacity = '1';
      }
    }
  };

  const cleanup = () => {
    clearStatsInterval();
    clearRetryTimeout();
    remoteAudioTracksRef.current.clear();
    remoteVideoTracksRef.current.clear();
    
    // Clean up video style observer
    if (videoStyleObserverRef.current) {
      videoStyleObserverRef.current.disconnect();
      videoStyleObserverRef.current = null;
    }
    
    leaveChannel();
    
    if (onViewerLeave && hasCalledViewerJoin) {
      onViewerLeave();
      setHasCalledViewerJoin(false);
    }
  };

  const clearStatsInterval = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  const clearRetryTimeout = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  };

  const initializeAndJoin = async () => {
    if (isRetrying) {
      console.log('Already retrying, skipping duplicate attempt');
      return;
    }
    
    setIsRetrying(true);
    
    try {
      console.log('Initializing Agora player...');
      
      if (clientRef.current) {
        console.log('Cleaning up existing client...');
        await leaveChannel();
      }

      const envAppId = import.meta.env.VITE_AGORA_APP_ID;
      if (!envAppId && !generateTokenFn && !propAppId) {
        throw new Error('No Agora configuration found. Please check VITE_AGORA_APP_ID environment variable.');
      }

      console.log('Creating new Agora client...');
      const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      clientRef.current = client;
      // Notify parent component about client
      if (onClientReady) {
        onClientReady(client);
      }

      console.log('Setting up event listeners...');
      client.on('user-published', handleUserPublished);
      client.on('user-unpublished', handleUserUnpublished);
      client.on('user-joined', handleUserJoined);
      client.on('user-left', handleUserLeft);
      client.on('exception', handleException);
      client.on('connection-state-change', handleConnectionStateChange);

      console.log('Getting token data...');
      const currentTokenData = await getTokenData();
      
      if (!currentTokenData) {
        throw new Error('Failed to obtain token data');
      }

      console.log('Joining channel...');
      await joinChannel(currentTokenData);

      console.log('✅ Successfully initialized and joined channel');
      setRetryCount(0);

      if (onViewerJoin && !hasCalledViewerJoin) {
        console.log('Calling onViewerJoin callback...');
        try {
          onViewerJoin();
          setHasCalledViewerJoin(true);
        } catch (callbackErr) {
          console.warn('onViewerJoin callback failed:', callbackErr);
        }
      }

    } catch (err: any) {
      console.error('❌ Error initializing Agora client:', err);
      
      let errorMessage = 'Failed to initialize streaming client.';
      
      if (err.message.includes('authentication') || err.message.includes('Token')) {
        errorMessage = 'Authentication failed. Please refresh the page and try again.';
      } else if (err.message.includes('configuration') || err.message.includes('appId')) {
        errorMessage = 'Streaming configuration error. Please contact support.';
      } else if (err.message.includes('network') || err.message.includes('connection')) {
        errorMessage = 'Network connection failed. Please check your internet and try again.';
      } else if (err.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
        errorMessage = 'Cannot connect to streaming servers. Please try again later.';
      }
      
      setError(errorMessage);
      setIsLoading(false);
      
      const recoverableErrors = [
        'CAN_NOT_GET_GATEWAY_SERVER',
        'network',
        'connection',
        'gateway',
        'timeout',
        'authentication'
      ];
      
      const isRecoverable = recoverableErrors.some(keyword => 
        err.code === keyword || err.message.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (isRecoverable) {
        console.log('Scheduling retry for recoverable error...');
        scheduleRetry();
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const getTokenData = async () => {
    try {
      console.log('Getting token data...');
      
      if (generateTokenFn) {
        console.log('Using token generation function...');
        const data = await generateTokenFn(channelName, uid, 'audience');
        
        if (!data || typeof data !== 'object' || !data.appId || !data.token) {
          throw new Error('Token function returned invalid data');
        }
        
        console.log('✅ Token data received');
        setTokenData(data);
        return data;
      } else if (propToken && propAppId) {
        const data = { token: propToken, appId: propAppId };
        setTokenData(data);
        return data;
      } else if (propAppId) {
        const data = { token: '', appId: propAppId };
        setTokenData(data);
        return data;
      } else {
        const envAppId = import.meta.env.VITE_AGORA_APP_ID;
        if (envAppId) {
          const data = { token: '', appId: envAppId };
          setTokenData(data);
          return data;
        } else {
          throw new Error('No authentication configuration available');
        }
      }
    } catch (err: any) {
      console.error('❌ Error getting token data:', err);
      throw new Error('Failed to get authentication data');
    }
  };

  const handleException = (event: any) => {
    console.warn(`Agora exception: ${event.code} - ${event.msg}`);
    if (event.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
      setError('Connection to streaming server failed. Please try again.');
      scheduleRetry();
    }
  };

  const handleConnectionStateChange = (curState: string, prevState: string) => {
    console.log(`Connection state changed: ${prevState} -> ${curState}`);
    
    if (curState === 'CONNECTED') {
      setError(null);
      setIsLoading(false);
      setRetryCount(0);
    } else if (curState === 'DISCONNECTED' && prevState === 'CONNECTED') {
      setError('Connection lost. Attempting to reconnect...');
      scheduleRetry();
    }
  };

  const scheduleRetry = () => {
    if (retryCount >= 5) {
      console.log('Maximum retry attempts reached, stopping retries');
      setError('Connection failed after multiple attempts. Please refresh the page.');
      setIsRetrying(false);
      return;
    }
    
    clearRetryTimeout();
    const nextRetryCount = retryCount + 1;
    const delay = Math.min(30000, Math.pow(2, nextRetryCount) * 1000);
    
    console.log(`Scheduling retry ${nextRetryCount}/5 in ${delay}ms`);
    setRetryCount(nextRetryCount);
    
    retryTimeoutRef.current = window.setTimeout(() => {
      console.log(`Retrying connection (attempt ${nextRetryCount}/5)...`);
      initializeAndJoin();
    }, delay);
  };

  const joinChannel = async (tokenDataParam?: {token: string, appId: string}) => {
    if (!clientRef.current) {
      throw new Error('Agora client not initialized');
    }

    const currentTokenData = tokenDataParam || tokenData;
    if (!currentTokenData) {
      throw new Error('Token data not available');
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Joining channel as audience...');
      
      await clientRef.current.setClientRole('audience');
      
      const joinResult = await clientRef.current.join(
        currentTokenData.appId, 
        channelName, 
        currentTokenData.token || null, 
        uid
      );
      
      console.log('✅ Successfully joined channel as audience:', joinResult);
      setIsJoined(true);
      setIsLoading(false);
      
    } catch (err: any) {
      console.error('❌ Error joining channel:', err);
      setIsJoined(false);
      
      let errorMessage = 'Failed to join stream. Please try again later.';
      
      if (err.code) {
        switch (err.code) {
          case 'INVALID_TOKEN':
          case 'TOKEN_EXPIRED':
            errorMessage = 'Stream authentication failed. Please refresh the page.';
            break;
          case 'CAN_NOT_GET_GATEWAY_SERVER':
            errorMessage = 'Cannot connect to streaming server. Please check your internet connection.';
            break;
          case 'INVALID_APP_ID':
            errorMessage = 'Streaming service configuration error. Please contact support.';
            break;
          default:
            errorMessage = `Connection error (${err.code}). Please try again.`;
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
      
      const retryableCodes = ['CAN_NOT_GET_GATEWAY_SERVER', 'NETWORK_ERROR', 'TIMEOUT'];
      if (retryableCodes.includes(err.code)) {
        scheduleRetry();
      }
      
      throw err;
    } finally {
      setIsRetrying(false);
    }
  };

  const leaveChannel = async () => {
    if (!clientRef.current) return;
    
    try {
      clearStatsInterval();
      
      // Clear track references
      remoteAudioTracksRef.current.clear();
      remoteVideoTracksRef.current.clear();
      
      remoteUsers.forEach(user => {
        try {
          if (user.videoTrack) {
            user.videoTrack.stop();
          }
          if (user.audioTrack) {
            user.audioTrack.stop();
          }
          clientRef.current?.unsubscribe(user);
        } catch (error) {
          console.warn('Error unsubscribing from user:', error);
        }
      });
      
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = '';
      }
      
      await clientRef.current.leave();
      console.log('Left channel successfully');
      
      setRemoteUsers([]);
      setIsJoined(false);
      setHasCalledViewerJoin(false);
      
    } catch (err) {
      console.error('Error leaving channel:', err);
    }
  };

  const startStatsCollection = () => {
    if (statsIntervalRef.current) return;
    
    statsIntervalRef.current = window.setInterval(() => {
      if (remoteUsers.length > 0 && clientRef.current) {
        try {
          const user = remoteUsers[0];
          const videoStats = clientRef.current.getRemoteVideoStats()[user.uid];
          
          if (videoStats) {
            setStats({
              resolution: `${videoStats.receiveResolutionWidth}x${videoStats.receiveResolutionHeight}`,
              fps: Math.round(videoStats.receiveFrameRate || 0),
              bitrate: Math.round(videoStats.receiveVideoBitrate || 0)
            });
          }
        } catch (error) {
          console.warn('Error getting stats:', error);
        }
      }
    }, 2000);
  };

  // Function to map quality string to Agora stream type
  const getStreamType = (quality: string): number => {
    // Agora stream types: 0 = HIGH, 1 = LOW
    switch (quality) {
      case '1080p':
      case '720p':
        return 0; // HIGH
      case '480p':
      case '360p':
        return 1; // LOW
      case 'auto':
      default:
        return 0; // Default to HIGH for auto
    }
  };

  // Apply video quality to remote users
  const applyVideoQuality = (quality: string) => {
    if (!clientRef.current || remoteUsers.length === 0) return;
    
    try {
      const streamType = getStreamType(quality);
      remoteUsers.forEach(user => {
        if (user.uid) {
          clientRef.current?.setRemoteVideoStreamType(user.uid, streamType);
          console.log(`Applied quality ${quality} (stream type ${streamType}) to user ${user.uid}`);
        }
      });
    } catch (error) {
      console.warn('Error applying video quality:', error);
    }
  };

  // Update quality when prop changes
  useEffect(() => {
    if (videoQuality && remoteUsers.length > 0 && clientRef.current) {
      applyVideoQuality(videoQuality);
    }
  }, [videoQuality, remoteUsers.length]);

  const handleUserPublished = async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
    try {
      console.log('User published:', user.uid, mediaType);
      
      await clientRef.current?.subscribe(user, mediaType);
      console.log('Subscribe success:', user.uid, mediaType);
      
      // Apply video quality immediately after subscribing
      if (mediaType === 'video' && videoQuality && clientRef.current) {
        const streamType = getStreamType(videoQuality);
        try {
          clientRef.current.setRemoteVideoStreamType(user.uid, streamType);
          console.log(`Applied quality ${videoQuality} to user ${user.uid}`);
        } catch (qualityError) {
          console.warn('Error setting video quality:', qualityError);
        }
      }

      if (isLoading) {
        setIsLoading(false);
      }
      
      setRemoteUsers(prev => {
        const existingUserIndex = prev.findIndex(u => u.uid === user.uid);
        if (existingUserIndex === -1) {
          return [...prev, user];
        } else {
          const updatedUsers = [...prev];
          updatedUsers[existingUserIndex] = user;
          return updatedUsers;
        }
      });
      
      // Handle video
      if (mediaType === 'video' && user.videoTrack && videoContainerRef.current) {
        try {
          const container = videoContainerRef.current;
          container.innerHTML = '';
          
          // Add class for viewer-specific styling
          container.classList.add('agora-viewer-player');
          
          // Function to apply contain styling to video
          const applyContainStyle = (videoElement: HTMLVideoElement) => {
            // Remove any transforms that might cause zooming
            videoElement.style.setProperty('transform', 'none', 'important');
            videoElement.style.setProperty('scale', '1', 'important');
            
            // Set dimensions
            videoElement.style.setProperty('width', '100%', 'important');
            videoElement.style.setProperty('height', '100%', 'important');
            videoElement.style.setProperty('max-width', '100%', 'important');
            videoElement.style.setProperty('max-height', '100%', 'important');
            videoElement.style.setProperty('min-width', 'auto', 'important');
            videoElement.style.setProperty('min-height', 'auto', 'important');
            
            // Force contain (not cover)
            videoElement.style.setProperty('object-fit', 'contain', 'important');
            videoElement.style.setProperty('object-position', 'center', 'important');
            
            // Display properties
            videoElement.style.setProperty('display', 'block', 'important');
            videoElement.style.setProperty('position', 'relative', 'important');
            videoElement.style.setProperty('margin', '0', 'important');
            videoElement.style.setProperty('padding', '0', 'important');
            
            console.log('✅ Viewer video styled with contain');
          };
          
          // Clean up existing observer
          if (videoStyleObserverRef.current) {
            videoStyleObserverRef.current.disconnect();
          }
          
          // Set up persistent MutationObserver to catch and maintain video element styling
          const observer = new MutationObserver((mutations) => {
            const videoElement = container.querySelector('video') as HTMLVideoElement;
            if (videoElement) {
              applyContainStyle(videoElement);
              // Also watch for attribute changes (in case Agora modifies styles)
              observer.observe(videoElement, { 
                attributes: true, 
                attributeFilter: ['style', 'class'],
                childList: false,
                subtree: false
              });
            }
          });
          
          observer.observe(container, { 
            childList: true, 
            subtree: true,
            attributes: false
          });
          
          videoStyleObserverRef.current = observer;
          
          user.videoTrack.play(container);
          console.log('✅ Remote video playing');
          
          // Also try to style immediately and with multiple attempts
          const styleVideo = () => {
            const videoElement = container.querySelector('video') as HTMLVideoElement;
            if (videoElement) {
              applyContainStyle(videoElement);
              return true;
            }
            return false;
          };
          
          // Try immediately
          if (!styleVideo()) {
            // Try after short delay
            setTimeout(() => {
              if (!styleVideo()) {
                // Try after longer delay
                setTimeout(() => {
                  if (!styleVideo()) {
                    // Final attempt
                    setTimeout(styleVideo, 500);
                  }
                }, 300);
              }
            }, 50);
          }
          
          // Store video track reference
          remoteVideoTracksRef.current.set(user.uid, user.videoTrack);
          
          // Apply current video pause state
          if (isVideoPaused) {
            muteAllRemoteVideo(true);
          }
          
          startStatsCollection();
          
        } catch (playError) {
          console.error('Error playing remote video:', playError);
          setError('Failed to play video stream. Please try refreshing.');
        }
      }
      
      // Handle audio
      if (mediaType === 'audio' && user.audioTrack) {
        try {
          user.audioTrack.play();
          console.log('✅ Remote audio playing');
          
          // Store audio track reference
          remoteAudioTracksRef.current.set(user.uid, user.audioTrack);
          
          // Apply current volume and mute state
          const effectiveVolume = isAudioMuted ? 0 : currentVolume;
          if (user.audioTrack.setVolume) {
            user.audioTrack.setVolume(effectiveVolume);
          }
          
        } catch (playError) {
          console.error('Error playing remote audio:', playError);
        }
      }
      
    } catch (err) {
      console.error('Error subscribing to user:', err);
      setError('Failed to receive stream content. Please try again.');
    }
  };

  const handleUserUnpublished = (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
    console.log('User unpublished:', user.uid, mediaType);
    
    if (mediaType === 'video') {
      // Remove video track reference
      remoteVideoTracksRef.current.delete(user.uid);
      
      if (videoContainerRef.current) {
        videoContainerRef.current.innerHTML = '';
      }
      clearStatsInterval();
      setStats({ resolution: '', fps: 0, bitrate: 0 });
    }
    
    if (mediaType === 'audio') {
      // Remove audio track reference
      remoteAudioTracksRef.current.delete(user.uid);
    }
    
    // If user unpublished all media, remove them from the list
    if (!user.hasAudio && !user.hasVideo) {
      setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    }
  };

  const handleUserJoined = (user: IAgoraRTCRemoteUser) => {
    console.log('User joined:', user.uid);
  };

  const handleUserLeft = (user: IAgoraRTCRemoteUser) => {
    console.log('User left:', user.uid);
    
    // Clean up track references
    remoteAudioTracksRef.current.delete(user.uid);
    remoteVideoTracksRef.current.delete(user.uid);
    
    const userInList = remoteUsers.find(u => u.uid === user.uid);
    if (userInList && userInList.hasVideo && videoContainerRef.current) {
      videoContainerRef.current.innerHTML = '';
    }
    
    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
    
    if (remoteUsers.length <= 1) {
      clearStatsInterval();
      setStats({ resolution: '', fps: 0, bitrate: 0 });
    }
  };

  const retryConnection = () => {
    setError(null);
    setIsLoading(true);
    setRetryCount(0);
    initializeAndJoin();
  };

  // Validation
  if (!channelName) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg flex items-center justify-center">
        <div className="text-white p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-xl font-semibold mb-2">Stream Configuration Error</p>
          <p className="text-gray-400">Missing required streaming parameters.</p>
        </div>
      </div>
    );
  }

  const hasActiveVideoStream = remoteUsers.some(user => user.hasVideo);

  return (
    <div className="relative w-full h-full">
      <div 
        ref={videoContainerRef}
        className={`agora-viewer-player w-full h-full bg-black transition-opacity duration-300 ${
          isVideoPaused ? 'opacity-30' : 'opacity-100'
        }`}
        style={{ 
          filter: isVideoPaused ? 'grayscale(50%) blur(1px)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          inset: 0
        }}
      ></div>
      
      {/* Volume indicator overlay */}
      {!isLoading && !error && hasActiveVideoStream && (currentVolume !== 100 || isAudioMuted) && (
        <div className="absolute top-4 left-4 bg-black/50 text-white text-sm px-3 py-1 rounded-lg backdrop-blur-sm">
          <div className="flex items-center space-x-2">
            {isAudioMuted ? (
              <span className="text-red-400">🔇 Muted</span>
            ) : (
              <span>🔊 {currentVolume}%</span>
            )}
          </div>
        </div>
      )}
      
      {/* Pause overlay */}
      {isVideoPaused && hasActiveVideoStream && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
          <div className="bg-black/70 text-white px-4 py-2 rounded-full flex items-center space-x-2">
            <div className="w-3 h-3 bg-white"></div>
            <div className="w-3 h-3 bg-white"></div>
            <span className="text-sm font-medium">Paused</span>
          </div>
        </div>
      )}
      
      {/* Stats overlay */}
      {hasActiveVideoStream && !isLoading && !error && stats.resolution && (
        <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs px-3 py-1 rounded-lg backdrop-blur-sm">
          <div className="flex flex-col space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400 mr-2">Quality:</span>
              <span>{stats.resolution} @ {stats.fps}fps</span>
            </div>
            {stats.bitrate > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400 mr-2">Bitrate:</span>
                <span>{stats.bitrate} kbps</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-white text-lg">Connecting to stream...</p>
            <p className="text-gray-400 text-sm mt-2">This may take a moment</p>
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 rounded-lg">
          <div className="text-white text-center p-6 max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-xl font-semibold mb-2">Connection Error</p>
            <p className="text-gray-300 mb-4">{error}</p>
            <button 
              onClick={retryConnection}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center mx-auto"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Connecting...' : 'Retry Connection'}
            </button>
          </div>
        </div>
      )}
      
      {/* Waiting for stream overlay */}
      {isJoined && !hasActiveVideoStream && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 rounded-lg">
          <div className="text-white text-center p-6">
            <div className="h-12 w-12 border-4 border-gray-600 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl font-semibold mb-2">Waiting for Stream</p>
            <p className="text-gray-400">The stream hasn't started yet. Please wait...</p>
            <p className="text-gray-500 text-sm mt-2">Connected to channel: {channelName}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgoraPlayer;