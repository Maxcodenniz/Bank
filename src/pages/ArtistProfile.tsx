import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import {
  Heart, Eye, Calendar, Clock, Users, Play,
  ArrowLeft, Music, MapPin, Upload, Camera, X, Ticket, ChevronDown, Trash2
} from 'lucide-react';
import { isSuperAdmin } from '../utils/constants';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ArtistData {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  cover_url?: string;
  bio?: string;
  genres?: string[];
  country?: string;
  region?: string;
  artist_type?: string;
  created_at: string;
  profile_views?: number;
  profile_likes?: number;
  total_event_views?: number;
}

interface EventData {
  id: string;
  title: string;
  description: string;
  start_time: string;
  duration: number;
  price: number;
  image_url: string;
  status: string;
  viewer_count: number;
  video_url?: string;
  ticket_count?: number;
}

interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  created_at: string;
  description?: string;
}

const ImageUploadModal: React.FC<{
  type: 'profile' | 'cover';
  onSave: (file: Blob) => Promise<void>;
  onClose: () => void;
}> = ({ type, onSave, onClose }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [loading, setLoading] = useState(false);
  const aspect = type === 'profile' ? 1 : 16/9;
  const [cropMode, setCropMode] = useState<'contain' | 'fill'>('contain');

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSrc(URL.createObjectURL(e.target.files[0]));
    }
  };

  const onImageLoad = (img: HTMLImageElement) => {
    setImage(img);
    if (type === 'profile') {
      const size = Math.min(img.width, img.height);
      setCrop({
        unit: 'px',
        width: size,
        height: size,
        x: (img.width - size) / 2,
        y: (img.height - size) / 2,
      });
    } else {
      // For cover photos, calculate optimal crop area
      const targetAspect = 16 / 9;
      const imgAspect = img.width / img.height;

      if (imgAspect > targetAspect) {
        // Image is wider than target - use full height
        const cropWidth = img.height * targetAspect;
        setCrop({
          unit: 'px',
          width: cropWidth,
          height: img.height,
          x: (img.width - cropWidth) / 2,
          y: 0,
        });
      } else {
        // Image is taller than target - use full width
        const cropHeight = img.width / targetAspect;
        setCrop({
          unit: 'px',
          width: img.width,
          height: cropHeight,
          x: 0,
          y: Math.max(0, (img.height - cropHeight) / 4), // Position slightly towards top
        });
      }
    }
  };

  const getCroppedImage = useCallback(async () => {
    if (!image || !crop) return;

    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set optimal output dimensions
    const maxWidth = type === 'profile' ? 800 : 1920;
    const maxHeight = type === 'profile' ? 800 : 1080;

    let outputWidth = crop.width! * scaleX;
    let outputHeight = crop.height! * scaleY;

    // Scale down if larger than max dimensions while maintaining aspect ratio
    if (outputWidth > maxWidth || outputHeight > maxHeight) {
      const scale = Math.min(maxWidth / outputWidth, maxHeight / outputHeight);
      outputWidth *= scale;
      outputHeight *= scale;
    }

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d')!;

    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x! * scaleX,
      crop.y! * scaleY,
      crop.width! * scaleX,
      crop.height! * scaleY,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => blob && resolve(blob), 'image/jpeg', 0.92);
    });
  }, [crop, image, type]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const croppedImage = await getCroppedImage();
      if (croppedImage) {
        await onSave(croppedImage);
        onClose();
      }
    } catch (error) {
      console.error('Error saving image:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">
            Edit {type === 'profile' ? 'Profile Picture' : 'Cover Photo'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {!src ? (
          <div>
            <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-4">
              <p className="text-blue-300 text-sm mb-2 font-semibold">
                {type === 'profile' ? '📸 Profile Picture Guidelines:' : '🖼️ Cover Photo Guidelines:'}
              </p>
              <ul className="text-blue-200 text-sm space-y-1 list-disc list-inside">
                {type === 'profile' ? (
                  <>
                    <li>Recommended: Square images (1:1 ratio)</li>
                    <li>Minimum size: 400x400 pixels</li>
                    <li>Optimal size: 800x800 pixels or higher</li>
                    <li>Keep your face centered in the photo</li>
                  </>
                ) : (
                  <>
                    <li>Recommended: Wide landscape images (16:9 ratio)</li>
                    <li>Minimum size: 1200x675 pixels</li>
                    <li>Optimal size: 1920x1080 pixels or higher</li>
                    <li>Keep important content in the center area</li>
                    <li>Avoid placing faces at the very top or bottom</li>
                  </>
                )}
              </ul>
            </div>
            <label className="border-2 border-dashed border-gray-600 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors">
              <Upload size={48} className="text-gray-400 mb-4" />
              <span className="text-lg text-white mb-2">Select an image</span>
              <span className="text-sm text-gray-400">Click to browse or drag and drop</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={onFileChange}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3 mb-3">
              <p className="text-yellow-200 text-sm">
                💡 <strong>Tip:</strong> Drag the selection box to reposition.
                {type === 'cover' && ' For best results, keep faces and important elements in the center of the selection.'}
              </p>
            </div>
            <div className="max-h-[60vh] overflow-auto bg-gray-900 rounded-lg">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                aspect={aspect}
                circularCrop={type === 'profile'}
              >
                <img
                  src={src}
                  onLoad={(e) => onImageLoad(e.currentTarget)}
                  alt="Crop preview"
                  className="max-w-full"
                />
              </ReactCrop>
            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={() => setSrc(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
              >
                Change Image
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-700 transition-colors font-medium"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Event Card Component with Ticket Count Dropdown
const EventCardWithTickets: React.FC<{ event: EventData }> = ({ event }) => {
  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [ticketDetails, setTicketDetails] = useState<Array<{email: string, purchased_at: string}>>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const { userProfile } = useStore();
  const isOwner = userProfile?.id === event.id; // This will be checked properly

  const fetchTicketDetails = async () => {
    if (showTicketDetails && ticketDetails.length > 0) return; // Already loaded
    
    setLoadingTickets(true);
    try {
      const { data } = await supabase
        .from('tickets')
        .select('email, created_at')
        .eq('event_id', event.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (data) {
        setTicketDetails(data.map((t: any) => ({
          email: t.email || 'Guest',
          purchased_at: t.created_at
        })));
      }
    } catch (err) {
      console.error('Error fetching ticket details:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleToggleDetails = () => {
    if (!showTicketDetails) {
      fetchTicketDetails();
    }
    setShowTicketDetails(!showTicketDetails);
  };

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300">
      <img
        src={event.image_url || 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg'}
        alt={event.title}
        className="w-full h-48 object-cover"
      />
      <div className="p-5">
        <h3 className="text-lg font-bold text-white mb-3">{event.title}</h3>
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-gray-300">
            <Calendar size={16} className="mr-2 text-purple-400" />
            <span className="text-sm">{new Date(event.start_time).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center text-gray-300">
            <Clock size={16} className="mr-2 text-purple-400" />
            <span className="text-sm">{event.duration} minutes</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center text-gray-300">
              <Ticket size={16} className="mr-2 text-green-400" />
              <span className="text-sm font-semibold">{event.ticket_count || 0} tickets sold</span>
            </div>
            {isOwner && event.ticket_count && event.ticket_count > 0 && (
              <button
                onClick={handleToggleDetails}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <span>Details</span>
                <ChevronDown size={14} className={`transition-transform ${showTicketDetails ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
        
        {showTicketDetails && isOwner && (
          <div className="mt-4 pt-4 border-t border-white/10">
            {loadingTickets ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto"></div>
              </div>
            ) : ticketDetails.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-2 scrollbar-thin">
                {ticketDetails.map((ticket, idx) => (
                  <div key={idx} className="bg-white/5 rounded-lg p-2 text-xs">
                    <div className="text-white font-medium">{ticket.email}</div>
                    <div className="text-gray-400">{new Date(ticket.purchased_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center">No tickets sold yet</p>
            )}
          </div>
        )}

        <Link
          to={`/watch/${event.id}`}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-2.5 px-4 rounded-xl hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 block text-center font-semibold mt-4"
        >
          View Event
        </Link>
      </div>
    </div>
  );
};

const MediaUploadModal: React.FC<{
  onSave: (files: FileList) => Promise<void>;
  onClose: () => void;
}> = ({ onSave, onClose }) => {
  const [files, setFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(e.target.files);
    }
  };

  const handleSave = async () => {
    if (!files || files.length === 0) return;
    
    setLoading(true);
    try {
      await onSave(files);
      onClose();
    } catch (error) {
      console.error('Error uploading media:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Upload Media</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Select Images or Videos
            </label>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for your media..."
              className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
              rows={3}
            />
          </div>

          {files && files.length > 0 && (
            <div className="text-sm text-gray-400">
              {files.length} file(s) selected
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !files || files.length === 0}
              className="px-4 py-2 rounded-lg bg-purple-600 text-white disabled:opacity-50"
            >
              {loading ? 'Uploading...' : 'Upload Media'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ArtistProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, userProfile } = useStore();
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [pastEvents, setPastEvents] = useState<EventData[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventData[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showProfileUpload, setShowProfileUpload] = useState(false);
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const fetchArtistData = async () => {
    try {
      setLoading(true);
      
      // Fetch artist profile (explicitly include genres field)
      const { data: artistData, error: artistError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, cover_url, bio, genres, country, region, artist_type, created_at, profile_views, profile_likes, total_event_views')
        .eq('id', id)
        .single();

      if (artistError) throw artistError;
      
      // Debug: Log genres to check if they're being fetched
      console.log('Artist genres fetched:', artistData?.genres);

      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('artist_id', id)
        .order('start_time', { ascending: false });

      if (eventsError) throw eventsError;

      // Fetch media
      const { data: mediaData, error: mediaError } = await supabase
        .from('artist_media')
        .select('*')
        .eq('artist_id', id)
        .order('created_at', { ascending: false });

      // Fetch ticket counts for each event
      const eventIds = eventsData.map(e => e.id);
      const ticketCounts: { [key: string]: number } = {};
      
      if (eventIds.length > 0) {
        const { data: ticketsData } = await supabase
          .from('tickets')
          .select('event_id, status')
          .in('event_id', eventIds)
          .eq('status', 'active');
        
        if (ticketsData) {
          ticketsData.forEach(ticket => {
            ticketCounts[ticket.event_id] = (ticketCounts[ticket.event_id] || 0) + 1;
          });
        }
      }

      // Process events and add ticket counts
      const now = new Date();
      const past = eventsData
        .filter(event => 
          new Date(event.start_time) < now && event.status === 'ended'
        )
        .map(event => ({ ...event, ticket_count: ticketCounts[event.id] || 0 }));
      const upcoming = eventsData
        .filter(event => 
          new Date(event.start_time) > now || event.status === 'upcoming'
        )
        .map(event => ({ ...event, ticket_count: ticketCounts[event.id] || 0 }));

      // Check if current user has liked this artist
      if (user && artistData) {
        const { data: likeData } = await supabase
          .from('favorite_artists')
          .select('*')
          .eq('user_id', user.id)
          .eq('artist_id', id)
          .maybeSingle();
        
        setIsLiked(!!likeData);
      }

      // Ensure genres is an array (handle null/undefined cases)
      if (artistData) {
        artistData.genres = Array.isArray(artistData.genres) ? artistData.genres : [];
      }

      // Update state
      setArtist(artistData);
      setPastEvents(past);
      setUpcomingEvents(upcoming);
      setMedia(mediaData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchArtistData();
    }
  }, [id]);

  const handleProfileUpload = async (file: Blob) => {
    if (!user || !userProfile || !artist) {
      console.error('Missing user or artist data', { hasUser: !!user, hasUserProfile: !!userProfile, hasArtist: !!artist });
      setError('Please sign in to update your profile picture.');
      return;
    }
    
    const isOwner = user.id === artist.id || userProfile.id === artist.id;
    const isAdmin = userProfile.user_type === 'global_admin' || isSuperAdmin(user.id);
    if (!isOwner && !isAdmin) {
      console.error('User does not have permission to update profile');
      return;
    }
    
    try {
      setError(null); // Clear any previous errors
      console.log('Starting profile upload...', { artistId: artist.id, userId: user.id });
      
      // Use the same path pattern as other uploads to match RLS policies
      const fileExt = 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `avatars/${artist.id}/${fileName}`;

      // Upload directly to profiles bucket using the avatars folder structure
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) {
        console.error('Profile upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      console.log('Updating profile with new avatar URL:', publicUrl);

      const { error: updateError, data: updatedProfile } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', artist.id)
        .select()
        .single();

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      // Update local state with the updated profile
      if (updatedProfile) {
        setArtist({ ...artist, avatar_url: publicUrl });
        console.log('✅ Profile picture updated successfully');
      } else {
        // Fallback: update local state even if select didn't return data
        setArtist({ ...artist, avatar_url: publicUrl });
        console.log('✅ Profile picture updated successfully (fallback)');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      // Set a temporary error message that won't trigger "Artist Not Found"
      const errorMessage = `Failed to update profile picture: ${err instanceof Error ? err.message : 'Unknown error'}`;
      setError(errorMessage);
      
      // Clear error after 5 seconds so it doesn't persist
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  const handleCoverUpload = async (file: Blob) => {
    if (!user || !artist) return;
    const isOwner = user.id === artist.id;
    const isAdmin = user.user_type === 'global_admin' || isSuperAdmin(user.id);
    if (!isOwner && !isAdmin) return;
    
    try {
      console.log('Starting cover upload...');
      // Use the same path pattern as other uploads to match RLS policies
      const fileExt = 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `covers/${artist.id}/${fileName}`;

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error('Cover upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('profiles')
        .update({ cover_url: publicUrl })
        .eq('id', artist.id);

      if (error) {
        throw error;
      } else {
        // Update local state instead of refetching all data
        setArtist({ ...artist, cover_url: publicUrl });
        console.log('✅ Cover photo updated successfully');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError(`Failed to update cover photo: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleMediaUpload = async (files: FileList) => {
    if (!user || !artist) return;

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileName = `media-${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;
        const filePath = fileName; // Remove the folder path since we're using the bucket directly
        const isVideo = file.type.startsWith('video/');

        // Try to upload to existing buckets first, fallback to a default bucket
        let uploadError;
        let publicUrl;

        // Try uploading to 'media' bucket first
        const { error: mediaUploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file);

        if (!mediaUploadError) {
          const { data: { publicUrl: mediaUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);
          publicUrl = mediaUrl;
        } else {
          // Fallback to 'profile-pictures' bucket if media bucket doesn't exist
          const { error: fallbackUploadError } = await supabase.storage
            .from('profile-pictures')
            .upload(`media/${filePath}`, file);

          if (fallbackUploadError) throw fallbackUploadError;

          const { data: { publicUrl: fallbackUrl } } = supabase.storage
            .from('profile-pictures')
            .getPublicUrl(`media/${filePath}`);
          publicUrl = fallbackUrl;
        }

        // Insert media record
        const { data, error } = await supabase
          .from('artist_media')
          .insert({
            artist_id: artist.id,
            url: publicUrl,
            type: isVideo ? 'video' : 'image',
            description: ''
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      });

      const newMedia = await Promise.all(uploadPromises);
      setMedia(prev => [...newMedia, ...prev]);
    } catch (err) {
      console.error('Media upload failed:', err);
      setError('Failed to upload media. Please check if the storage buckets are properly configured.');
    }
  };

  const handleMediaDelete = async (mediaId: string) => {
    if (!user || !artist) return;
    if (user.id !== artist.id && !isSuperAdmin(userProfile?.id, userProfile?.user_type)) return;
    if (!window.confirm('Remove this media from your gallery?')) return;

    try {
      const { error } = await supabase
        .from('artist_media')
        .delete()
        .eq('id', mediaId)
        .eq('artist_id', artist.id);

      if (error) throw error;
      setMedia(prev => prev.filter(m => m.id !== mediaId));
      if (selectedMedia?.id === mediaId) setSelectedMedia(null);
    } catch (err) {
      console.error('Error deleting media:', err);
      setError('Failed to delete media. Please try again.');
    }
  };

  const toggleLike = async () => {
    if (!user || !artist) return;

    try {
      if (isLiked) {
        await supabase
          .from('favorite_artists')
          .delete()
          .eq('user_id', user.id)
          .eq('artist_id', artist.id);
      } else {
        await supabase
          .from('favorite_artists')
          .insert({
            user_id: user.id,
            artist_id: artist.id
          });
      }
      setIsLiked(!isLiked);
      fetchArtistData(); // Refresh counts
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Only show "Artist Not Found" if artist is actually null (not just an error)
  // Errors from uploads should be shown as notifications, not as "Artist Not Found"
  if (!artist && !loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h2 className="text-2xl font-bold mb-2">Artist Not Found</h2>
          <p className="text-gray-400">The artist profile you're looking for doesn't exist.</p>
          <Link to="/" className="text-purple-400 hover:text-purple-300 mt-4 inline-block">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  // Show error notification if there's an error but artist exists
  if (error && artist) {
    // Error notification will be shown in the UI below
  }

  const isOwnerOrAdmin = user && (user.id === artist.id || user.user_type === 'global_admin' || isSuperAdmin(user.id));

  return (
    <div className="min-h-screen relative overflow-hidden pt-16">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.2),transparent_50%)]"></div>
      </div>

      {/* Animated floating elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>
      {/* Error Notification */}
      {error && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg max-w-md mx-4 animate-in slide-in-from-top">
          <div className="flex items-center justify-between">
            <p className="font-medium">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-white hover:text-gray-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="relative">
        {/* Cover Photo */}
        <div className="h-80 md:h-96 relative overflow-hidden">
          {artist.cover_url ? (
            <>
              <img
                src={artist.cover_url}
                alt="Cover"
                className="w-full h-full object-cover object-center"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/80" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-600 via-pink-600 to-cyan-600" />
          )}
          {isOwnerOrAdmin && (
            <button
              onClick={() => setShowCoverUpload(true)}
              className="absolute bottom-4 right-4 backdrop-blur-xl bg-white/10 border border-white/20 text-white px-5 py-2.5 rounded-xl flex items-center space-x-2 hover:bg-white/20 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 z-10"
            >
              <Camera size={18} />
              <span className="font-semibold">Edit Cover</span>
            </button>
          )}
        </div>

        {/* Profile Info */}
        <div className="container mx-auto px-6 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-end space-y-4 md:space-y-0 md:space-x-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white/90 shadow-2xl overflow-hidden ring-4 ring-purple-500/20 group-hover:ring-purple-500/40 transition-all">
                <img
                  src={artist.avatar_url || '/default-avatar.png'}
                  alt={artist.full_name}
                  className="w-full h-full object-cover"
                  style={{ objectPosition: 'center top' }}
                  onError={(e) => {
                    e.currentTarget.src = '/default-avatar.png';
                  }}
                />
              </div>
              {isOwnerOrAdmin && (
                <button
                  onClick={() => setShowProfileUpload(true)}
                  className="absolute bottom-0 right-0 backdrop-blur-xl bg-white/20 border-2 border-white/30 text-white p-2.5 rounded-full hover:bg-white/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-110"
                >
                  <Camera size={18} />
                </button>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                {artist.username}
              </h1>
              {/* Only show full_name to the artist themselves or admins (confidential) */}
              {artist.full_name && artist.full_name !== artist.username && (user?.id === artist.id || userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') && (
                <p className="text-xl text-gray-300 mb-3">{artist.full_name}</p>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
                {artist.genres && Array.isArray(artist.genres) && artist.genres.length > 0 ? (
                  artist.genres.map((genre, i) => (
                    <span key={i} className="backdrop-blur-sm bg-gradient-to-r from-purple-600/30 to-pink-600/30 border border-purple-500/30 text-purple-200 px-4 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                      {genre}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-sm italic">No genres specified</span>
                )}
              </div>
              {/* Follow Button and Location */}
              <div className="flex items-center space-x-4 flex-wrap gap-3">
                {user && user.id !== artist.id && (
                  <div className="flex flex-col items-start">
                    <button
                      onClick={toggleLike}
                      title={isLiked ? "Unfollow to stop receiving notifications" : "Follow to get notifications for new events and live streams"}
                      className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 ${
                        isLiked 
                          ? 'bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-700 hover:to-pink-700' 
                          : 'backdrop-blur-sm bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20'
                      }`}
                    >
                      <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
                      <span>{isLiked ? 'Following' : 'Follow'}</span>
                    </button>
                    <p className="text-xs text-gray-400 mt-1.5 px-1">
                      {isLiked ? 'You\'ll receive notifications for new events and live streams' : 'Get notified about new events and live streams'}
                    </p>
                  </div>
                )}
                {(artist.country || artist.region) && (
                  <div className="flex items-center backdrop-blur-sm bg-white/10 border border-white/20 px-4 py-2.5 rounded-xl text-gray-300">
                    <MapPin size={18} className="mr-2 text-purple-400" />
                    <span className="font-medium">{[artist.region, artist.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 relative z-10">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] text-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
              <Eye className="h-7 w-7 text-blue-300" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent mb-2">
              {artist.profile_views?.toLocaleString() || 0}
            </div>
            <div className="text-gray-400 font-medium">Profile Views</div>
          </div>
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] text-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500/20 to-red-500/20 flex items-center justify-center mx-auto mb-4">
              <Heart className="h-7 w-7 text-pink-300" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-pink-300 to-red-300 bg-clip-text text-transparent mb-2">
              {artist.profile_likes?.toLocaleString() || 0}
            </div>
            <div className="text-gray-400 font-medium">Profile Likes</div>
          </div>
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] text-center">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="h-7 w-7 text-green-300" />
            </div>
            <div className="text-3xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent mb-2">
              {artist.total_event_views?.toLocaleString() || 0}
            </div>
            <div className="text-gray-400 font-medium">Total Event Views</div>
          </div>
        </div>

        {/* Bio Section */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Music className="w-5 h-5 text-purple-300" />
            </div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">About</h2>
          </div>
          <p className="text-gray-300 leading-relaxed text-lg">
            {artist.bio || 'No biography available.'}
          </p>
        </div>

        {/* Media Gallery */}
        <div className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Upload className="w-5 h-5 text-purple-300" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">Gallery</h2>
            </div>
            {isOwnerOrAdmin && (
              <button
                onClick={() => setShowMediaUpload(true)}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105 font-semibold"
              >
                <Upload size={18} />
                <span>Add Media</span>
              </button>
            )}
          </div>
          
          {media.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.map((item) => (
                <div 
                  key={item.id} 
                  className="relative group rounded-2xl overflow-hidden backdrop-blur-sm bg-white/5 border border-white/10 cursor-pointer hover:scale-105 transition-all duration-300 shadow-xl hover:shadow-2xl"
                  onClick={() => setSelectedMedia(item)}
                >
                  {isOwnerOrAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMediaDelete(item.id);
                      }}
                      className="absolute top-2 right-2 z-10 p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-colors"
                      aria-label="Delete media"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  {item.type === 'image' ? (
                    <img
                      src={item.url}
                      alt=""
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="relative">
                      <video
                        src={item.url}
                        className="w-full h-48 object-cover"
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/60 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="h-8 w-8 text-white drop-shadow-lg" fill="currentColor" />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 group-hover:from-black/80 transition-all duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-110">
                      {item.type === 'image' ? (
                        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Eye className="h-6 w-6 text-white drop-shadow-lg" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="h-8 w-8 text-white drop-shadow-lg" fill="currentColor" />
                        </div>
                      )}
                    </div>
                  </div>

                  {item.description && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-white p-4">
                      <p className="text-sm font-medium">{item.description}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-xl">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-2xl"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-full flex items-center justify-center border-2 border-white/20 backdrop-blur-sm mx-auto">
                  <Music className="w-12 h-12 text-purple-300" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">No Media Yet</h3>
              <p className="text-gray-400 text-lg max-w-md mx-auto">
                {isOwnerOrAdmin 
                  ? "Upload some photos or videos to showcase your work!"
                  : "This artist hasn't uploaded any media yet."
                }
              </p>
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-300" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">Upcoming Events</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <EventCardWithTickets key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500/20 to-gray-600/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-gray-300" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-300 to-gray-400 bg-clip-text text-transparent">Past Events</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastEvents.map((event) => (
                <EventCardWithTickets key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {/* No Events Message */}
        {pastEvents.length === 0 && upcomingEvents.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Events Yet</h3>
            <p className="text-gray-400">This artist hasn't scheduled any events yet.</p>
          </div>
        )}
      </div>

      {/* Media Viewer Modal */}
      {selectedMedia && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="relative w-full h-full max-w-6xl max-h-[90vh] flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute top-4 right-4 z-10 text-white hover:text-gray-300 bg-black/50 rounded-full w-12 h-12 flex items-center justify-center text-2xl transition-colors"
            >
              <X size={24} />
            </button>
            {/* Delete button (owner/admin only) */}
            {isOwnerOrAdmin && (
              <button
                onClick={() => handleMediaDelete(selectedMedia.id)}
                className="absolute top-4 right-20 z-10 text-white hover:text-red-300 bg-red-500/70 hover:bg-red-500 rounded-full w-12 h-12 flex items-center justify-center transition-colors"
                aria-label="Delete media"
              >
                <Trash2 size={24} />
              </button>
            )}

            {/* Media content */}
            <div className="w-full h-full flex items-center justify-center">
              {selectedMedia.type === 'image' ? (
                <img
                  src={selectedMedia.url}
                  alt=""
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <video
                  src={selectedMedia.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-full rounded-lg"
                  style={{ maxHeight: '85vh' }}
                />
              )}
            </div>

            {/* Media info */}
            {selectedMedia.description && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-4 rounded-lg">
                <p className="text-sm">{selectedMedia.description}</p>
                <p className="text-xs text-gray-300 mt-1">
                  Uploaded on {new Date(selectedMedia.created_at).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Navigation arrows if there are multiple media items */}
            {media.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIndex = media.findIndex(m => m.id === selectedMedia.id);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : media.length - 1;
                    setSelectedMedia(media[prevIndex]);
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors"
                >
                  <ArrowLeft size={24} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIndex = media.findIndex(m => m.id === selectedMedia.id);
                    const nextIndex = currentIndex < media.length - 1 ? currentIndex + 1 : 0;
                    setSelectedMedia(media[nextIndex]);
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/70 transition-colors"
                >
                  <ArrowLeft size={24} className="rotate-180" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute -top-12 right-0 text-white text-2xl hover:text-gray-300 bg-black/50 rounded-full w-10 h-10 flex items-center justify-center"
            >
              ✕
            </button>
            <video 
              controls 
              autoPlay 
              className="w-full rounded-lg"
              src={selectedVideo}
            />
          </div>
        </div>
      )}

      {/* Profile/Cover Upload Modals */}
      {showProfileUpload && (
        <ImageUploadModal
          type="profile"
          onSave={handleProfileUpload}
          onClose={() => setShowProfileUpload(false)}
        />
      )}

      {showCoverUpload && (
        <ImageUploadModal
          type="cover"
          onSave={handleCoverUpload}
          onClose={() => setShowCoverUpload(false)}
        />
      )}

      {/* Media Upload Modal */}
      {showMediaUpload && (
        <MediaUploadModal
          onSave={handleMediaUpload}
          onClose={() => setShowMediaUpload(false)}
        />
      )}
    </div>
  );
};

export default ArtistProfile;