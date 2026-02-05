import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { Concert } from '../types';
import { Users, MessageCircle, Wifi, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import AgoraPlayer from './AgoraPlayer';

interface StreamViewerProps {
  concert: Concert;
}

const StreamViewer: React.FC<StreamViewerProps> = ({ concert }) => {
  const { user } = useStore();
  const [messages, setMessages] = useState<Array<{ id: string; text: string; user: string; timestamp: Date }>>([]);
  const [messageInput, setMessageInput] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamData, setStreamData] = useState<{
    channelName: string;
    appId: string;
    token: string | null;
    status: string;
  }>({
    channelName: '',
    appId: '',
    token: null,
    status: 'offline'
  });
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchStreamInfo();
    const interval = setInterval(fetchStreamInfo, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [concert.id]);

  const fetchStreamInfo = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('stream_url, viewer_count, status')
        .eq('id', concert.id)
        .single();

      if (eventError) throw eventError;

      if (eventData) {
        const channelName = `event_${concert.id}`;
        const appId = import.meta.env.VITE_AGORA_APP_ID || '';
        
        // Get token from Supabase Edge Function
        let token = null;
        if (eventData.status === 'live') {
          try {
            const { data: tokenData, error: tokenError } = await supabase.functions.invoke('generate-agora-token', {
              body: { 
                channelName,
                uid: Math.floor(Math.random() * 1000000).toString()
              }
            });
            
            if (!tokenError && tokenData?.token) {
              token = tokenData.token;
            }
          } catch (tokenErr) {
            console.error('Error getting Agora token:', tokenErr);
          }
        }
        
        setStreamData({
          channelName,
          appId,
          token,
          status: eventData.status || 'offline'
        });
        setViewerCount(eventData.viewer_count || 0);
        setLastUpdate(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching stream info:', err);
      setError('Failed to load stream information');
    }
  };

  const handleViewerJoin = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('viewer_count')
        .eq('id', concert.id)
        .single();

      if (error) throw error;

      const newCount = (data.viewer_count || 0) + 1;
      await supabase
        .from('events')
        .update({ viewer_count: newCount })
        .eq('id', concert.id);

      setViewerCount(newCount);
    } catch (err) {
      console.error('Error updating viewer count:', err);
    }
  };

  const handleViewerLeave = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('viewer_count')
        .eq('id', concert.id)
        .single();

      if (error) throw error;

      const newCount = Math.max(0, (data.viewer_count || 0) - 1);
      await supabase
        .from('events')
        .update({ viewer_count: newCount })
        .eq('id', concert.id);

      setViewerCount(newCount);
    } catch (err) {
      console.error('Error updating viewer count:', err);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !user) return;

    const newMessage = {
      id: Date.now().toString(),
      text: messageInput.trim(),
      user: user.email?.split('@')[0] || 'Anonymous',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage].slice(-100)); // Keep last 100 messages
    setMessageInput('');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getStreamDisplay = () => {
    if (streamData.status === 'offline' || !streamData.appId) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <div className="mb-4">
              <Wifi className="h-16 w-16 text-gray-500 mx-auto mb-4" />
            </div>
            <h3 className="text-xl text-white mb-2">Stream Offline</h3>
            <p className="text-gray-400 mb-4">
              The artist hasn't started streaming yet.
            </p>
            <button
              onClick={fetchStreamInfo}
              className="flex items-center mx-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <RefreshCw size={16} className="mr-2" />
              Check Again
            </button>
          </div>
        </div>
      );
    }

    if (streamData.status === 'live' && streamData.appId) {
      return (
        <AgoraPlayer
          channelName={streamData.channelName}
          appId={streamData.appId}
          token={streamData.token || undefined}
          onViewerJoin={handleViewerJoin}
          onViewerLeave={handleViewerLeave}
        />
      );
    }

    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-pulse mb-4">
            <div className="h-16 w-16 bg-gray-700 rounded-full mx-auto mb-4"></div>
          </div>
          <p className="text-white text-xl">Connecting to stream...</p>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-6rem)]">
      {/* Main Stream Area */}
      <div className="lg:col-span-3 bg-black rounded-lg overflow-hidden relative">
        <div className="aspect-video bg-gray-900 relative">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={fetchStreamInfo}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            getStreamDisplay()
          )}
        </div>

        {/* Stream Info Bar */}
        <div className="bg-gray-800 p-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${
              streamData.status === 'live' ? 'text-green-400' : 'text-gray-400'
            }`}>
              <div className={`h-2 w-2 rounded-full mr-2 ${
                streamData.status === 'live' ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
              }`}></div>
              <span className="text-sm font-medium">
                {streamData.status === 'live' ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            
            <div className="flex items-center text-gray-300">
              <Users className="h-4 w-4 mr-1" />
              <span className="text-sm">{viewerCount.toLocaleString()} viewers</span>
            </div>

            {streamData.status === 'live' && (
              <div className="text-xs text-blue-400 bg-blue-400/10 px-2 py-1 rounded flex items-center">
                <span className="h-2 w-2 bg-blue-400 rounded-full mr-1 animate-pulse"></span>
                Powered by Agora
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <div className="text-xs text-gray-500">
              Last updated: {formatTime(lastUpdate)}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Section */}
      <div className="bg-gray-900 rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-white">
            <MessageCircle className="h-5 w-5 mr-2" />
            <span className="font-semibold">Live Chat</span>
          </div>
          <div className="text-xs text-gray-400">
            {messages.length} messages
          </div>
        </div>

        {/* Stream Status in Chat */}
        <div className="bg-gray-800 p-3 rounded-lg mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Stream Status</span>
            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
              streamData.status === 'live' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-gray-700 text-gray-400'
            }`}>
              {streamData.status === 'live' ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {streamData.status === 'live' 
              ? `${viewerCount.toLocaleString()} people watching`
              : 'Waiting for stream to start...'
            }
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-2 min-h-0">
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No messages yet.</p>
              <p className="text-xs">Be the first to chat!</p>
            </div>
          ) : (
            messages.map(message => (
              <div key={message.id} className="text-sm">
                <div className="flex items-baseline space-x-2">
                  <span className="text-purple-400 font-medium text-xs">
                    {message.user}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="text-white mt-1 break-words">
                  {message.text}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat Input */}
        {user ? (
          <form onSubmit={sendMessage} className="mt-auto">
            <div className="flex space-x-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Send a message..."
                className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                maxLength={200}
                disabled={streamData.status !== 'live'}
              />
              <button
                type="submit"
                disabled={!messageInput.trim() || streamData.status !== 'live'}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Send
              </button>
            </div>
            {streamData.status !== 'live' && (
              <p className="text-xs text-gray-500 mt-1">
                Chat will be enabled when the stream goes live
              </p>
            )}
          </form>
        ) : (
          <div className="mt-auto bg-gray-800 p-3 rounded-lg text-center">
            <p className="text-gray-400 text-sm">Sign in to join the chat</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamViewer;