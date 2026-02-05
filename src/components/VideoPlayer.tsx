import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, ExternalLink } from 'lucide-react';

interface VideoPlayerProps {
  streamUrl: string;
  isLive?: boolean;
  onViewerJoin?: () => void;
  onViewerLeave?: () => void;
}

// Simple URL type detection
const getUrlType = (url: string) => {
  if (!url) return 'invalid';
  
  // Direct video files
  if (/\.(mp4|webm|ogg|m4v)(\?|$)/i.test(url)) {
    return 'video';
  }
  
  // Streaming formats
  if (/\.(m3u8|mpd)(\?|$)/i.test(url) || url.includes('stream')) {
    return 'stream';
  }
  
  // Platform URLs
  if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv/i.test(url)) {
    return 'platform';
  }
  
  // Unknown - try as video anyway
  return 'unknown';
};

const getPlatformInfo = (url: string) => {
  if (/youtube\.com|youtu\.be/i.test(url)) {
    return { name: 'YouTube', color: 'bg-red-600', icon: '🎥' };
  }
  if (/vimeo\.com/i.test(url)) {
    return { name: 'Vimeo', color: 'bg-blue-600', icon: '🎬' };
  }
  if (/twitch\.tv/i.test(url)) {
    return { name: 'Twitch', color: 'bg-purple-600', icon: '🎮' };
  }
  if (/tiktok\.com/i.test(url)) {
    return { name: 'TikTok', color: 'bg-black', icon: '🎵' };
  }
  return { name: 'Platform', color: 'bg-gray-600', icon: '🔗' };
};

