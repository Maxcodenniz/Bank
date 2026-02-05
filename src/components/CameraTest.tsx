import React, { useState, useRef, useEffect } from 'react';
import { Camera, Mic, MicOff, VideoOff, RefreshCw, CheckCircle, AlertCircle, Settings } from 'lucide-react';

const CameraTest: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devices, setDevices] = useState<{
    videoDevices: MediaDeviceInfo[];
    audioDevices: MediaDeviceInfo[];
  }>({
    videoDevices: [],
    audioDevices: []
  });
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    checkPermissions();
    getDevices();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const checkPermissions = async () => {
    try {
      if (navigator.permissions) {
        const cameraResult = await navigator.permissions.query({ name: 'camera' as PermissionName });
        const micResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        
        setCameraPermission(cameraResult.state);
        setMicPermission(micResult.state);
        
        cameraResult.addEventListener('change', () => setCameraPermission(cameraResult.state));
        micResult.addEventListener('change', () => setMicPermission(micResult.state));
      }
    } catch (err) {
      console.log('Permission API not supported');
    }
  };

  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      setDevices({ videoDevices, audioDevices });
      
      if (videoDevices.length > 0 && !selectedVideoDevice) {
        setSelectedVideoDevice(videoDevices[0].deviceId);
      }
      if (audioDevices.length > 0 && !selectedAudioDevice) {
        setSelectedAudioDevice(audioDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting devices:', err);
    }
  };

  const startCamera = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Stop existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }

      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support camera access. Please use Chrome, Firefox, Safari, or Edge.');
      }

      console.log('🎥 Requesting camera access...');

      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice ? {
          deviceId: { exact: selectedVideoDevice },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        } : {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: selectedAudioDevice ? {
          deviceId: { exact: selectedAudioDevice },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      console.log('✅ Camera access granted:', {
        videoTracks: newStream.getVideoTracks().length,
        audioTracks: newStream.getAudioTracks().length
      });

      setStream(newStream);
      
      // Set video element source
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }

      // Get actual stream settings
      const videoTrack = newStream.getVideoTracks()[0];
      const audioTrack = newStream.getAudioTracks()[0];
      
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log('📹 Video settings:', settings);
      }
      
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        console.log('🎤 Audio settings:', settings);
      }

      setSuccess('✅ Camera and microphone are working perfectly!');
      
      // Update permissions after successful access
      setCameraPermission('granted');
      setMicPermission('granted');
      
      // Refresh device list
      await getDevices();

    } catch (err) {
      console.error('❌ Camera error:', err);
      
      let errorMessage = 'Failed to access camera and microphone.';
      
      if (err instanceof Error) {
        switch (err.name) {
          case 'NotAllowedError':
            errorMessage = '🚫 Camera access denied. Please click the camera icon in your browser\'s address bar and allow access.';
            setCameraPermission('denied');
            setMicPermission('denied');
            break;
          case 'NotFoundError':
            errorMessage = '📷 No camera or microphone found. Please connect a camera and microphone to your device.';
            break;
          case 'NotReadableError':
            errorMessage = '🔒 Camera is being used by another application. Please close other apps (Zoom, Skype, etc.) and try again.';
            break;
          case 'OverconstrainedError':
            errorMessage = '⚙️ Camera settings not supported. Trying with basic settings...';
            
            // Try with basic settings
            try {
              const basicStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
              });
              
              setStream(basicStream);
              
              if (videoRef.current) {
                videoRef.current.srcObject = basicStream;
                videoRef.current.onloadedmetadata = () => {
                  videoRef.current?.play().catch(console.error);
                };
              }
              
              setSuccess('✅ Camera initialized with basic settings.');
              setLoading(false);
              return;
              
            } catch (basicErr) {
              errorMessage = '❌ Camera failed even with basic settings. Please check your device.';
            }
            break;
          case 'AbortError':
            errorMessage = '⏹️ Camera access was interrupted. Please try again.';
            break;
          case 'SecurityError':
            errorMessage = '🔐 Camera access blocked by security settings. Please use HTTPS or check browser settings.';
            break;
          default:
            errorMessage = `❌ Camera error: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`🛑 Stopped ${track.kind} track`);
      });
      setStream(null);
      setSuccess('Camera stopped successfully.');
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
        console.log(`📹 Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
        console.log(`🎤 Audio ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
      }
    }
  };

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case 'granted': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'denied': return <AlertCircle className="h-4 w-4 text-red-400" />;
      default: return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getPermissionText = (permission: string) => {
    switch (permission) {
      case 'granted': return 'Granted';
      case 'denied': return 'Denied';
      default: return 'Not requested';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-900 text-white rounded-lg">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🎥 Camera & Microphone Test</h1>
        <p className="text-gray-400">Test your camera and microphone before going live</p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">Camera Error</div>
            <div className="text-sm mt-1">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-500 bg-opacity-10 border border-green-500 text-green-400 px-4 py-3 rounded-lg mb-6 flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Permissions Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Camera className="h-5 w-5 mr-2" />
              <span>Camera Permission</span>
            </div>
            <div className="flex items-center">
              {getPermissionIcon(cameraPermission)}
              <span className="ml-2 text-sm">{getPermissionText(cameraPermission)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Mic className="h-5 w-5 mr-2" />
              <span>Microphone Permission</span>
            </div>
            <div className="flex items-center">
              {getPermissionIcon(micPermission)}
              <span className="ml-2 text-sm">{getPermissionText(micPermission)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Device Selection */}
      {(devices.videoDevices.length > 1 || devices.audioDevices.length > 1) && (
        <div className="bg-gray-800 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Device Selection
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.videoDevices.length > 1 && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Camera</label>
                <select
                  value={selectedVideoDevice}
                  onChange={(e) => setSelectedVideoDevice(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={!!stream}
                >
                  {devices.videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {devices.audioDevices.length > 1 && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Microphone</label>
                <select
                  value={selectedAudioDevice}
                  onChange={(e) => setSelectedAudioDevice(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={!!stream}
                >
                  {devices.audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Preview */}
      <div className="bg-gray-800 p-4 rounded-lg mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Camera Preview</h3>
          {stream && (
            <div className="flex space-x-2">
              <button
                onClick={toggleVideo}
                className={`p-2 rounded-lg transition-colors ${
                  isVideoEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoEnabled ? <Camera size={20} /> : <VideoOff size={20} />}
              </button>
              <button
                onClick={toggleAudio}
                className={`p-2 rounded-lg transition-colors ${
                  isAudioEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
                title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {isAudioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full aspect-video bg-gray-900 rounded-lg border-2 border-gray-700"
          />
          
          {!stream && (
            <div className="absolute inset-0 bg-gray-900 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Camera className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">Camera preview will appear here</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-75 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-white">Initializing camera...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center space-x-4">
        {!stream ? (
          <button
            onClick={startCamera}
            disabled={loading}
            className={`px-8 py-3 rounded-lg font-semibold transition-all ${
              loading 
                ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                : 'bg-purple-600 hover:bg-purple-700 transform hover:scale-105'
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2 inline-block"></div>
                Starting Camera...
              </>
            ) : (
              <>
                <Camera className="h-5 w-5 mr-2 inline" />
                Start Camera Test
              </>
            )}
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-semibold transition-all transform hover:scale-105"
          >
            Stop Camera
          </button>
        )}

        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all"
        >
          <RefreshCw className="h-5 w-5 mr-2 inline" />
          Refresh
        </button>
      </div>

      {/* Device Information */}
      {stream && (
        <div className="mt-6 bg-gray-800 p-4 rounded-lg">
          <h3 className="font-semibold mb-3">Stream Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Video Tracks:</div>
              <div>{stream.getVideoTracks().length}</div>
            </div>
            <div>
              <div className="text-gray-400">Audio Tracks:</div>
              <div>{stream.getAudioTracks().length}</div>
            </div>
            {stream.getVideoTracks()[0] && (
              <>
                <div>
                  <div className="text-gray-400">Video Device:</div>
                  <div>{stream.getVideoTracks()[0].label || 'Unknown Camera'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Video State:</div>
                  <div className={stream.getVideoTracks()[0].enabled ? 'text-green-400' : 'text-red-400'}>
                    {stream.getVideoTracks()[0].enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </>
            )}
            {stream.getAudioTracks()[0] && (
              <>
                <div>
                  <div className="text-gray-400">Audio Device:</div>
                  <div>{stream.getAudioTracks()[0].label || 'Unknown Microphone'}</div>
                </div>
                <div>
                  <div className="text-gray-400">Audio State:</div>
                  <div className={stream.getAudioTracks()[0].enabled ? 'text-green-400' : 'text-red-400'}>
                    {stream.getAudioTracks()[0].enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Troubleshooting Tips */}
      <div className="mt-6 bg-gray-800 p-4 rounded-lg">
        <h3 className="font-semibold mb-3">💡 Troubleshooting Tips</h3>
        <ul className="text-sm text-gray-300 space-y-2">
          <li>• Make sure your camera and microphone are connected and not being used by other apps</li>
          <li>• Click the camera icon in your browser's address bar to manage permissions</li>
          <li>• Try refreshing the page if you're having issues</li>
          <li>• Use Chrome, Firefox, Safari, or Edge for best compatibility</li>
          <li>• Make sure you're using HTTPS (secure connection)</li>
          <li>• Close other video apps like Zoom, Skype, or Teams before testing</li>
        </ul>
      </div>
    </div>
  );
};

export default CameraTest;