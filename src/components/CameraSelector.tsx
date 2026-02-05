import React, { useState, useEffect } from 'react';
import { Camera, RefreshCw } from 'lucide-react';

interface CameraSelectorProps {
  onCameraChange: (deviceId: string) => void;
  selectedDeviceId?: string;
}

const CameraSelector: React.FC<CameraSelectorProps> = ({ onCameraChange, selectedDeviceId }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Request permission to access media devices
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Get list of video input devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
      
      setDevices(videoDevices);
      
      // If no device is selected yet and we have devices, select the first one
      if (!selectedDeviceId && videoDevices.length > 0) {
        onCameraChange(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error loading camera devices:', err);
      setError('Failed to access camera devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <Camera className="h-5 w-5" />
        <div className="animate-pulse">Loading cameras...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm">
        {error}
        <button 
          onClick={loadDevices}
          className="ml-2 text-purple-400 hover:text-purple-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-yellow-400 text-sm flex items-center">
        <Camera className="h-5 w-5 mr-2" />
        No cameras detected
        <button 
          onClick={loadDevices}
          className="ml-2 p-1 text-gray-400 hover:text-white"
          title="Refresh camera list"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm text-gray-400">Select Camera</label>
        <button 
          onClick={loadDevices}
          className="p-1 text-gray-400 hover:text-white"
          title="Refresh camera list"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      
      <select
        value={selectedDeviceId}
        onChange={(e) => onCameraChange(e.target.value)}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Camera ${devices.indexOf(device) + 1}`}
            {device.label.toLowerCase().includes('imac') && ' (iMac)'}
          </option>
        ))}
      </select>
      
      <div className="text-xs text-gray-500">
        {devices.length} camera{devices.length !== 1 ? 's' : ''} available
        {devices.some(d => d.label.toLowerCase().includes('imac')) && 
          ' (iMac camera detected)'}
      </div>
    </div>
  );
};

export default CameraSelector;