import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { Link as RouterLink } from 'react-router-dom';
import { 
  Search, 
  Edit, 
  Save, 
  X, 
  Upload, 
  Video, 
  Trash2,
  Eye,
  Heart,
  Users,
  Calendar,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Plus,
  Link,
  FileVideo,
  Download,
  Music,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  DollarSign,
  ExternalLink,
  MessageSquare,
  UserX,
  UserCheck
} from 'lucide-react';

interface Artist {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  genres: string[];
  country: string;
  region: string;
  artist_type: string;
  profile_views: number;
  profile_likes: number;
  total_event_views: number;
  revenue_percentage: number | null;
  suspended?: boolean;
  notification_preference?: string;
}

interface VideoRecord {
  id: string;
  event_id: string;
  title: string;
  video_url: string;
  video_type: 'upload' | 'url';
  duration?: number;
  file_size?: number;
  thumbnail_url?: string;
  created_at: string;
  order_index: number;
}

interface Event {
  id: string;
  title: string;
  description: string;
  start_time: string;
  image_url: string;
  viewer_count: number;
  status: string;
  videos?: VideoRecord[];
}

interface VideoPlayerProps {
  video: VideoRecord;
  onClose: () => void;
}

// Enhanced Video Player Component
const VideoPlayer: React.FC<VideoPlayerProps> = ({ video, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => setVolume(video.volume);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newTime = parseFloat(e.target.value);
    video.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!isFullscreen) {
      video.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative w-full max-w-4xl mx-4">
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 text-white hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-300 flex items-center justify-center group z-10"
        >
          <X size={20} className="group-hover:scale-110 transition-transform" />
        </button>

        <div className="relative bg-gradient-to-br from-gray-900/95 to-black/95 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <video
            ref={videoRef}
            src={video.video_url}
            className="w-full max-h-[70vh] object-contain"
            poster={video.thumbnail_url}
            onClick={togglePlay}
          />

          {/* Video Controls */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-6">
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
                style={{
                  background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(currentTime / (duration || 1)) * 100}%, rgba(75, 85, 99, 0.5) ${(currentTime / (duration || 1)) * 100}%, rgba(75, 85, 99, 0.5) 100%)`
                }}
              />
            </div>

            <div className="flex items-center justify-between text-white">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={togglePlay} 
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all duration-300 group"
                >
                  {isPlaying ? <Pause size={20} className="group-hover:scale-110 transition-transform" /> : <Play size={20} className="group-hover:scale-110 transition-transform" />}
                </button>

                <div className="flex items-center space-x-3">
                  <button 
                    onClick={toggleMute} 
                    className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all duration-300 group"
                  >
                    {isMuted ? <VolumeX size={20} className="group-hover:scale-110 transition-transform" /> : <Volume2 size={20} className="group-hover:scale-110 transition-transform" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-2 bg-gray-700/50 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                <span className="text-sm font-semibold bg-white/10 px-3 py-1.5 rounded-lg">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-sm font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">{video.title}</span>
                <button 
                  onClick={toggleFullscreen} 
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all duration-300 group"
                >
                  <Maximize size={20} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ArtistManagement: React.FC = () => {
  const { userProfile } = useStore();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [artistEvents, setArtistEvents] = useState<Event[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [uploadingVideos, setUploadingVideos] = useState<Set<string>>(new Set());
  const [selectedVideo, setSelectedVideo] = useState<VideoRecord | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [newVideoUrls, setNewVideoUrls] = useState<string[]>(['']);
  const [newVideoTitles, setNewVideoTitles] = useState<string[]>(['']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingRevenuePercentage, setEditingRevenuePercentage] = useState<string | null>(null);
  const [revenuePercentageValue, setRevenuePercentageValue] = useState<string>('');
  const [savingRevenuePercentage, setSavingRevenuePercentage] = useState(false);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [communicationEnabled, setCommunicationEnabled] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Artist>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const profileFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchArtists();
  }, []);

  useEffect(() => {
    if (selectedArtist) {
      fetchArtistEvents(selectedArtist.id);
      fetchFollowersCount(selectedArtist.id);
    } else {
      setFollowersCount(0);
    }
  }, [selectedArtist]);

  useEffect(() => {
    const fetchCommunicationConfig = async () => {
      const { data } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'artist_management_communication_enabled')
        .maybeSingle();
      const enabled = data?.value === true || data?.value === 'true';
      setCommunicationEnabled(enabled);
    };
    fetchCommunicationConfig();
  }, []);

  const fetchArtists = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'artist')
        .order('full_name');

      if (error) throw error;
      setArtists(data || []);
    } catch (err) {
      console.error('Error fetching artists:', err);
      setError('Failed to fetch artists');
    } finally {
      setLoading(false);
    }
  };

  const fetchArtistEvents = async (artistId: string) => {
    try {
      // First fetch events
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('artist_id', artistId)
        .order('start_time', { ascending: false });

      if (eventsError) throw eventsError;

      // Then fetch videos for each event
      const eventsWithVideos = await Promise.all(
        (events || []).map(async (event) => {
          const { data: videos, error: videosError } = await supabase
            .from('event_videos')
            .select('*')
            .eq('event_id', event.id)
            .order('order_index');

          if (videosError) {
            console.error('Error fetching videos for event:', event.id, videosError);
            return { ...event, videos: [] };
          }

          return { ...event, videos: videos || [] };
        })
      );

      setArtistEvents(eventsWithVideos);
    } catch (err) {
      console.error('Error fetching artist events:', err);
    }
  };

  const fetchFollowersCount = async (artistId: string) => {
    try {
      const { count, error } = await supabase
        .from('favorite_artists')
        .select('*', { count: 'exact', head: true })
        .eq('artist_id', artistId);
      if (error) throw error;
      setFollowersCount(count ?? 0);
    } catch (err) {
      console.error('Error fetching followers count:', err);
      setFollowersCount(0);
    }
  };

  const addVideoUrl = () => {
    setNewVideoUrls([...newVideoUrls, '']);
    setNewVideoTitles([...newVideoTitles, '']);
  };

  const removeVideoUrl = (index: number) => {
    const urls = newVideoUrls.filter((_, i) => i !== index);
    const titles = newVideoTitles.filter((_, i) => i !== index);
    setNewVideoUrls(urls);
    setNewVideoTitles(titles);
  };

  const updateVideoUrl = (index: number, url: string) => {
    const urls = [...newVideoUrls];
    urls[index] = url;
    setNewVideoUrls(urls);
  };

  const updateVideoTitle = (index: number, title: string) => {
    const titles = [...newVideoTitles];
    titles[index] = title;
    setNewVideoTitles(titles);
  };

  const saveEventVideos = async (eventId: string) => {
    try {
      const validVideos = newVideoUrls
        .map((url, index) => ({ url: url.trim(), title: newVideoTitles[index].trim() }))
        .filter(video => video.url && video.title);

      if (validVideos.length === 0) {
        setError('Please provide at least one valid video URL and title');
        return;
      }

      // Get current max order index for this event
      const { data: existingVideos } = await supabase
        .from('event_videos')
        .select('order_index')
        .eq('event_id', eventId)
        .order('order_index', { ascending: false })
        .limit(1);

      const startOrderIndex = existingVideos && existingVideos.length > 0 
        ? existingVideos[0].order_index + 1 
        : 0;

      // Insert videos into database with created_by field
      const videoRecords = validVideos.map((video, index) => ({
        event_id: eventId,
        title: video.title,
        video_url: video.url,
        video_type: 'url' as const,
        order_index: startOrderIndex + index,
        created_by: userProfile?.id
      }));

      const { error } = await supabase
        .from('event_videos')
        .insert(videoRecords);

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }

      // Refresh events
      if (selectedArtist) {
        await fetchArtistEvents(selectedArtist.id);
      }

      setEditingEvent(null);
      setNewVideoUrls(['']);
      setNewVideoTitles(['']);
    } catch (err) {
      console.error('Error saving event videos:', err);
      setError(`Failed to save event videos: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const removeVideo = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('event_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      // Refresh events
      if (selectedArtist) {
        fetchArtistEvents(selectedArtist.id);
      }
    } catch (err) {
      console.error('Error removing video:', err);
      setError('Failed to remove video');
    }
  };

  const uploadVideo = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `event_videos/${userProfile?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, { 
        upsert: false,
        contentType: file.type
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const generateThumbnail = (videoFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      video.onloadeddata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        video.currentTime = 1; // Seek to 1 second for thumbnail
      };

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
              uploadThumbnail(thumbnailFile).then(resolve).catch(reject);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          }, 'image/jpeg', 0.8);
        }
      };

      video.src = URL.createObjectURL(videoFile);
      video.load();
    });
  };

  const uploadThumbnail = async (file: File): Promise<string> => {
    const fileName = `thumbnail_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = `thumbnails/${userProfile?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleMultipleVideoUpload = async (eventId: string, files: FileList) => {
    try {
      setUploadingVideos(prev => new Set([...prev, eventId]));
      setError(null);

      const validFiles = Array.from(files).filter(file => file.type.startsWith('video/'));
      
      if (validFiles.length === 0) {
        throw new Error('Please select valid video files');
      }

      // Check file sizes (limit to 100MB per file)
      const oversizedFiles = validFiles.filter(file => file.size > 100 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        throw new Error(`Some files are too large. Maximum size is 100MB per file.`);
      }

      // Get current max order index for this event
      const { data: existingVideos } = await supabase
        .from('event_videos')
        .select('order_index')
        .eq('event_id', eventId)
        .order('order_index', { ascending: false })
        .limit(1);

      const startOrderIndex = existingVideos && existingVideos.length > 0 
        ? existingVideos[0].order_index + 1 
        : 0;

      const uploadPromises = validFiles.map(async (file, index) => {
        try {
          // Upload video first
          const videoUrl = await uploadVideo(file);
          
          // Try to generate thumbnail, but don't fail if it doesn't work
          let thumbnailUrl = null;
          try {
            thumbnailUrl = await generateThumbnail(file);
          } catch (thumbError) {
            console.warn(`Failed to generate thumbnail for ${file.name}:`, thumbError);
          }

          return {
            event_id: eventId,
            title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
            video_url: videoUrl,
            video_type: 'upload' as const,
            file_size: file.size,
            thumbnail_url: thumbnailUrl,
            order_index: startOrderIndex + index,
            created_by: userProfile?.id
          };
        } catch (err) {
          console.error(`Error uploading file ${file.name}:`, err);
          throw new Error(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      });

      const videoRecords = await Promise.all(uploadPromises);

      const { error } = await supabase
        .from('event_videos')
        .insert(videoRecords);

      if (error) throw error;

      // Refresh events
      if (selectedArtist) {
        await fetchArtistEvents(selectedArtist.id);
      }

      // Show success message
      setError(null);
      console.log(`Successfully uploaded ${validFiles.length} video(s)`);
      
    } catch (err) {
      console.error('Error uploading videos:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload videos');
    } finally {
      setUploadingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const playVideo = (video: VideoRecord) => {
    setSelectedVideo(video);
    setShowVideoModal(true);
  };

  const closeVideoPlayer = () => {
    setShowVideoModal(false);
    setSelectedVideo(null);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const MB = bytes / (1024 * 1024);
    return MB >= 1000 ? `${(MB / 1024).toFixed(1)} GB` : `${MB.toFixed(1)} MB`;
  };

  const filteredArtists = artists.filter(artist =>
    artist.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    artist.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveProfile = async () => {
    if (!selectedArtist) return;
    try {
      setSavingProfile(true);
      setError(null);
      const update: Record<string, unknown> = {};
      if (editFormData.full_name !== undefined) update.full_name = editFormData.full_name;
      if (editFormData.username !== undefined) update.username = editFormData.username;
      if (editFormData.bio !== undefined) update.bio = editFormData.bio;
      if (editFormData.country !== undefined) update.country = editFormData.country || null;
      if (editFormData.region !== undefined) update.region = editFormData.region || null;
      if (editFormData.artist_type !== undefined) update.artist_type = editFormData.artist_type || null;
      if (editFormData.genres !== undefined) update.genres = editFormData.genres?.length ? editFormData.genres : null;
      if (editFormData.avatar_url !== undefined) update.avatar_url = editFormData.avatar_url || null;

      const { error: updateError } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', selectedArtist.id);

      if (updateError) throw updateError;

      const updated = { ...selectedArtist, ...editFormData };
      setArtists(prev => prev.map(a => a.id === selectedArtist.id ? updated : a));
      setSelectedArtist(updated);
      setEditingProfile(false);
      setEditFormData({});
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSuspendActivate = async (artistId: string, suspend: boolean) => {
    try {
      setSuspendingId(artistId);
      setError(null);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ suspended: suspend })
        .eq('id', artistId);

      if (updateError) throw updateError;

      setArtists(prev => prev.map(a => a.id === artistId ? { ...a, suspended: suspend } : a));
      if (selectedArtist?.id === artistId) {
        setSelectedArtist({ ...selectedArtist, suspended: suspend });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update account status');
    } finally {
      setSuspendingId(null);
    }
  };

  const handleSendNotification = async () => {
    if (!selectedArtist || !notificationTitle.trim() || !notificationMessage.trim()) {
      setError('Please enter both title and message');
      return;
    }
    try {
      setSendingNotification(true);
      setError(null);
      const { error: rpcError } = await supabase.rpc('insert_notification_for_user', {
        target_user_id: selectedArtist.id,
        notification_title: notificationTitle.trim(),
        notification_message: notificationMessage.trim(),
        notification_type: 'system'
      });
      if (rpcError) throw rpcError;
      setNotificationTitle('');
      setNotificationMessage('');
      setError(null);
      // Could set a success message if you have a toast
    } catch (err: any) {
      setError(err.message || 'Failed to send notification');
    } finally {
      setSendingNotification(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!selectedArtist) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedArtist.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${selectedArtist.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(filePath);
      setEditFormData(prev => ({ ...prev, avatar_url: publicUrl }));
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const totalArtists = artists.length;
  const totalEvents = artistEvents.reduce((sum, event) => sum + 1, 0);
  const totalVideos = artistEvents.reduce((sum, event) => sum + (event.videos?.length || 0), 0);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-24 px-6 relative overflow-x-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto relative z-10">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-2 flex items-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-3 shadow-xl shadow-purple-500/30">
                  <Music className="w-7 h-7 text-white" />
                </div>
                Artist Management
              </h1>
              <p className="text-gray-400 text-lg mt-2">Manage artists, events, and video content</p>
            </div>
            
            {/* Stats Cards */}
            <div className="flex flex-wrap gap-4">
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-purple-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Artists</p>
                    <p className="text-2xl font-bold text-white">{totalArtists}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-blue-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Events</p>
                    <p className="text-2xl font-bold text-white">{totalEvents}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-green-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                    <Video className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Videos</p>
                    <p className="text-2xl font-bold text-white">{totalVideos}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl mb-6 shadow-xl flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-semibold">{error}</span>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-red-300 hover:text-white transition-all duration-300 flex items-center justify-center group"
            >
              <X size={16} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Artists List */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/50 flex items-center justify-center">
                    <Music className="w-5 h-5 text-purple-400" />
                  </div>
                  Artists
                </h2>
                <button
                  onClick={fetchArtists}
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all duration-300 flex items-center justify-center"
                  title="Refresh artists"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search artists..."
                  className="w-full pl-10 pr-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                />
              </div>

              {/* Artists List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="relative">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500/30 border-t-purple-500 mx-auto"></div>
                      <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-2 border-purple-500/20"></div>
                    </div>
                    <p className="text-gray-400 mt-4 text-sm">Loading artists...</p>
                  </div>
                ) : filteredArtists.length > 0 ? (
                  filteredArtists.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => setSelectedArtist(artist)}
                      className={`p-4 rounded-xl cursor-pointer transition-all duration-300 border ${
                        selectedArtist?.id === artist.id
                          ? 'bg-gradient-to-r from-purple-600/30 via-pink-600/30 to-purple-600/30 border-purple-500/50 shadow-xl shadow-purple-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <img
                            src={artist.avatar_url || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg'}
                            alt={artist.full_name}
                            className="w-12 h-12 rounded-xl object-cover border-2 border-white/20"
                            style={{ objectPosition: 'center top' }}
                          />
                          {selectedArtist?.id === artist.id && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full border-2 border-gray-900"></div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-bold truncate">{artist.full_name}</div>
                          <div className="text-gray-400 text-sm truncate">@{artist.username}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                      <Music className="w-8 h-8 text-purple-400" />
                    </div>
                    <p className="text-gray-400 font-semibold">No artists found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Artist Details */}
          <div className="lg:col-span-2">
            {selectedArtist ? (
              <div className="space-y-6">
                {/* Artist Info */}
                <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-start space-x-6 flex-1">
                      <div className="relative">
                        <img
                          src={(editingProfile ? editFormData.avatar_url : selectedArtist.avatar_url) || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg'}
                          alt={selectedArtist.full_name}
                          className="w-24 h-24 rounded-2xl object-cover border-4 border-white/20 shadow-xl"
                          style={{ objectPosition: 'center top' }}
                        />
                        {editingProfile && (
                          <>
                            <input
                              type="file"
                              ref={profileFileInputRef}
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                            />
                            <button
                              type="button"
                              onClick={() => profileFileInputRef.current?.click()}
                              className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center text-white text-xs font-semibold hover:bg-black/70"
                            >
                              <Upload size={20} />
                            </button>
                          </>
                        )}
                        {!selectedArtist.suspended && (
                          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-gray-900 shadow-lg">
                            <CheckCircle className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {selectedArtist.suspended && (
                          <span className="inline-block px-3 py-1 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-semibold mb-2">Suspended</span>
                        )}
                        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-1">
                          {editingProfile && editFormData.full_name !== undefined ? editFormData.full_name : selectedArtist.full_name}
                        </h2>
                        <p className="text-purple-400 text-lg font-semibold mb-3">@{editingProfile && editFormData.username !== undefined ? editFormData.username : selectedArtist.username}</p>
                        <p className="text-gray-300 leading-relaxed">
                          {editingProfile && editFormData.bio !== undefined ? editFormData.bio : (selectedArtist.bio || 'No biography available.')}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RouterLink
                        to={`/artist/${selectedArtist.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold"
                      >
                        <ExternalLink size={16} />
                        View profile
                      </RouterLink>
                      {selectedArtist.suspended ? (
                        <button
                          onClick={() => handleSuspendActivate(selectedArtist.id, false)}
                          disabled={suspendingId === selectedArtist.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/30 hover:bg-green-600/50 border border-green-500/30 text-green-300 text-sm font-semibold disabled:opacity-50"
                        >
                          <UserCheck size={16} />
                          Activate
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSuspendActivate(selectedArtist.id, true)}
                          disabled={suspendingId === selectedArtist.id}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-500/30 text-red-300 text-sm font-semibold disabled:opacity-50"
                        >
                          <UserX size={16} />
                          Suspend
                        </button>
                      )}
                      {!editingProfile ? (
                        <button
                          onClick={() => {
                            setEditingProfile(true);
                            setEditFormData({
                              full_name: selectedArtist.full_name,
                              username: selectedArtist.username,
                              bio: selectedArtist.bio ?? '',
                              country: selectedArtist.country ?? '',
                              region: selectedArtist.region ?? '',
                              artist_type: selectedArtist.artist_type ?? '',
                              genres: selectedArtist.genres ?? [],
                              avatar_url: selectedArtist.avatar_url
                            });
                          }}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/30 text-purple-300 text-sm font-semibold"
                        >
                          <Edit size={16} />
                          Edit profile
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleSaveProfile}
                            disabled={savingProfile}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/30 hover:bg-green-600/50 border border-green-500/30 text-green-300 text-sm font-semibold disabled:opacity-50"
                          >
                            <Save size={16} />
                            {savingProfile ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => { setEditingProfile(false); setEditFormData({}); }}
                            disabled={savingProfile}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-600/30 hover:bg-gray-600/50 border border-gray-500/30 text-gray-300 text-sm font-semibold"
                          >
                            <X size={16} />
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {editingProfile && (
                    <div className="mb-6 p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                      <h4 className="text-white font-bold">Edit profile</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Full name</label>
                          <input
                            value={editFormData.full_name ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, full_name: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl bg-gray-800 border border-white/10 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Username</label>
                          <input
                            value={editFormData.username ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl bg-gray-800 border border-white/10 text-white"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-400 mb-1">Bio</label>
                          <textarea
                            value={editFormData.bio ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, bio: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-2 rounded-xl bg-gray-800 border border-white/10 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Country</label>
                          <input
                            value={editFormData.country ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, country: e.target.value }))}
                            placeholder="e.g. France"
                            className="w-full px-4 py-2 rounded-xl bg-gray-800 border border-white/10 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Region</label>
                          <select
                            value={editFormData.region ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, region: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl bg-gray-800 border border-white/10 text-white"
                          >
                            <option value="">—</option>
                            <option value="African">African</option>
                            <option value="European">European</option>
                            <option value="American">American</option>
                            <option value="Asian">Asian</option>
                            <option value="Maghreb">Maghreb</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">Artist type</label>
                          <select
                            value={editFormData.artist_type ?? ''}
                            onChange={(e) => setEditFormData(prev => ({ ...prev, artist_type: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl bg-gray-800 border border-white/10 text-white"
                          >
                            <option value="">—</option>
                            <option value="music">Music</option>
                            <option value="comedy">Comedy</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-sm p-5 rounded-2xl border border-blue-500/30 text-center shadow-xl">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{formatNumber(selectedArtist.profile_views || 0)}</div>
                      <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Profile Views</div>
                    </div>
                    <div className="bg-gradient-to-br from-red-600/20 to-pink-600/20 backdrop-blur-sm p-5 rounded-2xl border border-red-500/30 text-center shadow-xl">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                        <Heart className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{formatNumber(selectedArtist.profile_likes || 0)}</div>
                      <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Profile Likes</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 backdrop-blur-sm p-5 rounded-2xl border border-green-500/30 text-center shadow-xl">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{formatNumber(followersCount)}</div>
                      <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Followers</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 backdrop-blur-sm p-5 rounded-2xl border border-amber-500/30 text-center shadow-xl">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-2xl font-bold text-white mb-1">{formatNumber(selectedArtist.total_event_views || 0)}</div>
                      <div className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Event Views</div>
                    </div>
                  </div>

                  {/* Revenue Percentage Settings */}
                  <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30 shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/50 flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">Revenue Percentage</h3>
                          <p className="text-sm text-gray-400">Set custom revenue percentage for this artist</p>
                        </div>
                      </div>
                    </div>

                    {editingRevenuePercentage === selectedArtist.id ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm text-gray-300 mb-2">Artist Revenue Percentage (0-100%)</label>
                          <input
                            type="number"
                            value={revenuePercentageValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 100)) {
                                setRevenuePercentageValue(value);
                              }
                            }}
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder={selectedArtist.revenue_percentage?.toString() || 'Use global setting'}
                            className="w-full px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                          />
                          <p className="text-xs text-gray-400 mt-2">
                            {selectedArtist.revenue_percentage !== null 
                              ? `Current: ${selectedArtist.revenue_percentage}%` 
                              : 'Currently using global setting'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={async () => {
                              try {
                                setSavingRevenuePercentage(true);
                                const percentage = revenuePercentageValue === '' 
                                  ? null 
                                  : parseFloat(revenuePercentageValue);
                                
                                if (percentage !== null && (isNaN(percentage) || percentage < 0 || percentage > 100)) {
                                  alert('Please enter a valid percentage between 0 and 100');
                                  return;
                                }

                                const { error } = await supabase
                                  .from('profiles')
                                  .update({ revenue_percentage: percentage })
                                  .eq('id', selectedArtist.id);

                                if (error) throw error;

                                // Update local state
                                setArtists(prev => prev.map(artist => 
                                  artist.id === selectedArtist.id 
                                    ? { ...artist, revenue_percentage: percentage }
                                    : artist
                                ));
                                setSelectedArtist({ ...selectedArtist, revenue_percentage: percentage });
                                setEditingRevenuePercentage(null);
                                setRevenuePercentageValue('');
                              } catch (err: any) {
                                console.error('Error updating revenue percentage:', err);
                                alert(err.message || 'Failed to update revenue percentage');
                              } finally {
                                setSavingRevenuePercentage(false);
                              }
                            }}
                            disabled={savingRevenuePercentage}
                            className="px-6 py-2.5 bg-gradient-to-r from-green-600/30 to-emerald-600/30 hover:from-green-600/40 hover:to-emerald-600/40 border border-green-500/30 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all duration-300 shadow-lg disabled:opacity-50"
                          >
                            <Save size={16} />
                            <span>{savingRevenuePercentage ? 'Saving...' : 'Save'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingRevenuePercentage(null);
                              setRevenuePercentageValue('');
                            }}
                            disabled={savingRevenuePercentage}
                            className="px-6 py-2.5 bg-gradient-to-r from-gray-600/30 to-gray-700/30 hover:from-gray-600/40 hover:to-gray-700/40 border border-gray-500/30 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all duration-300 shadow-lg disabled:opacity-50"
                          >
                            <X size={16} />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-white mb-1">
                            {selectedArtist.revenue_percentage !== null 
                              ? `${selectedArtist.revenue_percentage}%`
                              : 'Using Global Setting'}
                          </p>
                          <p className="text-sm text-gray-400">
                            {selectedArtist.revenue_percentage !== null
                              ? 'Custom percentage set for this artist'
                              : 'No custom percentage set. Using global artist_revenue_percentage from settings.'}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setEditingRevenuePercentage(selectedArtist.id);
                            setRevenuePercentageValue(selectedArtist.revenue_percentage?.toString() || '');
                          }}
                          className="px-6 py-2.5 bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/40 hover:to-pink-600/40 border border-purple-500/30 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all duration-300 shadow-lg"
                        >
                          <Edit size={16} />
                          <span>Edit</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Communication (gated by super admin toggle) */}
                {communicationEnabled && (
                  <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-500/50 flex items-center justify-center">
                        <MessageSquare className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-white">Communication</h3>
                        <p className="text-sm text-gray-400">Send in-app notifications to this artist</p>
                      </div>
                    </div>
                    {selectedArtist.notification_preference && (
                      <p className="text-sm text-gray-400 mb-4">
                        Notification preference: <span className="text-white font-medium">{selectedArtist.notification_preference}</span>
                      </p>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Title</label>
                        <input
                          value={notificationTitle}
                          onChange={(e) => setNotificationTitle(e.target.value)}
                          placeholder="Notification title"
                          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-white/10 text-white placeholder-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">Message</label>
                        <textarea
                          value={notificationMessage}
                          onChange={(e) => setNotificationMessage(e.target.value)}
                          placeholder="Notification message"
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-white/10 text-white placeholder-gray-500"
                        />
                      </div>
                      <button
                        onClick={handleSendNotification}
                        disabled={sendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
                        className="px-6 py-2.5 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 hover:from-indigo-600/40 hover:to-purple-600/40 border border-indigo-500/30 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
                      >
                        <MessageSquare size={16} />
                        {sendingNotification ? 'Sending...' : 'Send notification'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Events Management */}
                <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/50 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-400" />
                      </div>
                      Events Management
                    </h3>
                  </div>
                  
                  {artistEvents.length > 0 ? (
                    <div className="space-y-6">
                      {artistEvents.map((event) => (
                        <div key={event.id} className="bg-gradient-to-br from-gray-800/60 via-gray-700/40 to-gray-800/60 backdrop-blur-sm rounded-2xl p-6 border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300">
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-xl font-bold text-white">{event.title}</h4>
                                <span className={`px-3 py-1 rounded-xl text-xs font-bold ${
                                  event.status === 'live' 
                                    ? 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-400 border border-red-500/30'
                                    : event.status === 'ended'
                                    ? 'bg-gradient-to-r from-gray-500/20 to-gray-600/20 text-gray-400 border border-gray-500/30'
                                    : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30'
                                }`}>
                                  {event.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-gray-400 mb-3">
                                <div className="flex items-center gap-2">
                                  <Calendar size={16} className="text-blue-400" />
                                  <span className="text-sm">{formatDate(event.start_time)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Users size={16} className="text-purple-400" />
                                  <span className="text-sm font-semibold">{formatNumber(event.viewer_count || 0)} views</span>
                                </div>
                              </div>
                              <p className="text-gray-300 leading-relaxed">{event.description}</p>
                            </div>

                            <div className="flex items-center space-x-2 ml-4">
                              {editingEvent === event.id ? (
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => saveEventVideos(event.id)}
                                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400 hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-300 flex items-center justify-center group"
                                    title="Save videos"
                                  >
                                    <Save size={18} className="group-hover:scale-110 transition-transform" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingEvent(null);
                                      setNewVideoUrls(['']);
                                      setNewVideoTitles(['']);
                                    }}
                                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500/20 to-gray-600/20 border border-gray-500/30 text-gray-400 hover:from-gray-500/30 hover:to-gray-600/30 transition-all duration-300 flex items-center justify-center group"
                                    title="Cancel"
                                  >
                                    <X size={18} className="group-hover:scale-110 transition-transform" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => setEditingEvent(event.id)}
                                    className="px-4 py-2 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 hover:from-blue-600/40 hover:to-cyan-600/40 border border-blue-500/30 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all duration-300 shadow-lg"
                                    title="Add videos"
                                  >
                                    <Plus size={16} />
                                    <span>Add Videos</span>
                                  </button>
                                  <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="video/*"
                                    multiple
                                    onChange={(e) => {
                                      if (e.target.files) {
                                        handleMultipleVideoUpload(event.id, e.target.files);
                                      }
                                    }}
                                    className="hidden"
                                  />
                                  <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingVideos.has(event.id)}
                                    className="px-4 py-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 hover:from-purple-600/40 hover:to-pink-600/40 border border-purple-500/30 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center space-x-2 transition-all duration-300 shadow-lg"
                                  >
                                    <Upload size={16} />
                                    <span>{uploadingVideos.has(event.id) ? 'Uploading...' : 'Upload Videos'}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Video URLs Input (when editing) */}
                          {editingEvent === event.id && (
                            <div className="mt-6 p-6 bg-gradient-to-br from-gray-800/60 to-gray-700/40 backdrop-blur-sm rounded-2xl border border-white/10">
                              <div className="flex items-center justify-between mb-4">
                                <h5 className="text-white font-bold flex items-center gap-2">
                                  <Link className="w-5 h-5 text-purple-400" />
                                  Add Video URLs
                                </h5>
                                <button
                                  onClick={addVideoUrl}
                                  className="px-4 py-2 bg-gradient-to-r from-green-600/30 to-emerald-600/30 hover:from-green-600/40 hover:to-emerald-600/40 border border-green-500/30 text-white rounded-xl text-sm font-semibold flex items-center space-x-2 transition-all duration-300"
                                >
                                  <Plus size={16} />
                                  <span>Add URL</span>
                                </button>
                              </div>
                              
                              <div className="space-y-3">
                                {newVideoUrls.map((url, index) => (
                                  <div key={index} className="flex items-center space-x-3">
                                    <input
                                      type="text"
                                      value={newVideoTitles[index]}
                                      onChange={(e) => updateVideoTitle(index, e.target.value)}
                                      placeholder="Video title"
                                      className="flex-1 px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                                    />
                                    <input
                                      type="url"
                                      value={url}
                                      onChange={(e) => updateVideoUrl(index, e.target.value)}
                                      placeholder="Video URL"
                                      className="flex-1 px-4 py-3 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
                                    />
                                    {newVideoUrls.length > 1 && (
                                      <button
                                        onClick={() => removeVideoUrl(index)}
                                        className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 text-red-400 hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-300 flex items-center justify-center group"
                                      >
                                        <X size={16} className="group-hover:scale-110 transition-transform" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Existing Videos Display */}
                          {event.videos && event.videos.length > 0 && (
                            <div className="mt-6">
                              <h5 className="text-white font-bold mb-4 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/50 flex items-center justify-center">
                                  <Video className="w-4 h-4 text-purple-400" />
                                </div>
                                Videos ({event.videos.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {event.videos.map((video) => (
                                  <div key={video.id} className="bg-gradient-to-br from-gray-800/60 via-gray-700/40 to-gray-800/60 backdrop-blur-sm rounded-2xl p-4 border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                                    <div className="relative mb-4 rounded-xl overflow-hidden">
                                      {video.thumbnail_url ? (
                                        <img
                                          src={video.thumbnail_url}
                                          alt={video.title}
                                          className="w-full h-40 object-cover cursor-pointer"
                                          onClick={() => playVideo(video)}
                                        />
                                      ) : (
                                        <div 
                                          className="w-full h-40 bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm rounded-xl flex items-center justify-center cursor-pointer hover:from-gray-700/80 hover:to-gray-600/60 transition-all duration-300 group"
                                          onClick={() => playVideo(video)}
                                        >
                                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Play size={24} className="text-purple-400 ml-1" />
                                          </div>
                                        </div>
                                      )}
                                      <div className="absolute top-2 right-2">
                                        <button
                                          onClick={() => removeVideo(video.id)}
                                          className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500/90 to-rose-500/90 hover:from-red-600 hover:to-rose-600 text-white shadow-xl flex items-center justify-center transition-all duration-300 group"
                                          title="Remove video"
                                        >
                                          <Trash2 size={14} className="group-hover:scale-110 transition-transform" />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-3">
                                      <h6 className="text-white font-bold text-sm truncate" title={video.title}>
                                        {video.title}
                                      </h6>
                                      
                                      <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg">
                                          {video.video_type === 'upload' ? (
                                            <FileVideo size={12} className="text-blue-400" />
                                          ) : (
                                            <Link size={12} className="text-purple-400" />
                                          )}
                                          <span className="text-gray-300 font-semibold">{video.video_type === 'upload' ? 'Uploaded' : 'URL'}</span>
                                        </div>
                                        {video.file_size && (
                                          <span className="text-gray-400 font-semibold">{formatFileSize(video.file_size)}</span>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => playVideo(video)}
                                          className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 hover:from-blue-600/40 hover:to-cyan-600/40 border border-blue-500/30 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition-all duration-300 shadow-lg"
                                        >
                                          <Play size={12} />
                                          <span>Play</span>
                                        </button>
                                        <a
                                          href={video.video_url}
                                          download
                                          className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1 transition-all duration-300"
                                          title="Download video"
                                        >
                                          <Download size={12} />
                                        </a>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-gradient-to-br from-gray-800/60 to-gray-700/40 backdrop-blur-sm rounded-2xl border border-white/10">
                      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                        <Calendar className="w-10 h-10 text-blue-400" />
                      </div>
                      <p className="text-gray-300 text-xl font-semibold mb-2">No events found</p>
                      <p className="text-gray-500 text-sm">This artist hasn't scheduled any events yet</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/10 shadow-2xl">
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Users className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">Select an Artist</h3>
                <p className="text-gray-400 text-lg">Choose an artist from the list to manage their profile and events</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Player Modal */}
      {showVideoModal && selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={closeVideoPlayer}
        />
      )}
    </div>
  );
};

export default ArtistManagement;