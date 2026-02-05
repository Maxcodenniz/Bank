import React, { useState, useEffect } from 'react';
import { Activity, Camera, Cpu, Gauge } from 'lucide-react';

interface CameraStatsProps {
  stream: MediaStream | null;
}

interface CameraMetrics {
  resolution: string;
  frameRate: number;
  aspectRatio: string;
  facingMode: string;
  deviceId: string;
  label: string;
  capabilities: Record<string, any>;
}

const CameraStats: React.FC<CameraStatsProps> = ({ stream }) => {
  const [metrics, setMetrics] = useState<CameraMetrics | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!stream) {
      setMetrics(null);
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      setMetrics(null);
      return;
    }

    const settings = videoTrack.getSettings();
    const capabilities = videoTrack.getCapabilities();

    setMetrics({
      resolution: `${settings.width || '?'}×${settings.height || '?'}`,
      frameRate: settings.frameRate || 0,
      aspectRatio: settings.aspectRatio ? settings.aspectRatio.toFixed(2) : '?',
      facingMode: settings.facingMode || 'unknown',
      deviceId: settings.deviceId || 'unknown',
      label: videoTrack.label || 'Unknown Camera',
      capabilities: capabilities || {}
    });

    // Update metrics every 2 seconds
    const interval = setInterval(() => {
      const updatedSettings = videoTrack.getSettings();
      setMetrics(prev => {
        if (!prev) return null;
        return {
          ...prev,
          resolution: `${updatedSettings.width || '?'}×${updatedSettings.height || '?'}`,
          frameRate: updatedSettings.frameRate || 0
        };
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [stream]);

  if (!metrics) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg text-gray-400 text-center">
        <Camera className="h-6 w-6 mx-auto mb-2 opacity-50" />
        <p>No camera data available</p>
      </div>
    );
  }

  const isImacCamera = metrics.label.toLowerCase().includes('imac') || 
                       metrics.label.toLowerCase().includes('facetime') ||
                       metrics.label.toLowerCase().includes('apple') ||
                       metrics.label.toLowerCase().includes('built-in');

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <Activity className="h-5 w-5 text-purple-400 mr-2" />
          <h3 className="font-semibold text-white">Camera Metrics</h3>
        </div>
        <div className={`px-2 py-1 rounded text-xs ${isImacCamera ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
          {isImacCamera ? 'iMac Camera' : 'Camera Active'}
        </div>
      </div>

      <div className={`mt-4 space-y-3 ${isExpanded ? 'block' : 'hidden'}`}>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center text-gray-400 text-xs mb-1">
              <Camera className="h-3 w-3 mr-1" />
              <span>Device</span>
            </div>
            <div className="text-white text-sm font-medium truncate" title={metrics.label}>
              {metrics.label}
            </div>
          </div>
          
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center text-gray-400 text-xs mb-1">
              <Cpu className="h-3 w-3 mr-1" />
              <span>Resolution</span>
            </div>
            <div className="text-white text-sm font-medium">
              {metrics.resolution}
            </div>
          </div>
          
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center text-gray-400 text-xs mb-1">
              <Gauge className="h-3 w-3 mr-1" />
              <span>Frame Rate</span>
            </div>
            <div className="text-white text-sm font-medium">
              {metrics.frameRate.toFixed(1)} FPS
            </div>
          </div>
          
          <div className="bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center text-gray-400 text-xs mb-1">
              <Activity className="h-3 w-3 mr-1" />
              <span>Aspect Ratio</span>
            </div>
            <div className="text-white text-sm font-medium">
              {metrics.aspectRatio}
            </div>
          </div>
        </div>

        {/* Capabilities */}
        {Object.keys(metrics.capabilities).length > 0 && (
          <div className="bg-gray-700 p-3 rounded-lg">
            <h4 className="text-xs text-gray-400 mb-2">Camera Capabilities</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {metrics.capabilities.width && (
                <div>
                  <span className="text-gray-400">Width:</span>{' '}
                  <span className="text-white">{metrics.capabilities.width.min} - {metrics.capabilities.width.max}px</span>
                </div>
              )}
              {metrics.capabilities.height && (
                <div>
                  <span className="text-gray-400">Height:</span>{' '}
                  <span className="text-white">{metrics.capabilities.height.min} - {metrics.capabilities.height.max}px</span>
                </div>
              )}
              {metrics.capabilities.frameRate && (
                <div>
                  <span className="text-gray-400">FPS:</span>{' '}
                  <span className="text-white">{metrics.capabilities.frameRate.min} - {metrics.capabilities.frameRate.max}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraStats;