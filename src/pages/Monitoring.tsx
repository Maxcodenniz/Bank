import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { Users, Clock, Maximize2, Minimize2, Phone, Check, X, RefreshCw, Radio, Activity, AlertCircle, TrendingUp, Eye, Filter, Volume2, VolumeX } from 'lucide-react';
import AgoraPlayer from '../components/AgoraPlayer';
import { generateToken } from '../lib/agoraClient';

const Monitoring: React.FC = () => {
  const { userProfile } = useStore();
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [callbackRequests, setCallbackRequests] = useState<any[]>([]);
  const [allCallbackRequests, setAllCallbackRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStream, setExpandedStream] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'streams' | 'callbacks'>('streams');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [streamVolumes, setStreamVolumes] = useState<{ [eventId: string]: number }>({});
  const [streamMuted, setStreamMuted] = useState<{ [eventId: string]: boolean }>({});

  useEffect(() => {
    const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
    if (isAdmin) {
      fetchLiveEvents();
      fetchCallbackRequests();
      const interval = setInterval(() => {
        fetchLiveEvents();
        fetchCallbackRequests();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [userProfile]);

  const fetchLiveEvents = async () => {
    try {
      // First, cleanup stale streams using enhanced cleanup with broadcaster tracking
      try {
        const { data: cleanupData, error: cleanupError } = await supabase.rpc('cleanup_stale_live_streams_v2', {
          stale_minutes: 5,
          broadcaster_timeout_minutes: 3
        });

        if (cleanupError) {
          console.warn('Error cleaning up stale streams:', cleanupError);
        } else if (cleanupData && cleanupData.length > 0) {
          console.log('Cleaned up stale streams:', cleanupData);
        }
      } catch (cleanupErr) {
        console.warn('Cleanup function call failed:', cleanupErr);
      }

      // Fetch live events
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          profiles:artist_id (
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('status', 'live')
        .order('start_time', { ascending: false });

      if (error) throw error;

      console.log('Fetched live events:', data);
      setLiveEvents(data || []);
    } catch (err) {
      console.error('Error fetching live events:', err);
      setError('Failed to fetch live events');
    } finally {
      setLoading(false);
    }
  };

  const fetchCallbackRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('callback_requests')
        .select('id, phone_number, email, description, user_id, status, created_at, completed_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const requests = data || [];
      console.log('📋 Fetched callback requests:', requests);
      console.log('📋 Sample request with description:', requests.find(r => r.description));
      setAllCallbackRequests(requests);
      applyStatusFilter(requests, statusFilter);
    } catch (err) {
      console.error('Error fetching callback requests:', err);
    }
  };

  const applyStatusFilter = (requests: any[], filter: 'all' | 'pending' | 'completed' | 'failed') => {
    if (filter === 'all') {
      setCallbackRequests(requests);
    } else {
      setCallbackRequests(requests.filter(r => r.status === filter));
    }
  };

  useEffect(() => {
    if (allCallbackRequests.length > 0) {
      applyStatusFilter(allCallbackRequests, statusFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleCallbackStatus = async (requestId: string, status: 'completed' | 'failed') => {
    try {
      const { error } = await supabase
        .from('callback_requests')
        .update({ 
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', requestId);

      if (error) throw error;
      await fetchCallbackRequests();
    } catch (err) {
      console.error('Error updating callback status:', err);
      setError('Failed to update callback status');
    }
  };

  const calculateDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  // ✅ FIXED: Proper admin access check
  // Allow both global_admin and super_admin
  const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
  if (!userProfile || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 border border-red-500/30 shadow-2xl max-w-md text-center relative z-10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center border-4 border-red-500/30">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            Access Denied
          </h2>
          <p className="text-gray-400 text-lg">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  const pendingCallbacks = callbackRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-24 px-6 relative overflow-x-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto relative z-10">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent mb-2 flex items-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mr-3 shadow-xl shadow-purple-500/30">
                  <Activity className="w-7 h-7 text-white" />
                </div>
                Monitoring Dashboard
              </h1>
              <p className="text-gray-400 text-lg mt-2">Real-time monitoring of live streams and callback requests</p>
            </div>
            
            {/* Stats Cards */}
            <div className="flex gap-4">
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl px-6 py-4 rounded-2xl border border-purple-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Live Streams</p>
                    <p className="text-2xl font-bold text-white">{liveEvents.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-xl px-6 py-4 rounded-2xl border border-blue-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Pending</p>
                    <p className="text-2xl font-bold text-white">{pendingCallbacks}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-3">
            <button
              onClick={() => setActiveTab('streams')}
              className={`px-6 py-3 rounded-xl transition-all duration-300 font-bold flex items-center gap-2 ${
                activeTab === 'streams'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Radio className="w-5 h-5" />
              Live Streams
              <span className={`px-2 py-1 rounded-lg text-xs ${
                activeTab === 'streams'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}>
                {liveEvents.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('callbacks')}
              className={`px-6 py-3 rounded-xl transition-all duration-300 font-bold flex items-center gap-2 ${
                activeTab === 'callbacks'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-xl shadow-blue-500/30'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
              }`}
            >
              <Phone className="w-5 h-5" />
              Callback Requests
              {pendingCallbacks > 0 && (
                <span className={`px-2 py-1 rounded-lg text-xs ${
                  activeTab === 'callbacks'
                    ? 'bg-white/20 text-white'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {pendingCallbacks}
                </span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl mb-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

        {activeTab === 'streams' ? (
          loading ? (
            <div className="flex flex-col justify-center items-center py-16">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
              </div>
              <p className="mt-6 text-gray-400 font-medium">Loading live streams...</p>
            </div>
          ) : liveEvents.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 max-w-md mx-auto border border-white/10 shadow-2xl">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Radio className="w-10 h-10 text-purple-400" />
                </div>
                <p className="text-gray-300 text-xl font-semibold mb-2">No active streams at the moment</p>
                <p className="text-gray-500 text-sm mb-6">
                  Streams will appear here when artists go live
                </p>
                <button
                  onClick={() => {
                    setLoading(true);
                    fetchLiveEvents();
                  }}
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white px-8 py-3 rounded-2xl font-bold hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-purple-500/50 inline-flex items-center"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {liveEvents.map((event) => (
                <div
                  key={event.id}
                  className={`bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl transition-all duration-300 hover:shadow-purple-500/20 ${
                    expandedStream === event.id ? 'xl:col-span-2' : ''
                  }`}
                >
                  {/* Stream Header */}
                  <div className="p-6 border-b border-white/10 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                          <h3 className="text-2xl font-bold text-white">{event.title}</h3>
                        </div>
                        <p className="text-gray-400 text-sm">{event.description || 'Live streaming event'}</p>
                      </div>
                      <button
                        onClick={() => setExpandedStream(
                          expandedStream === event.id ? null : event.id
                        )}
                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-purple-400 transition-all duration-300 flex items-center justify-center group"
                        title={expandedStream === event.id ? "Minimize" : "Expand"}
                      >
                        {expandedStream === event.id ? (
                          <Minimize2 size={20} className="group-hover:scale-110 transition-transform" />
                        ) : (
                          <Maximize2 size={20} className="group-hover:scale-110 transition-transform" />
                        )}
                      </button>
                    </div>
                    
                    {/* Stream Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-purple-400" />
                          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Duration</span>
                        </div>
                        <p className="text-lg font-bold text-white">{calculateDuration(event.start_time)}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <Eye className="h-4 w-4 text-blue-400" />
                          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Viewers</span>
                        </div>
                        <p className="text-lg font-bold text-white">{event.viewer_count || 0}</p>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-4 w-4 text-pink-400" />
                          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Artist</span>
                        </div>
                        <p className="text-sm font-bold text-white truncate">{event.profiles?.full_name || 'Unknown Artist'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Video Player */}
                  <div className={`aspect-video bg-black relative ${
                    expandedStream === event.id ? 'h-[600px]' : 'h-[300px]'
                  }`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent z-10 pointer-events-none"></div>
                    <AgoraPlayer
                      channelName={`event_${event.id}`}
                      generateTokenFn={generateToken}
                      onVideoContainerReady={(container) => {
                        // Initialize volume for this stream
                        if (container) {
                          const volume = streamVolumes[event.id] ?? 100;
                          const isMuted = streamMuted[event.id] ?? false;
                          // Use a small delay to ensure player is ready
                          setTimeout(() => {
                            if ((window as any).agoraPlayer) {
                              (window as any).agoraPlayer.setVolume(volume);
                              if (isMuted) {
                                (window as any).agoraPlayer.muteAudio(true);
                              }
                            }
                          }, 500);
                        }
                      }}
                    />
                    
                    {/* Volume Control */}
                    <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md rounded-xl p-3 z-20 border border-white/10">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            const isMuted = streamMuted[event.id] ?? false;
                            const newMuted = !isMuted;
                            setStreamMuted(prev => ({ ...prev, [event.id]: newMuted }));
                            // Control volume via AgoraPlayer's exposed API
                            if ((window as any).agoraPlayer) {
                              (window as any).agoraPlayer.muteAudio(newMuted);
                            }
                          }}
                          className="text-white hover:text-purple-400 transition-colors"
                          title={streamMuted[event.id] ? "Unmute" : "Mute"}
                        >
                          {streamMuted[event.id] ? (
                            <VolumeX className="w-5 h-5" />
                          ) : (
                            <Volume2 className="w-5 h-5" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={streamVolumes[event.id] ?? 100}
                          onChange={(e) => {
                            const volume = parseInt(e.target.value);
                            setStreamVolumes(prev => ({ ...prev, [event.id]: volume }));
                            if ((window as any).agoraPlayer) {
                              (window as any).agoraPlayer.setVolume(volume);
                            }
                            if (volume > 0 && streamMuted[event.id]) {
                              setStreamMuted(prev => ({ ...prev, [event.id]: false }));
                              if ((window as any).agoraPlayer) {
                                (window as any).agoraPlayer.muteAudio(false);
                              }
                            }
                          }}
                          className="w-24 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <span className="text-white text-xs font-semibold min-w-[3rem]">
                          {streamVolumes[event.id] ?? 100}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/50 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-blue-400" />
                  </div>
                  Callback Requests
                </h2>
                <div className="flex items-center gap-3">
                  {/* Status Filter */}
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1">
                    <Filter className="w-4 h-4 text-gray-400 ml-2" />
                    <button
                      onClick={() => setStatusFilter('all')}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        statusFilter === 'all'
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setStatusFilter('pending')}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        statusFilter === 'pending'
                          ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => setStatusFilter('completed')}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        statusFilter === 'completed'
                          ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Completed
                    </button>
                  </div>
                  <button
                    onClick={fetchCallbackRequests}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-300 flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>
              </div>
              
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="text-left border-b border-white/10">
                      <th className="pb-4 text-gray-400 font-semibold uppercase tracking-wider text-sm">Phone Number</th>
                      <th className="pb-4 text-gray-400 font-semibold uppercase tracking-wider text-sm">Email</th>
                      <th className="pb-4 text-gray-400 font-semibold uppercase tracking-wider text-sm">Description</th>
                      <th className="pb-4 text-gray-400 font-semibold uppercase tracking-wider text-sm">User</th>
                      <th className="pb-4 text-gray-400 font-semibold uppercase tracking-wider text-sm">Requested</th>
                      <th className="pb-4 text-gray-400 font-semibold uppercase tracking-wider text-sm">Status</th>
                      <th className="pb-4 text-gray-400 font-semibold uppercase tracking-wider text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {callbackRequests.map((request) => (
                      <tr key={request.id} className="text-gray-300 hover:bg-white/5 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                              <Phone className="h-5 w-5 text-blue-400" />
                            </div>
                            <span className="font-medium text-white">{request.phone_number}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className="text-sm text-gray-300">{request.email || 'N/A'}</span>
                        </td>
                        <td className="py-4 max-w-md">
                          {request.description && request.description.trim() ? (
                            <div 
                              className="text-sm text-gray-300 line-clamp-2 cursor-help hover:text-white transition-colors" 
                              title={request.description}
                            >
                              {request.description.trim()}
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500 italic">No description provided</span>
                          )}
                        </td>
                        <td className="py-4">
                          {request.user_id ? (
                            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 border border-purple-500/30">
                              Registered User
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-gray-500/20 to-gray-600/20 text-gray-400 border border-gray-500/30">
                              Anonymous
                            </span>
                          )}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">{new Date(request.created_at).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                            request.status === 'pending'
                              ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30'
                              : request.status === 'completed'
                              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                              : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-4">
                          {request.status === 'pending' && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleCallbackStatus(request.id, 'completed')}
                                className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400 hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-300 flex items-center justify-center group"
                                title="Mark as Completed"
                              >
                                <Check size={18} className="group-hover:scale-110 transition-transform" />
                              </button>
                              <button
                                onClick={() => handleCallbackStatus(request.id, 'failed')}
                                className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 text-red-400 hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-300 flex items-center justify-center group"
                                title="Mark as Failed"
                              >
                                <X size={18} className="group-hover:scale-110 transition-transform" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {callbackRequests.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                    <Phone className="w-10 h-10 text-blue-400" />
                  </div>
                  <p className="text-gray-300 text-lg font-semibold mb-2">No callback requests yet</p>
                  <p className="text-gray-500 text-sm">Callback requests will appear here when users request callbacks</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Monitoring;