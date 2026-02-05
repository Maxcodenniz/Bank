import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { Video, Play, Download, Trash2, Calendar, Clock, User, FileVideo, AlertCircle, CheckCircle, XCircle, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Recording {
  id: string;
  event_id: string;
  artist_id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  file_size: number | null;
  recording_started_at: string;
  recording_ended_at: string | null;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  events?: {
    id: string;
    title: string;
    start_time: string;
  };
  profiles?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string;
  };
}

const RecordingsManagement: React.FC = () => {
  const { userProfile } = useStore();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'recording' | 'processing' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [artistRecordingsVisible, setArtistRecordingsVisible] = useState(true);

  useEffect(() => {
    // Check if artist recordings are visible for artists
    const checkRecordingsVisibility = async () => {
      if (userProfile?.user_type === 'artist') {
        try {
          const { data, error } = await supabase
            .from('app_config')
            .select('key, value')
            .eq('key', 'artist_recordings_visible')
            .single();

          if (!error && data) {
            const isVisible = data.value === true || data.value === 'true';
            setArtistRecordingsVisible(isVisible);
            if (!isVisible) {
              setError('Recordings access is currently disabled.');
              return;
            }
          }
        } catch (err) {
          console.error('Error checking recordings visibility:', err);
        }
      } else {
        setArtistRecordingsVisible(true);
      }
    };

    checkRecordingsVisibility();
  }, [userProfile]);

  useEffect(() => {
    if ((userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin' || (userProfile?.user_type === 'artist' && artistRecordingsVisible)) && artistRecordingsVisible) {
      fetchRecordings();
      
      // Refresh every 30 seconds to update status
      const interval = setInterval(() => {
        fetchRecordings();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [userProfile, filter, artistRecordingsVisible]);

  const fetchRecordings = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('recordings')
        .select(`
          *,
          events (
            id,
            title,
            start_time
          ),
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false });

      // If user is an artist, only show their own recordings
      if (userProfile?.user_type === 'artist') {
        query = query.eq('artist_id', userProfile.id);
      }

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setRecordings(data || []);
    } catch (err: any) {
      console.error('Error fetching recordings:', err);
      setError('Failed to fetch recordings. ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const deleteRecording = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('recordings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRecordings(prev => prev.filter(r => r.id !== id));
      setSuccess('Recording deleted successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting recording:', err);
      setError('Failed to delete recording. ' + (err.message || ''));
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'recording':
        return <Loader className="w-4 h-4 text-red-400 animate-spin" />;
      case 'processing':
        return <Loader className="w-4 h-4 text-yellow-400 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'recording':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'processing':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const filteredRecordings = recordings.filter(recording => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        recording.title.toLowerCase().includes(query) ||
        recording.description?.toLowerCase().includes(query) ||
        recording.events?.title.toLowerCase().includes(query) ||
        recording.profiles?.username?.toLowerCase().includes(query) ||
        recording.profiles?.full_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (userProfile?.user_type !== 'global_admin' && userProfile?.user_type !== 'super_admin' && userProfile?.user_type !== 'artist') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center p-6">
        <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 max-w-md mx-auto border border-white/10 shadow-2xl text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You need admin or artist privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
              <FileVideo className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                {userProfile?.user_type === 'artist' ? 'My Recordings' : 'Recordings Management'}
              </h1>
              <p className="text-gray-400 mt-1">
                {userProfile?.user_type === 'artist' 
                  ? 'View and manage your live stream recordings' 
                  : 'Manage and monitor all live stream recordings'}
              </p>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 text-red-300 px-6 py-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-500/20 border border-green-500/50 text-green-300 px-6 py-4 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <p>{success}</p>
            <button onClick={() => setSuccess(null)} className="ml-auto">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Filters and Search */}
        <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-xl mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search recordings by title, artist, or event..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>

            {/* Status Filter */}
            <div className="flex flex-wrap gap-2">
              {(['all', 'recording', 'processing', 'completed', 'failed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                    filter === status
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Recordings Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
              <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
            </div>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/10 shadow-2xl">
            <Video className="w-20 h-20 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Recordings Found</h3>
            <p className="text-gray-400">
              {searchQuery ? 'Try adjusting your search query.' : 'No recordings match the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecordings.map((recording) => (
              <div
                key={recording.id}
                className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
              >
                {/* Video Thumbnail/Preview */}
                <div className="relative h-48 bg-gray-900">
                  {recording.video_url && recording.status === 'completed' ? (
                    <video
                      src={recording.video_url}
                      className="w-full h-full object-cover"
                      muted
                      onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLVideoElement).pause();
                        (e.currentTarget as HTMLVideoElement).currentTime = 0;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                      <Video className="w-16 h-16 text-gray-600" />
                    </div>
                  )}
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <div className={`px-3 py-1 rounded-full border flex items-center gap-2 ${getStatusColor(recording.status)}`}>
                      {getStatusIcon(recording.status)}
                      <span className="text-xs font-semibold capitalize">{recording.status}</span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <h3 className="font-bold text-lg text-white mb-2 line-clamp-2">{recording.title}</h3>
                  
                  {recording.description && (
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{recording.description}</p>
                  )}

                  {/* Metadata */}
                  <div className="space-y-2 mb-4">
                    {recording.events && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span className="truncate">{recording.events.title}</span>
                      </div>
                    )}
                    
                    {recording.profiles && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <User className="w-4 h-4" />
                        <span>{recording.profiles.full_name || recording.profiles.username}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {recording.duration && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(recording.duration)}</span>
                        </div>
                      )}
                      {recording.file_size && (
                        <div className="flex items-center gap-1">
                          <FileVideo className="w-3 h-3" />
                          <span>{formatFileSize(recording.file_size)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {recording.video_url && recording.status === 'completed' && (
                      <>
                        <a
                          href={recording.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-white text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Play
                        </a>
                        <a
                          href={recording.video_url}
                          download
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white text-sm font-semibold transition-all duration-300 flex items-center justify-center"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </>
                    )}
                    {(userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin' || recording.artist_id === userProfile?.id) && (
                      <button
                        onClick={() => deleteRecording(recording.id)}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 hover:text-red-300 text-sm font-semibold transition-all duration-300 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && recordings.length > 0 && (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <p className="text-gray-400 text-sm mb-1">Total</p>
              <p className="text-2xl font-bold text-white">{recordings.length}</p>
            </div>
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <p className="text-gray-400 text-sm mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-400">
                {recordings.filter(r => r.status === 'completed').length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <p className="text-gray-400 text-sm mb-1">Processing</p>
              <p className="text-2xl font-bold text-yellow-400">
                {recordings.filter(r => r.status === 'processing' || r.status === 'recording').length}
              </p>
            </div>
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-xl p-4 border border-white/10">
              <p className="text-gray-400 text-sm mb-1">Failed</p>
              <p className="text-2xl font-bold text-red-400">
                {recordings.filter(r => r.status === 'failed').length}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingsManagement;