const SimpleVideoPlayer: React.FC<VideoPlayerProps> = ({ 
  streamUrl, 
  isLive = false,
  onViewerJoin, 
  onViewerLeave 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState({
    isPlaying: false,
    isMuted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    isLoading: true,
    error: null as string | null
  });

  const urlType = getUrlType(streamUrl);
  const platformInfo = getPlatformInfo(streamUrl);
  const canPlayDirectly = urlType === 'video' || urlType === 'stream' || urlType === 'unknown';

  useEffect(() => {
    if (!canPlayDirectly) return;

    const video = videoRef.current;
    if (!video) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    video.src = streamUrl;
    video.crossOrigin = 'anonymous';

    const handleLoadStart = () => setState(prev => ({ ...prev, isLoading: true }));
    const handleCanPlay = () => {
      setState(prev => ({ ...prev, isLoading: false }));
      onViewerJoin?.();
    };
    const handleTimeUpdate = () => {
      setState(prev => ({ ...prev, currentTime: video.currentTime, duration: video.duration }));
    };
    const handlePlay = () => setState(prev => ({ ...prev, isPlaying: true }));
    const handlePause = () => setState(prev => ({ ...prev, isPlaying: false }));
    const handleVolumeChange = () => {
      setState(prev => ({ ...prev, volume: video.volume, isMuted: video.muted }));
    };
    const handleError = () => {
      setState(prev => ({ 
        ...prev, 
        error: 'Could not load video. Check the URL or try a different format.',
        isLoading: false 
      }));
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('error', handleError);

    video.load();

    if (isLive) {
      setTimeout(() => {
        video.play().catch(() => {
          setState(prev => ({ ...prev, error: 'Autoplay blocked. Click play button.' }));
        });
      }, 500);
    }

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('error', handleError);
      onViewerLeave?.();
    };
  }, [streamUrl, canPlayDirectly, isLive, onViewerJoin, onViewerLeave]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (state.isPlaying) {
      video.pause();
    } else {
      video.play().catch(() => {
        setState(prev => ({ ...prev, error: 'Playback failed' }));
      });
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Platform URLs - show external link
  if (!canPlayDirectly) {
    return (
      <div className="relative w-full aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center overflow-hidden">
        <div className="text-center text-white p-8">
          <div className="text-6xl mb-4">{platformInfo.icon}</div>
          <h3 className="text-2xl font-bold mb-2">{platformInfo.name} Video</h3>
          <p className="text-gray-300 mb-6 max-w-sm">
            Platform videos can't be embedded. Click below to watch directly on {platformInfo.name}.
          </p>
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-3 px-6 py-3 ${platformInfo.color} text-white rounded-lg hover:opacity-90 transition-all font-semibold text-lg transform hover:scale-105`}
          >
            <ExternalLink size={24} />
            Open in {platformInfo.name}
          </a>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="relative w-full aspect-video bg-gray-900 rounded-xl flex items-center justify-center">
        <div className="text-center text-white p-6">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold mb-3">Video Error</h3>
          <p className="text-gray-400 mb-6 max-w-md">{state.error}</p>
          <button
            onClick={() => {
              setState(prev => ({ ...prev, error: null, isLoading: true }));
              videoRef.current?.load();
            }}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Video player
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group shadow-2xl">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        controls={false}
        muted={state.isMuted}
      />

      {/* Loading */}
      {state.isLoading && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-lg font-medium">
              {urlType === 'stream' ? 'Loading stream...' : 'Loading video...'}
            </p>
          </div>
        </div>
      )}

      {/* Live indicator */}
      {isLive && !state.isLoading && (
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-2 rounded-full text-sm font-bold flex items-center animate-pulse">
          <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
          LIVE
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {/* Progress bar */}
        {!isLive && state.duration > 0 && (
          <div className="mb-4">
            <input
              type="range"
              min="0"
              max={state.duration}
              value={state.currentTime}
              onChange={(e) => {
                const video = videoRef.current;
                if (video) video.currentTime = parseFloat(e.target.value);
              }}
              className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-white/80 mt-2">
              <span>{formatTime(state.currentTime)}</span>
              <span>{formatTime(state.duration)}</span>
            </div>
          </div>
        )}

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="text-white hover:text-purple-400 transition-colors p-2 rounded-full hover:bg-white/10"
              disabled={isLive && state.isPlaying}
            >
              {state.isPlaying ? <Pause size={28} /> : <Play size={28} />}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video) video.muted = !video.muted;
                }}
                className="text-white hover:text-purple-400 transition-colors p-1 rounded"
              >
                {state.isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={state.isMuted ? 0 : state.volume}
                onChange={(e) => {
                  const video = videoRef.current;
                  if (video) video.volume = parseFloat(e.target.value);
                }}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={() => {
              const container = videoRef.current?.parentElement;
              if (container?.requestFullscreen) {
                container.requestFullscreen();
              }
            }}
            className="text-white hover:text-purple-400 transition-colors p-2 rounded-full hover:bg-white/10"
          >
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {/* Click to play overlay */}
      {!state.isPlaying && !state.isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
        >
          <div className="bg-black/60 rounded-full p-8 hover:bg-black/80 transition-all transform hover:scale-110">
            <Play size={60} className="text-white ml-2" />
          </div>
        </div>
      )}
    </div>
  );
};

// Demo Component
const VideoPlayerDemo = () => {
  const [url, setUrl] = useState('');
  const [isLive, setIsLive] = useState(false);

  const workingExamples = [
    {
      label: 'Big Buck Bunny (MP4)',
      url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    },
    {
      label: 'Sample Video (MP4)',
      url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
    },
    {
      label: 'YouTube Video (Platform)',
      url: 'https://www.youtube.com/watch?v=NpR25fQ5Q5E'
    },
    {
      label: 'YouTube Short (Platform)',
      url: 'https://www.youtube.com/shorts/fMJP4DLe1Bw'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Simple Video Player</h1>
        <p className="text-gray-600 text-lg">Clean, reliable, no-fuss video playback</p>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
            ✅ What Works Great
          </h3>
          <ul className="space-y-2 text-sm text-green-700">
            <li>• Direct video files (.mp4, .webm, .ogg)</li>
            <li>• Streaming URLs (.m3u8, .mpd)</li>
            <li>• Custom controls with hover effects</li>
            <li>• Fullscreen support</li>
            <li>• Live stream support</li>
            <li>• Mobile-friendly</li>
          </ul>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
            🔗 Platform Handling
          </h3>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>• YouTube → Clean external link</li>
            <li>• Vimeo → Opens in new tab</li>
            <li>• TikTok → Direct platform access</li>
            <li>• Twitch → No embedding issues</li>
            <li>• No broken iframes</li>
            <li>• User-friendly design</li>
          </ul>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Paste any video URL here..."
          />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isLive}
              onChange={(e) => setIsLive(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Live Stream</span>
          </label>
        </div>

        {/* Quick examples */}
        <div>
          <p className="text-sm text-gray-600 mb-2">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {workingExamples.map((example, index) => (
              <button
                key={index}
                onClick={() => setUrl(example.url)}
                className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors border"
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Player */}
      {url && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Video Player:</h3>
          <SimpleVideoPlayer
            streamUrl={url}
            isLive={isLive}
            onViewerJoin={() => console.log('Viewer joined')}
            onViewerLeave={() => console.log('Viewer left')}
          />
        </div>
      )}

      {!url && (
        <div className="bg-gray-100 rounded-xl aspect-video flex items-center justify-center">
          <p className="text-gray-500 text-lg">Enter a video URL above to start</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayerDemo;