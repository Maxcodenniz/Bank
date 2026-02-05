/**
 * Stream utility functions for DREEMYSTAR platform
 */

export interface StreamEndpoint {
  rtmpUrl: string;
  playbackUrl: string;
  streamKey: string;
}

/**
 * Generate secure stream endpoint for an event
 */
export const generateStreamEndpoint = (eventId: string, userId: string): StreamEndpoint => {
  const timestamp = Date.now();
  const streamKey = generateSecureStreamKey(eventId, userId, timestamp);
  
  // In production, these would come from environment variables
  const RTMP_SERVER = process.env.REACT_APP_RTMP_SERVER || 'rtmp://streaming.dreemystar.com:1935/live';
  const HLS_SERVER = process.env.REACT_APP_HLS_SERVER || 'https://streaming.dreemystar.com/hls';
  
  return {
    rtmpUrl: `${RTMP_SERVER}/${streamKey}`,
    playbackUrl: `${HLS_SERVER}/${streamKey}.m3u8`,
    streamKey
  };
};

/**
 * Generate secure stream key
 */
const generateSecureStreamKey = (eventId: string, userId: string, timestamp: number): string => {
  // Simple key generation for demo - in production, use proper crypto
  const data = `${eventId}-${userId}-${timestamp}`;
  return btoa(data).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
};

/**
 * Validate stream URL format
 */
export const isValidStreamUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['rtmp:', 'rtmps:', 'http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

/**
 * Get stream type from URL
 */
export const getStreamType = (url: string): 'rtmp' | 'hls' | 'dash' | 'unknown' => {
  if (url.startsWith('rtmp')) return 'rtmp';
  if (url.includes('.m3u8')) return 'hls';
  if (url.includes('.mpd')) return 'dash';
  return 'unknown';
};

/**
 * Format viewer count for display
 */
export const formatViewerCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

/**
 * Calculate stream duration
 */
export const calculateStreamDuration = (startTime: string): string => {
  const start = new Date(startTime);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

/**
 * Check if browser supports WebRTC
 */
export const supportsWebRTC = (): boolean => {
  return !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.RTCPeerConnection
  );
};

/**
 * Check if browser supports HLS natively
 */
export const supportsHLS = (): boolean => {
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
};

/**
 * Get optimal video quality based on connection
 */
export const getOptimalQuality = async (): Promise<'720p' | '480p' | '360p'> => {
  try {
    // Simple connection test - in production, use more sophisticated detection
    const connection = (navigator as any).connection;
    if (connection) {
      const { effectiveType, downlink } = connection;
      
      if (effectiveType === '4g' && downlink > 5) return '720p';
      if (effectiveType === '4g' || downlink > 2) return '480p';
      return '360p';
    }
    
    // Fallback quality
    return '480p';
  } catch {
    return '480p';
  }
};

/**
 * Stream health monitoring
 */
export interface StreamHealth {
  status: 'good' | 'fair' | 'poor';
  bitrate: number;
  fps: number;
  latency: number;
}

export const monitorStreamHealth = (streamUrl: string): Promise<StreamHealth> => {
  return new Promise((resolve) => {
    // Simulate stream health monitoring
    // In production, this would connect to your streaming server's API
    setTimeout(() => {
      resolve({
        status: 'good',
        bitrate: 4500,
        fps: 30,
        latency: 150
      });
    }, 1000);
  });
};

/**
 * OBS Studio configuration generator
 */
export interface OBSConfig {
  server: string;
  streamKey: string;
  settings: {
    resolution: string;
    fps: number;
    bitrate: number;
    encoder: string;
  };
}

export const generateOBSConfig = (streamEndpoint: StreamEndpoint): OBSConfig => {
  const [server] = streamEndpoint.rtmpUrl.split('/').slice(0, -1);
  
  return {
    server: server.join('/'),
    streamKey: streamEndpoint.streamKey,
    settings: {
      resolution: '1920x1080',
      fps: 30,
      bitrate: 4500,
      encoder: 'x264'
    }
  };
};

/**
 * Copy text to clipboard with fallback
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    }
  } catch {
    return false;
  }
};