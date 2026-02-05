import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { User, Upload, X, Mail, Phone, Bell, Save, Sparkles, Calendar, Ticket, Heart, Music, Globe, MapPin, FileText, Image as ImageIcon, Radio, LayoutDashboard, ArrowRight, CheckCircle2, Search, Trash2, AlertTriangle } from 'lucide-react';
import PhoneInput, { type PhoneValue } from '../components/PhoneInput';
import { formatFullPhone, parseFullPhone, getDefaultDialCodeFromBrowser } from '../utils/phoneCountryCodes';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, setUserProfile, signOut } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(userProfile?.avatar_url || null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>((userProfile as any)?.cover_url || null);
  const [stats, setStats] = useState({
    eventsCount: 0,
    ticketsCount: 0,
    favoritesCount: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [availableGenres, setAvailableGenres] = useState<any[]>([]);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [genreSearchQuery, setGenreSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    username: userProfile?.username || '',
    fullName: userProfile?.full_name || '',
    avatarUrl: userProfile?.avatar_url || '',
    coverUrl: (userProfile as any)?.cover_url || '',
    email: userProfile?.email || '',
    phone: (() => {
      if (userProfile?.phone) {
        const parsed = parseFullPhone(userProfile.phone);
        if (parsed) return { dialCode: parsed.dialCode, localNumber: parsed.localNumber };
      }
      return { dialCode: getDefaultDialCodeFromBrowser(), localNumber: '' } as PhoneValue;
    })(),
    bio: (userProfile as any)?.bio || '',
    genres: (userProfile as any)?.genres || [],
    country: (userProfile as any)?.country || '',
    region: (userProfile as any)?.region || '',
    artistType: (userProfile as any)?.artist_type || '',
    notificationPreference: userProfile?.notification_preference || (userProfile?.phone ? 'phone' : 'email')
  });

  useEffect(() => {
    if (userProfile) {
      fetchStats();
      if (userProfile.user_type === 'artist') {
        fetchGenres();
      }
      
      // Update formData when userProfile changes (especially phone)
      const phoneValue = userProfile.phone
        ? (() => {
            const parsed = parseFullPhone(userProfile.phone);
            return parsed ? { dialCode: parsed.dialCode, localNumber: parsed.localNumber } : { dialCode: getDefaultDialCodeFromBrowser(), localNumber: '' };
          })()
        : { dialCode: getDefaultDialCodeFromBrowser(), localNumber: '' };
      
      setFormData(prev => ({
        ...prev,
        username: userProfile.username || prev.username,
        fullName: userProfile.full_name || prev.fullName,
        email: userProfile.email || prev.email,
        phone: phoneValue,
        notificationPreference: userProfile.notification_preference || (userProfile.phone ? 'phone' : 'email')
      }));
    }
  }, [userProfile]);

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .eq('category', 'music')
        .order('name');
      
      if (error) throw error;
      setAvailableGenres(data || []);
    } catch (err) {
      console.error('Error fetching genres:', err);
    }
  };

  const fetchStats = async () => {
    if (!userProfile) return;
    
    try {
      setLoadingStats(true);
      
      if (userProfile.user_type === 'artist') {
        // Fetch events count for artists
        const { count } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('artist_id', userProfile.id);
        
        setStats(prev => ({ ...prev, eventsCount: count || 0 }));
      } else {
        // Fetch tickets and favorites count for fans
        const [ticketsResult, favoritesResult] = await Promise.all([
          supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userProfile.id)
            .eq('status', 'active'),
          supabase
            .from('favorite_artists')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userProfile.id)
        ]);
        
        setStats(prev => ({
          ...prev,
          ticketsCount: ticketsResult.count || 0,
          favoritesCount: favoritesResult.count || 0
        }));
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `avatars/${userProfile?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const uploadCover = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `covers/${userProfile?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) {
      setError('User profile not found. Please sign in again.');
      return;
    }

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('You must be logged in to update your profile. Please sign in again.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let avatarUrl = formData.avatarUrl;
      let coverUrl = formData.coverUrl;

      if (fileInputRef.current?.files?.[0]) {
        avatarUrl = await uploadAvatar(fileInputRef.current.files[0]);
      }

      if (coverInputRef.current?.files?.[0]) {
        coverUrl = await uploadCover(coverInputRef.current.files[0]);
      }

      // Update auth email if changed and provided (skip for phone-only users)
      if (formData.email && formData.email.trim() !== '' && formData.email !== userProfile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: formData.email.trim()
        });

        if (emailError) throw emailError;
      }

      // Format phone number
      const fullPhone = formData.phone.localNumber.trim() !== ''
        ? formatFullPhone(formData.phone.dialCode, formData.phone.localNumber)
        : null;

      // Validate notification preference based on available contact methods
      let notificationPreference = formData.notificationPreference;
      const hasEmail = formData.email && formData.email.trim() !== '';
      const hasPhone = fullPhone !== null;

      // If user selects 'email' but has no email, switch to 'phone' if available
      if (notificationPreference === 'email' && !hasEmail && hasPhone) {
        notificationPreference = 'phone';
      }
      // If user selects 'phone' but has no phone, switch to 'email' if available
      if (notificationPreference === 'phone' && !hasPhone && hasEmail) {
        notificationPreference = 'email';
      }
      // If neither email nor phone, default to 'email' (will be set when they add contact info)
      if (!hasEmail && !hasPhone) {
        notificationPreference = 'email';
      }

      // Validate required fields
      if (!formData.username || formData.username.trim() === '') {
        throw new Error('Username is required');
      }
      if (!formData.fullName || formData.fullName.trim() === '') {
        throw new Error('Full name is required');
      }

      const updateData: any = {
        username: formData.username.trim(),
        full_name: formData.fullName.trim(),
        phone: fullPhone,
        notification_preference: notificationPreference,
        updated_at: new Date().toISOString()
      };

      // Handle optional fields - only include if they have values
      if (avatarUrl && avatarUrl.trim() !== '') {
        updateData.avatar_url = avatarUrl;
      } else {
        updateData.avatar_url = null;
      }

      if (coverUrl && coverUrl.trim() !== '') {
        updateData.cover_url = coverUrl;
      } else {
        updateData.cover_url = null;
      }

      // Only include email if provided (optional for phone-only users)
      if (formData.email && formData.email.trim() !== '') {
        updateData.email = formData.email.trim();
      } else {
        // Set to null if empty (for phone-only users)
        updateData.email = null;
      }

      // Add artist-specific fields
      if (userProfile.user_type === 'artist') {
        updateData.bio = formData.bio && formData.bio.trim() !== '' ? formData.bio.trim() : null;
        updateData.genres = Array.isArray(formData.genres) && formData.genres.length > 0 ? formData.genres : null;
        updateData.country = formData.country && formData.country.trim() !== '' ? formData.country.trim() : null;
        updateData.region = formData.region && formData.region.trim() !== '' ? formData.region.trim() : null;
        updateData.artist_type = formData.artistType && formData.artistType.trim() !== '' ? formData.artistType.trim() : null;
      }

      console.log('📝 Updating profile with data:', { ...updateData, phone: fullPhone ? '***' : null });
      
      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userProfile.id)
        .select();

      if (error) {
        console.error('❌ Profile update error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        throw new Error(error.message || `Failed to update profile: ${error.code || 'Unknown error'}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Profile update returned no data. Please check your permissions.');
      }

      // Update user profile with returned data
      const updatedProfile = data[0];
      setUserProfile({
        ...userProfile,
        ...updatedProfile
      });

      setSuccess('Profile updated successfully!');
      await fetchStats();
    } catch (err) {
      console.error('❌ Profile update failed:', err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'string' 
        ? err 
        : 'Failed to update profile. Please check the console for details.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userProfile) return;

    // Prevent deleting protected super admin
    const SUPER_ADMIN_ID = import.meta.env.VITE_SUPER_ADMIN_ID || 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8';
    if (userProfile.id === SUPER_ADMIN_ID) {
      setError("Cannot delete the protected super admin account");
      setShowDeleteConfirm(false);
      return;
    }

    // Prevent super admins from self-deleting (they should use admin tools)
    if (userProfile.user_type === 'super_admin') {
      setError("Super admins should contact support to delete their account");
      setShowDeleteConfirm(false);
      return;
    }

    if (deleteConfirmText.toLowerCase() !== 'delete') {
      setError('Please type "DELETE" to confirm');
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("You must be logged in to perform this action");
        setShowDeleteConfirm(false);
        return;
      }

      console.log('🗑️ Attempting to delete account for user:', userProfile.id);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-self`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      console.log('🗑️ Delete account response:', { status: response.status, ok: response.ok, result });

      if (!response.ok) {
        const errorMsg = result.error || result.message || `Failed to delete account (${response.status})`;
        console.error('❌ Delete account error:', errorMsg);
        throw new Error(errorMsg);
      }

      // Sign out and redirect to home
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Error deleting account:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setFormData({ ...formData, avatarUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearCoverPreview = () => {
    setCoverPreviewUrl(null);
    setFormData({ ...formData, coverUrl: '' });
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  const isArtist = userProfile?.user_type === 'artist';

  return (
    <div className="min-h-screen relative overflow-hidden pt-24 pb-12">
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

      <div className="container mx-auto px-6 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-400" />
            My Profile
          </h1>
          <p className="text-gray-400 text-lg">
            {isArtist ? 'Manage your artist profile and events' : 'Manage your account information and preferences'}
          </p>
        </div>

        {/* Stats Cards */}
        {!loadingStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {isArtist ? (
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Events</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                      {stats.eventsCount}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-purple-300" />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Link
                  to="/my-tickets"
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1 group-hover:text-white transition-colors">My Tickets</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                        {stats.ticketsCount}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all">
                      <Ticket className="w-6 h-6 text-purple-300" />
                    </div>
                  </div>
                </Link>
                <Link
                  to="/favorites"
                  className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1 group-hover:text-white transition-colors">Favorite Artists</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                        {stats.favoritesCount}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all">
                      <Heart className="w-6 h-6 text-pink-300" />
                    </div>
                  </div>
                </Link>
              </>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {isArtist ? (
            <>
              <Link
                to="/schedule"
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all">
                    <Calendar className="w-6 h-6 text-purple-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Schedule Event</h3>
                <p className="text-gray-400 text-sm">Create and manage your live events</p>
              </Link>
              <Link
                to="/go-live"
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-pink-500/20 flex items-center justify-center group-hover:from-red-500/30 group-hover:to-pink-500/30 transition-all">
                    <Radio className="w-6 h-6 text-red-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Go Live</h3>
                <p className="text-gray-400 text-sm">Start streaming your live performance</p>
              </Link>
              <Link
                to="/dashboard"
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all">
                    <LayoutDashboard className="w-6 h-6 text-blue-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Dashboard</h3>
                <p className="text-gray-400 text-sm">View analytics and manage your profile</p>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/my-tickets"
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all">
                    <Ticket className="w-6 h-6 text-purple-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">My Tickets</h3>
                <p className="text-gray-400 text-sm">View and manage your event tickets</p>
              </Link>
              <Link
                to="/upcoming-concerts"
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all">
                    <Calendar className="w-6 h-6 text-blue-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Upcoming Concerts</h3>
                <p className="text-gray-400 text-sm">Discover and book tickets</p>
              </Link>
              <Link
                to="/live-events"
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center group-hover:from-red-500/30 group-hover:to-orange-500/30 transition-all">
                    <Radio className="w-6 h-6 text-red-300" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Live Events</h3>
                <p className="text-gray-400 text-sm">Watch live performances now</p>
              </Link>
            </>
          )}
        </div>
      
      <div className="max-w-4xl mx-auto">
        {/* Profile Completion Indicator */}
        {userProfile && (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-purple-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Profile Completion</h3>
                  <p className="text-sm text-gray-400">Complete your profile to get the best experience</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  {(() => {
                    const fields = [
                      formData.username,
                      formData.fullName,
                      formData.email || formData.phone.localNumber.trim() ? true : false, // Email OR phone required
                      formData.avatarUrl,
                      isArtist ? formData.bio : true,
                      isArtist ? formData.country : true,
                      isArtist ? formData.region : true,
                      isArtist ? (formData.genres.length > 0) : true
                    ];
                    const completed = fields.filter(f => f && f !== '').length;
                    return Math.round((completed / fields.length) * 100);
                  })()}%
                </p>
              </div>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all duration-500 rounded-full"
                style={{ 
                  width: `${(() => {
                    const fields = [
                      formData.username,
                      formData.fullName,
                      formData.email || formData.phone.localNumber.trim() ? true : false, // Email OR phone required
                      formData.avatarUrl,
                      isArtist ? formData.bio : true,
                      isArtist ? formData.country : true,
                      isArtist ? formData.region : true,
                      isArtist ? (formData.genres.length > 0) : true
                    ];
                    const completed = fields.filter(f => f && f !== '').length;
                    return Math.round((completed / fields.length) * 100);
                  })()}%` 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Main Profile Card */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
              <p className="text-red-400 flex items-center gap-2">
                <X className="w-5 h-5" />
                {error}
              </p>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/50 backdrop-blur-sm">
              <p className="text-green-400 flex items-center gap-2">
                <Save className="w-5 h-5" />
                {success}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Cover Image (for artists) */}
            {isArtist && (
              <div className="mb-6">
                <label className="block text-gray-300 mb-3 font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                  Cover Image
                </label>
                <div className="relative group">
                  {coverPreviewUrl || formData.coverUrl ? (
                    <div className="relative rounded-xl overflow-hidden">
                      <img
                        src={coverPreviewUrl || formData.coverUrl}
                        alt="Cover preview"
                        className="w-full h-48 object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearCoverPreview}
                        className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full p-2 hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-110"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center">
                      <div className="text-center">
                        <ImageIcon className="w-12 h-12 text-purple-300 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">No cover image</p>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={coverInputRef}
                    onChange={handleCoverChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="mt-3 flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105"
                  >
                    <Upload size={18} />
                    <span>Upload Cover</span>
                  </button>
                </div>
              </div>
            )}

            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-4 pb-6 border-b border-white/10">
              <div className="relative group">
                {previewUrl || formData.avatarUrl ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                    <img
                      src={previewUrl || formData.avatarUrl}
                      alt="Profile preview"
                      className="relative w-32 h-32 rounded-full object-cover ring-4 ring-white/20 group-hover:ring-purple-500/50 transition-all duration-300"
                    />
                    <button
                      type="button"
                      onClick={clearPreview}
                      className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full p-2 hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl hover:scale-110"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-md"></div>
                    <div className="relative w-32 h-32 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-full flex items-center justify-center border-2 border-white/20 backdrop-blur-sm">
                      <User size={40} className="text-purple-300" />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-105"
                >
                  <Upload size={20} />
                  <span>Upload Photo</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400" size={20} />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400" size={20} />
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 mb-2 font-semibold">
                  Email <span className="text-gray-500 text-sm font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400" size={20} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              <div>
                <PhoneInput
                  label="Phone Number"
                  value={formData.phone}
                  onChange={(val) => setFormData({ ...formData, phone: val })}
                  placeholder="Phone number"
                  className="mb-0"
                />
              </div>
            </div>

            {/* Artist-specific fields */}
            {isArtist && (
              <>
                <div>
                  <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-400" />
                    Biography
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                    rows={4}
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                      <Music className="w-5 h-5 text-purple-400" />
                      Artist Type
                    </label>
                    <select
                      value={formData.artistType}
                      onChange={(e) => setFormData({ ...formData, artistType: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-gray-800">Select type</option>
                      <option value="music" className="bg-gray-800">Music</option>
                      <option value="comedy" className="bg-gray-800">Comedy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-purple-400" />
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      placeholder="Your country"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                    <Globe className="w-5 h-5 text-purple-400" />
                    Region
                  </label>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-gray-800">Select region</option>
                    <option value="African" className="bg-gray-800">African</option>
                    <option value="European" className="bg-gray-800">European</option>
                    <option value="American" className="bg-gray-800">American</option>
                    <option value="Asian" className="bg-gray-800">Asian</option>
                    <option value="Maghreb" className="bg-gray-800">Maghreb</option>
                    <option value="Other" className="bg-gray-800">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                    <Music className="w-5 h-5 text-purple-400" />
                    Genres
                  </label>
                  
                  {/* Selected Genres Display */}
                  <div className="mb-3 flex flex-wrap gap-2 min-h-[40px] p-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                    {formData.genres.length > 0 ? (
                      formData.genres.map((genreName: string) => (
                        <span
                          key={genreName}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white rounded-lg text-sm font-semibold"
                        >
                          {genreName}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, genres: formData.genres.filter((g: string) => g !== genreName) });
                            }}
                            className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-sm">No genres selected</span>
                    )}
                  </div>

                  {/* Open Genre Selector Button */}
                  <button
                    type="button"
                    onClick={() => setShowGenreModal(true)}
                    className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-xl text-gray-300 hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    <span>Select Genres</span>
                    {formData.genres.length > 0 && (
                      <span className="ml-auto px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded-full text-xs font-semibold">
                        {formData.genres.length}
                      </span>
                    )}
                  </button>

                  {/* Genre Selection Modal */}
                  {showGenreModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => {
                      setShowGenreModal(false);
                      setGenreSearchQuery('');
                    }}>
                      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-white/10 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/10">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                              Select Music Genres
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setShowGenreModal(false);
                                setGenreSearchQuery('');
                              }}
                              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <X className="w-5 h-5 text-gray-400" />
                            </button>
                          </div>
                          
                          {/* Search Input */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="text"
                              value={genreSearchQuery}
                              onChange={(e) => setGenreSearchQuery(e.target.value)}
                              placeholder="Search genres..."
                              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50"
                              autoFocus
                            />
                          </div>
                          
                          {formData.genres.length > 0 && (
                            <p className="mt-3 text-sm text-gray-400">
                              {formData.genres.length} {formData.genres.length === 1 ? 'genre' : 'genres'} selected
                            </p>
                          )}
                        </div>

                        {/* Genres List */}
                        <div className="flex-1 overflow-y-auto p-6">
                          {availableGenres.filter(genre =>
                            genre.name.toLowerCase().includes(genreSearchQuery.toLowerCase())
                          ).length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {availableGenres.filter(genre =>
                                genre.name.toLowerCase().includes(genreSearchQuery.toLowerCase())
                              ).map((genre) => {
                                const isSelected = formData.genres.includes(genre.name);
                                return (
                                  <button
                                    key={genre.id}
                                    type="button"
                                    onClick={() => {
                                      const newGenres = isSelected
                                        ? formData.genres.filter((g: string) => g !== genre.name)
                                        : [...formData.genres, genre.name];
                                      setFormData({ ...formData, genres: newGenres });
                                    }}
                                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                                      isSelected
                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 hover:border-purple-500/30'
                                    }`}
                                  >
                                    {genre.name}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-center py-12">
                              <p className="text-gray-400">No genres found matching "{genreSearchQuery}"</p>
                            </div>
                          )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setShowGenreModal(false);
                              setGenreSearchQuery('');
                            }}
                            className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowGenreModal(false);
                              setGenreSearchQuery('');
                            }}
                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-white font-semibold transition-all shadow-lg shadow-purple-500/30"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-400" />
                Notification Preference
              </label>
              <div className="relative">
                <select
                  value={formData.notificationPreference}
                  onChange={(e) => setFormData({ ...formData, notificationPreference: e.target.value })}
                  className="w-full pl-4 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="email" className="bg-gray-800">Email</option>
                  <option value="phone" className="bg-gray-800">Phone (SMS)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                loading 
                  ? 'bg-gray-600/50 cursor-not-allowed text-gray-400' 
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </form>

          {/* Delete Account Section */}
          <div className="mt-10 pt-10 border-t border-red-500/30">
            <div className="backdrop-blur-xl bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">Delete Account</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Once you delete your account, there is no going back. This will permanently delete your account, 
                    profile, events, tickets, and all associated data. This action cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setDeleteConfirmText('');
                      setError(null);
                    }}
                    disabled={deleting || userProfile?.user_type === 'super_admin'}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
                      deleting || userProfile?.user_type === 'super_admin'
                        ? 'bg-gray-600/50 cursor-not-allowed text-gray-400'
                        : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40'
                    }`}
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>Delete My Account</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 max-w-md w-full border border-red-500/30 shadow-2xl">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Delete Account</h3>
                <p className="text-gray-400 text-sm">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-300 mb-4">
                Are you absolutely sure you want to delete your account? This will permanently delete:
              </p>
              <ul className="list-disc list-inside text-gray-400 text-sm space-y-2 mb-4">
                <li>Your profile and all personal information</li>
                <li>All your events (if you're an artist)</li>
                <li>All your tickets and purchases</li>
                <li>All your favorites and preferences</li>
                <li>All your activity history</li>
              </ul>
              <p className="text-red-400 font-semibold mb-4">
                Type <span className="font-mono bg-red-500/20 px-2 py-1 rounded">DELETE</span> to confirm:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50"
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                  setError(null);
                }}
                disabled={deleting}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white transition-all font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.toLowerCase() !== 'delete'}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                  deleting || deleteConfirmText.toLowerCase() !== 'delete'
                    ? 'bg-gray-600/50 cursor-not-allowed text-gray-400'
                    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-500/30'
                }`}
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    <span>Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Profile;
