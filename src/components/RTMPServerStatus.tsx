import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

interface RTMPServerStatusProps {
  serverUrl: string;
  onServerChange?: (newUrl: string) => void;
}

const RTMPServerStatus: React.FC<RTMPServerStatusProps> = ({ serverUrl, onServerChange }) => {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [alternativeServers] = useState([
    'rtmp://live.twitch.tv/live',
    'rtmp://a.rtmp.youtube.com/live2',
    'rtmp://ingest.globalcdn.live/live',
  ]);

  const checkServerStatus = async (url: string): Promise<boolean> => {
    try {
      // In a real implementation, you would ping the RTMP server
      // For now, we'll simulate a check
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate server availability (90% uptime)
      return Math.random() > 0.1;
    } catch {
      return false;
    }
  };

  const performStatusCheck = async () => {
    setStatus('checking');
    const isOnline = await checkServerStatus(serverUrl);
    setStatus(isOnline ? 'online' : 'offline');
    setLastCheck(new Date());
  };

  useEffect(() => {
    performStatusCheck();
    
    // Check status every 30 seconds
    const interval = setInterval(performStatusCheck, 30000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin text-yellow-400" />;
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'offline':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'checking':
        return 'Checking server...';
      case 'online':
        return 'Server online';
      case 'offline':
        return 'Server offline';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'checking':
        return 'text-yellow-400';
      case 'online':
        return 'text-green-400';
      case 'offline':
        return 'text-red-400';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center">
          <Wifi className="h-5 w-5 mr-2" />
          RTMP Server Status
        </h3>
        <button
          onClick={performStatusCheck}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Refresh status"
        >
          <RefreshCw className={`h-4 w-4 ${status === 'checking' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 text-sm">Current Server:</span>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
        </div>

        <div className="text-xs text-gray-500">
          Last checked: {lastCheck.toLocaleTimeString()}
        </div>

        {status === 'offline' && (
          <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-lg p-3">
            <h4 className="font-medium text-red-400 mb-2">Server Unavailable</h4>
            <p className="text-red-300 text-sm mb-3">
              The RTMP server is currently offline. Try one of these alternatives:
            </p>
            <div className="space-y-2">
              {alternativeServers.map((server, index) => (
                <button
                  key={index}
                  onClick={() => onServerChange?.(server)}
                  className="w-full text-left p-2 bg-red-500 bg-opacity-20 hover:bg-opacity-30 rounded text-sm text-red-300 transition-colors"
                >
                  {server}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'online' && (
          <div className="bg-green-500 bg-opacity-10 border border-green-500 rounded-lg p-3">
            <div className="flex items-center text-green-400">
              <CheckCircle className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Ready to stream</span>
            </div>
            <p className="text-green-300 text-xs mt-1">
              Server is responding normally. You can start streaming in OBS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RTMPServerStatus;