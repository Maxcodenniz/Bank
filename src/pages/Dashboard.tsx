import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { isSuperAdmin as checkSuperAdmin } from '../utils/constants';
import { Camera, Save, User, Upload, X, Phone, CreditCard, Lock, Calendar, Users, Eye, TrendingUp, Activity, Sparkles, BarChart3, Ticket, Music, Globe, MapPin, FileText, Table2, Download, ToggleLeft, ToggleRight, Settings2, MessageSquare, Search, Video, RotateCcw, MonitorPlay, Clock, Gift, Monitor, Link2, Mail, Copy, Check, Bell, UserCog } from 'lucide-react';
import { COUNTRIES, filterCountries } from '../utils/countries';
import { encryptPaymentData, decryptPaymentData } from '../utils/encryption';

const Dashboard: React.FC = () => {
  const { userProfile, setUserProfile } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [genres, setGenres] = useState<any[]>([]);
  const [showGenreModal, setShowGenreModal] = useState(false);
  const [genreSearchQuery, setGenreSearchQuery] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const countryInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [stats, setStats] = useState({
    eventsCount: 0,
    totalViewers: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalArtists: 0,
    totalAdmins: 0,
    totalTickets: 0,
    activeEvents: 0
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    username: userProfile?.username || '',
    fullName: userProfile?.full_name || '',
    avatarUrl: userProfile?.avatar_url || '',
    bio: userProfile?.bio || '',
    country: userProfile?.country || '',
    region: userProfile?.region || 'European',
    selectedGenres: userProfile?.genres || [],
    bankIban: userProfile?.bank_iban || '',
    mobilePaymentNumber: userProfile?.mobile_payment_number || '',
    mobilePaymentName: userProfile?.mobile_payment_name || '',
  });

  const isArtist = userProfile?.user_type === 'artist';
  const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
  const isSuperAdmin = checkSuperAdmin(userProfile?.id, userProfile?.user_type);
  const [appConfig, setAppConfig] = useState({
    artist_login_enabled: true,
    live_chat_enabled: true,
    recording_enabled: true,
    artist_recordings_visible: true,
    payment_info_visible: true,
    live_notifications_fans_enabled: true,
    live_notifications_artists_enabled: true,
    live_notifications_admins_enabled: true,
    advertisements_home_enabled: true,
    visitor_counter_visible: true,
    visitor_count_base: 0,
    gift_enabled: true,
    creator_studio_analytics_enabled: true,
    platform_revenue_percentage: 30,
    artist_revenue_percentage: 70,
    desktop_mode_on_mobile: false,
    live_event_notifications_enabled: true,
    live_event_email_notify_admins: true,
    live_event_email_notify_artists: true,
    live_event_email_notify_fans: true,
    event_scheduled_phone_notify_followers: false,
    event_scheduled_phone_notify_all: false,
    live_event_started_phone_notify_followers: false,
    live_event_started_phone_notify_all: false,
    auth_gate_enabled: true,
    artist_management_communication_enabled: true
  });
  const [platformRevenuePercentage, setPlatformRevenuePercentage] = useState<string>('30');
  const [artistRevenuePercentage, setArtistRevenuePercentage] = useState<string>('70');
  const [visitorAnalytics, setVisitorAnalytics] = useState<any>(null);
  const [loadingVisitorAnalytics, setLoadingVisitorAnalytics] = useState(false);
  const [visitorCountBase, setVisitorCountBase] = useState<string>('0');
  const [resettingVisitorCount, setResettingVisitorCount] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  
  // Free Access Link Generator state
  const [availableEvents, setAvailableEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Fetch available events for free access link generator
  useEffect(() => {
    if (isSuperAdmin) {
      fetchAvailableEvents();
    }
  }, [isSuperAdmin]);

  const fetchAvailableEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          start_time,
          status,
          profiles:artist_id (
            full_name,
            username
          )
        `)
        .order('start_time', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAvailableEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  // Refresh user profile on mount to ensure user_type is up to date (important after role changes)
  useEffect(() => {
    const refreshProfile = async () => {
      const currentProfile = userProfile;
      if (currentProfile?.id) {
        try {
          const { data: freshProfile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentProfile.id)
            .single();
          
          if (!error && freshProfile && freshProfile.user_type !== currentProfile.user_type) {
            console.log('🔄 Profile user_type changed, updating store:', {
              old: currentProfile.user_type,
              new: freshProfile.user_type
            });
            setUserProfile(freshProfile);
          }
        } catch (err) {
          console.warn('Could not refresh profile:', err);
        }
      }
    };
    
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount


  useEffect(() => {
    if (userProfile?.artist_type) {
      fetchGenres();
    }
    // Set initial preview if avatar exists
    if (userProfile?.avatar_url) {
      setPreviewUrl(userProfile.avatar_url);
    }
    // Sync formData with userProfile when it changes (especially after login)
    if (userProfile) {
      // Ensure genres is properly handled as an array
      const profileGenres = (userProfile as any)?.genres;
      let genresArray: string[] = [];
      
      if (Array.isArray(profileGenres)) {
        genresArray = profileGenres.filter(g => g && g.trim() !== '');
      } else if (profileGenres) {
        // Handle case where it might be a single string or other format
        genresArray = [profileGenres].filter(g => g && g.trim() !== '');
      }
      
      console.log('Syncing formData with userProfile - genres:', genresArray, 'from profile:', profileGenres);
      
      setFormData(prev => ({
        ...prev,
        username: userProfile.username || prev.username,
        fullName: userProfile.full_name || prev.fullName,
        avatarUrl: userProfile.avatar_url || prev.avatarUrl,
        bio: (userProfile as any)?.bio || prev.bio,
        country: (userProfile as any)?.country || prev.country,
        region: (userProfile as any)?.region || prev.region,
        selectedGenres: genresArray.length > 0 ? genresArray : prev.selectedGenres,
        bankIban: (userProfile as any)?.bank_iban_encrypted 
          ? decryptPaymentData((userProfile as any).bank_iban_encrypted) || prev.bankIban
          : (userProfile as any)?.bank_iban || prev.bankIban,
        mobilePaymentNumber: (userProfile as any)?.mobile_payment_number_encrypted
          ? decryptPaymentData((userProfile as any).mobile_payment_number_encrypted) || prev.mobilePaymentNumber
          : (userProfile as any)?.mobile_payment_number || prev.mobilePaymentNumber,
        mobilePaymentName: (userProfile as any)?.mobile_payment_name_encrypted
          ? decryptPaymentData((userProfile as any).mobile_payment_name_encrypted) || prev.mobilePaymentName
          : (userProfile as any)?.mobile_payment_name || prev.mobilePaymentName,
      }));
    }
    fetchStats();
    if (isSuperAdmin) {
      fetchAppConfig();
      fetchVisitorAnalytics();
    } else if (isAdmin) {
      fetchVisitorAnalytics();
    } else if (isArtist) {
      // Artists need to fetch payment_info_visible config
      fetchPaymentInfoVisibility();
    }
  }, [userProfile]);

  // Filter countries - only show results after typing 2+ characters
  const filteredCountries = filterCountries(countrySearch);

  // Close country dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(event.target as Node) &&
        countryInputRef.current &&
        !countryInputRef.current.contains(event.target as Node)
      ) {
        setShowCountryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAppConfig = async () => {
    try {
      setLoadingConfig(true);
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
          'artist_login_enabled', 
          'live_chat_enabled', 
          'recording_enabled', 
          'artist_recordings_visible', 
          'payment_info_visible',
          'live_notifications_fans_enabled',
          'live_notifications_artists_enabled',
          'live_notifications_admins_enabled',
          'advertisements_home_enabled',
          'visitor_counter_visible',
          'visitor_count_base',
          'gift_enabled',
          'creator_studio_analytics_enabled',
          'platform_revenue_percentage',
          'artist_revenue_percentage',
          'desktop_mode_on_mobile',
          'live_event_notifications_enabled',
          'live_event_email_notify_admins',
          'live_event_email_notify_artists',
          'live_event_email_notify_fans',
          'event_scheduled_phone_notify_followers',
          'event_scheduled_phone_notify_all',
          'live_event_started_phone_notify_followers',
          'live_event_started_phone_notify_all',
          'auth_gate_enabled',
          'artist_management_communication_enabled'
        ]);

      if (error) throw error;

      const config: any = {
        artist_login_enabled: true,
        live_chat_enabled: true,
        recording_enabled: true,
        artist_recordings_visible: true,
        payment_info_visible: true,
        live_notifications_fans_enabled: true,
        live_notifications_artists_enabled: true,
        live_notifications_admins_enabled: true,
        advertisements_home_enabled: true,
        visitor_counter_visible: true,
        visitor_count_base: 0,
        gift_enabled: true,
        creator_studio_analytics_enabled: true,
        platform_revenue_percentage: 30,
        artist_revenue_percentage: 70,
        desktop_mode_on_mobile: false,
        live_event_notifications_enabled: true,
        live_event_email_notify_admins: true,
        live_event_email_notify_artists: true,
        live_event_email_notify_fans: true,
        event_scheduled_phone_notify_followers: false,
        event_scheduled_phone_notify_all: false,
        live_event_started_phone_notify_followers: false,
        live_event_started_phone_notify_all: false,
        auth_gate_enabled: true,
        artist_management_communication_enabled: true
      };

      data?.forEach(item => {
        const isEnabled = item.value === true || item.value === 'true';
        if (item.key === 'artist_login_enabled') {
          config.artist_login_enabled = isEnabled;
        } else if (item.key === 'live_chat_enabled') {
          config.live_chat_enabled = isEnabled;
        } else if (item.key === 'recording_enabled') {
          config.recording_enabled = isEnabled;
        } else if (item.key === 'artist_recordings_visible') {
          config.artist_recordings_visible = isEnabled;
        } else if (item.key === 'payment_info_visible') {
          config.payment_info_visible = isEnabled;
        } else if (item.key === 'live_notifications_fans_enabled') {
          config.live_notifications_fans_enabled = isEnabled;
        } else if (item.key === 'live_notifications_artists_enabled') {
          config.live_notifications_artists_enabled = isEnabled;
        } else if (item.key === 'live_notifications_admins_enabled') {
          config.live_notifications_admins_enabled = isEnabled;
        } else if (item.key === 'advertisements_home_enabled') {
          config.advertisements_home_enabled = isEnabled;
        } else if (item.key === 'visitor_counter_visible') {
          config.visitor_counter_visible = isEnabled;
        } else if (item.key === 'visitor_count_base') {
          // Parse the base count (can be number or string)
          const baseValue = typeof item.value === 'number' ? item.value : parseInt(item.value as string, 10);
          config.visitor_count_base = isNaN(baseValue) ? 0 : baseValue;
          setVisitorCountBase(baseValue.toString());
        } else if (item.key === 'gift_enabled') {
          config.gift_enabled = isEnabled;
        } else if (item.key === 'creator_studio_analytics_enabled') {
          config.creator_studio_analytics_enabled = isEnabled;
        } else if (item.key === 'platform_revenue_percentage') {
          const percentageValue = typeof item.value === 'number' ? item.value : parseFloat(item.value as string);
          config.platform_revenue_percentage = isNaN(percentageValue) ? 30 : percentageValue;
          setPlatformRevenuePercentage(percentageValue.toString());
        } else if (item.key === 'artist_revenue_percentage') {
          const percentageValue = typeof item.value === 'number' ? item.value : parseFloat(item.value as string);
          config.artist_revenue_percentage = isNaN(percentageValue) ? 70 : percentageValue;
          setArtistRevenuePercentage(percentageValue.toString());
        } else if (item.key === 'desktop_mode_on_mobile') {
          config.desktop_mode_on_mobile = isEnabled;
        } else if (item.key === 'live_event_notifications_enabled') {
          config.live_event_notifications_enabled = isEnabled;
        } else if (item.key === 'live_event_email_notify_admins') {
          config.live_event_email_notify_admins = isEnabled;
        } else if (item.key === 'live_event_email_notify_artists') {
          config.live_event_email_notify_artists = isEnabled;
        } else if (item.key === 'live_event_email_notify_fans') {
          config.live_event_email_notify_fans = isEnabled;
        } else if (item.key === 'event_scheduled_phone_notify_followers') {
          config.event_scheduled_phone_notify_followers = isEnabled;
        } else if (item.key === 'event_scheduled_phone_notify_all') {
          config.event_scheduled_phone_notify_all = isEnabled;
        } else if (item.key === 'live_event_started_phone_notify_followers') {
          config.live_event_started_phone_notify_followers = isEnabled;
        } else if (item.key === 'live_event_started_phone_notify_all') {
          config.live_event_started_phone_notify_all = isEnabled;
        } else if (item.key === 'auth_gate_enabled') {
          config.auth_gate_enabled = isEnabled;
        } else if (item.key === 'artist_management_communication_enabled') {
          config.artist_management_communication_enabled = isEnabled;
        }
      });

      setAppConfig(config);
    } catch (err) {
      console.error('Error fetching app config:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchPaymentInfoVisibility = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'payment_info_visible')
        .single();

      if (error) {
        // If config doesn't exist, default to true
        setAppConfig(prev => ({ ...prev, payment_info_visible: true }));
        return;
      }

      const isVisible = data?.value === true || data?.value === 'true';
      setAppConfig(prev => ({ ...prev, payment_info_visible: isVisible }));
    } catch (err) {
      console.error('Error fetching payment info visibility:', err);
      // Default to true on error
      setAppConfig(prev => ({ ...prev, payment_info_visible: true }));
    }
  };

  const fetchVisitorAnalytics = async () => {
    try {
      setLoadingVisitorAnalytics(true);
      const { data, error } = await supabase.rpc('get_visitor_analytics');
      
      if (error) throw error;
      
      setVisitorAnalytics(data);
    } catch (err) {
      console.error('Error fetching visitor analytics:', err);
    } finally {
      setLoadingVisitorAnalytics(false);
    }
  };

  const updateVisitorCountBase = async (newBase: number) => {
    try {
      setLoadingConfig(true);
      setError(null);
      
      const { error } = await supabase.rpc('update_app_config', {
        config_key: 'visitor_count_base',
        config_value: newBase
      });

      if (error) throw error;

      setAppConfig(prev => ({ ...prev, visitor_count_base: newBase }));
      setVisitorCountBase(newBase.toString());
      setSuccess('Visitor count base updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating visitor count base:', err);
      setError(err.message || 'Failed to update visitor count base');
    } finally {
      setLoadingConfig(false);
    }
  };

  const resetVisitorCount = async () => {
    if (!confirm('Are you sure you want to reset the visitor count? This will set the base to the current total and preserve the displayed number.')) {
      return;
    }

    try {
      setResettingVisitorCount(true);
      setError(null);

      // Get current total unique visitors
      const { data: currentTotal, error: countError } = await supabase.rpc('get_total_visitor_count');
      
      if (countError) throw countError;

      // Reset: set base to current total (preserves the displayed number)
      const newBase = currentTotal || 0;
      
      const { data: resetData, error: resetError } = await supabase.rpc('reset_visitor_count', {
        new_base_count: newBase
      });

      if (resetError) throw resetError;

      setAppConfig(prev => ({ ...prev, visitor_count_base: newBase }));
      setVisitorCountBase(newBase.toString());
      setSuccess(`Visitor count reset! Base set to ${newBase.toLocaleString()}. The displayed count will remain the same.`);
      setTimeout(() => setSuccess(null), 5000);
      
      // Refresh analytics
      if (isAdmin) {
        fetchVisitorAnalytics();
      }
    } catch (err: any) {
      console.error('Error resetting visitor count:', err);
      setError(err.message || 'Failed to reset visitor count');
    } finally {
      setResettingVisitorCount(false);
    }
  };

  const updateConfig = async (key: string, value: boolean | number) => {
    try {
      setLoadingConfig(true);
      setError(null);
      
      // Convert value to JSONB format
      const jsonbValue = typeof value === 'boolean' 
        ? value 
        : typeof value === 'number'
        ? value
        : value;
      
      // Try using RPC function first (more reliable)
      const { error: rpcError } = await supabase.rpc('update_app_config', {
        config_key: key,
        config_value: jsonbValue
      });

      if (rpcError) {
        // Fallback to direct update if RPC function doesn't exist
        console.warn('RPC function failed, trying direct update:', rpcError);
        
        // First try to update existing record
        const { data: existing } = await supabase
          .from('app_config')
          .select('id')
          .eq('key', key)
          .single();

        let error;
        
        if (existing) {
          // Update existing record - don't specify id, let database handle it
          const { error: updateError } = await supabase
            .from('app_config')
            .update({ value: value as any })
            .eq('key', key);
          error = updateError;
        } else {
          // Insert new record (description is optional)
          // Don't specify id - let the database auto-generate it
          const insertData: any = {
            key,
            value: value as any
          };
          
          const { error: insertError } = await supabase
            .from('app_config')
            .insert(insertData);
          error = insertError;
        }

        if (error) {
          console.error('Config update error:', error);
          throw new Error(error.message || `Failed to update ${key}. Please run the database migration.`);
        }
      }

      setAppConfig(prev => ({ ...prev, [key]: value }));
      const keyLabels: { [key: string]: string } = {
        'artist_login_enabled': 'Artist login',
        'live_chat_enabled': 'Live chat',
        'recording_enabled': 'Recording',
        'artist_recordings_visible': 'Artist recordings visibility',
        'payment_info_visible': 'Payment information section',
        'live_notifications_fans_enabled': 'Live notifications for fans',
        'live_notifications_artists_enabled': 'Live notifications for artists',
        'live_notifications_admins_enabled': 'Live notifications for admins',
        'gift_enabled': 'Gift button',
        'creator_studio_analytics_enabled': 'Creator Studio Analytics',
        'desktop_mode_on_mobile': 'Desktop mode on mobile',
        'auth_gate_enabled': 'Auth gate pop-up',
        'artist_management_communication_enabled': 'Communication (Artist Management)'
      };
      
      // Update appConfig state with the new value
      setAppConfig(prev => ({
        ...prev,
        [key]: value
      }));
      
      setSuccess(`${keyLabels[key] || key} ${value ? 'enabled' : 'disabled'} successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating config:', err);
      setError(err?.message || `Failed to update ${key}. Please ensure you have super admin permissions and the migration has been run.`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoadingConfig(false);
    }
  };


  const fetchStats = async () => {
    if (!userProfile) return;
    
    try {
      setLoadingStats(true);
      
      if (isArtist) {
        // Artist stats
        const { data: events } = await supabase
          .from('events')
          .select('id, viewer_count, price, status, start_time, duration')
          .eq('artist_id', userProfile.id);

        const eventsList = events || [];
        const totalViewers = eventsList.reduce((sum, e) => sum + (e.viewer_count || 0), 0);
        const activeEvents = eventsList.filter(e => e.status === 'live' || e.status === 'scheduled').length;
        
        // Filter upcoming events (not ended)
        const now = new Date();
        const upcomingEvents = eventsList.filter(e => {
          if (e.status === 'ended') return false;
          const eventStart = new Date(e.start_time);
          const eventEnd = new Date(eventStart.getTime() + (e.duration || 0) * 60000);
          return now <= eventEnd;
        });
        
        // Calculate tickets sold for upcoming concerts only
        const upcomingEventIds = upcomingEvents.map(e => e.id);
        let ticketsSold = 0;
        
        if (upcomingEventIds.length > 0) {
          const { data: tickets } = await supabase
            .from('tickets')
            .select('id')
            .in('event_id', upcomingEventIds)
            .eq('status', 'active');
          
          ticketsSold = tickets?.length || 0;
        }

        setStats({
          eventsCount: eventsList.length,
          totalViewers,
          totalRevenue: ticketsSold, // Store tickets sold in totalRevenue field for artists
          activeEvents,
          totalUsers: 0,
          totalArtists: 0,
          totalAdmins: 0,
          totalTickets: ticketsSold
        });
      } else if (isAdmin) {
        // Admin stats
        const [usersResult, artistsResult, adminsResult, eventsResult] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'artist'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).in('user_type', ['global_admin', 'super_admin']),
          supabase.from('events').select('id, status')
        ]);

        const eventsList = eventsResult.data || [];
        const activeEvents = eventsList.filter(e => e.status === 'live' || e.status === 'scheduled').length;

        const { data: allTickets } = await supabase
          .from('tickets')
          .select(`
            id,
            events:event_id (
              price
            )
          `)
          .eq('status', 'active');

        const totalRevenue = allTickets?.reduce((sum, t) => {
          const price = (t.events as any)?.price || 0;
          return sum + price;
        }, 0) || 0;

        setStats({
          eventsCount: eventsList.length,
          totalViewers: 0,
          totalRevenue,
          activeEvents,
          totalUsers: usersResult.count || 0,
          totalArtists: artistsResult.count || 0,
          totalAdmins: adminsResult.count || 0,
          totalTickets: allTickets?.length || 0
        });
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const generateFreeAccessLink = async () => {
    if (!selectedEventId || !userEmail) {
      setError('Please select an event and enter a user email');
      setTimeout(() => setError(null), 5000);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail.trim())) {
      setError('Please enter a valid email address');
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      setGeneratingLink(true);
      setError(null);

      // Create a special admin-granted ticket (or use existing one)
      // First check if ticket already exists
      const { data: existingTicket } = await supabase
        .from('tickets')
        .select('id')
        .eq('event_id', selectedEventId)
        .ilike('email', userEmail.trim().toLowerCase())
        .eq('status', 'active')
        .maybeSingle();

      let ticketCreated = false;
      if (!existingTicket) {
        // Only create if it doesn't exist
        const { error: ticketError } = await supabase
          .from('tickets')
          .insert({
            event_id: selectedEventId,
            email: userEmail.trim().toLowerCase(),
            status: 'active',
            // Add metadata to indicate this is admin-granted
            stripe_payment_id: 'admin_granted',
            stripe_session_id: `admin_${Date.now()}`,
          });

        if (ticketError) {
          console.error('Error creating admin-granted ticket:', ticketError);
          // Don't throw - we can still generate the link even if ticket creation fails
          // The user might already have a ticket or there might be a constraint issue
          console.warn('Ticket creation failed, but continuing with link generation');
        } else {
          ticketCreated = true;
        }
      } else {
        console.log('Ticket already exists for this user/event');
      }

      // Generate the access link - always use production URL, not localhost
      // Priority: VITE_SITE_URL env var > current origin if production > fallback production URL
      let siteUrl = import.meta.env.VITE_SITE_URL;
      
      if (!siteUrl) {
        // If no env var, check if we're already on production (Vercel, Netlify, etc.)
        const isProduction = !window.location.hostname.includes('localhost') && 
                            !window.location.hostname.includes('127.0.0.1') &&
                            !window.location.hostname.includes('192.168') &&
                            (window.location.hostname.includes('vercel.app') || 
                             window.location.hostname.includes('netlify.app') ||
                             window.location.hostname.includes('dreemystar'));
        
        if (isProduction) {
          siteUrl = window.location.origin;
        } else {
          // Fallback to production URL - use Vercel URL since that's where it's deployed
          siteUrl = 'https://dreemystar.vercel.app';
        }
      }
      
      // Ensure we never use localhost in the generated link
      if (siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1')) {
        siteUrl = 'https://dreemystar.vercel.app';
      }
      
      const accessLink = `${siteUrl}/watch/${selectedEventId}?email=${encodeURIComponent(userEmail.trim())}`;
      
      console.log('🔗 Generated access link:', {
        siteUrl,
        hostname: window.location.hostname,
        accessLink,
        hasEnvVar: !!import.meta.env.VITE_SITE_URL
      });

      // Get event details for logging
      const selectedEvent = availableEvents.find(e => e.id === selectedEventId);

      // Log admin action to analytics (admin-granted tickets will show in ticket purchases)
      // The ticket itself with stripe_payment_id='admin_granted' will appear in analytics
      // We can also add a note in the ticket metadata for tracking
      if (existingTicket) {
        // Update existing ticket to mark it as admin-granted
        await supabase
          .from('tickets')
          .update({
            stripe_payment_id: 'admin_granted',
            stripe_session_id: `admin_${Date.now()}`,
          })
          .eq('id', existingTicket.id);
      }
      
      setGeneratedLink(accessLink);
      setSuccess('Free access link generated successfully!');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error generating free access link:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate access link');
      setTimeout(() => setError(null), 5000);
    } finally {
      setGeneratingLink(false);
    }
  };

  const sendAccessLinkEmail = async () => {
    if (!generatedLink || !userEmail || !selectedEventId) {
      setError('Please generate a link first');
      setTimeout(() => setError(null), 5000);
      return;
    }

    try {
      setSendingEmail(true);
      setError(null);

      // Get event details
      const selectedEvent = availableEvents.find(e => e.id === selectedEventId);
      if (!selectedEvent) {
        throw new Error('Event not found');
      }

      // Call Edge Function to send email using direct fetch
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) {
          throw new Error('Supabase URL not configured');
        }

        // Get the current session token for authentication
        const { data: { session } } = await supabase.auth.getSession();
        const authToken = session?.access_token;

        const functionUrl = `${supabaseUrl}/functions/v1/send-free-access-link`;
        
        console.log('📧 Calling Edge Function:', functionUrl);
        console.log('📧 Request payload:', {
          email: userEmail.trim(),
          eventId: selectedEventId,
          eventTitle: selectedEvent.title,
          accessLink: generatedLink,
        });

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()}`,
          },
          body: JSON.stringify({
            email: userEmail.trim(),
            eventId: selectedEventId,
            eventTitle: selectedEvent.title,
            accessLink: generatedLink,
          }),
        });

        console.log('📧 Response status:', response.status);
        console.log('📧 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Edge Function error:', errorText);
          
          let errorMessage = 'Failed to send email';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorJson.message || errorMessage;
          } catch (e) {
            errorMessage = errorText || errorMessage;
          }

          if (response.status === 404) {
            throw new Error('Email function not found. Please ensure send-free-access-link is deployed.');
          } else if (response.status === 401 || response.status === 403) {
            throw new Error('Authentication failed. Please try again.');
          } else {
            throw new Error(errorMessage);
          }
        }

        const responseData = await response.json();
        console.log('✅ Email sent successfully:', responseData);

        setSuccess('Access link sent successfully to ' + userEmail);
        setTimeout(() => setSuccess(null), 5000);
        
        // Reset form
        setUserEmail('');
        setSelectedEventId('');
        setGeneratedLink('');
      } catch (functionErr: any) {
        // If Edge Function fails, provide helpful error message
        console.error('Error calling Edge Function:', functionErr);
        
        const errorMsg = functionErr.message || 'Unknown error';
        setError(`Failed to send email: ${errorMsg}. You can copy the link above and send it manually.`);
        setTimeout(() => setError(null), 8000);
      }
    } catch (err) {
      console.error('Error sending access link email:', err);
      setError(err instanceof Error ? err.message : 'Failed to send email. You can copy the link above and send it manually.');
      setTimeout(() => setError(null), 8000);
    } finally {
      setSendingEmail(false);
    }
  };

  const copyLinkToClipboard = async () => {
    if (!generatedLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleResetTicketsSold = async () => {
    if (!userProfile || !isArtist) return;

    // Refresh stats - the count automatically only includes upcoming concerts
    // So "resetting" is just refreshing the display
    try {
      await fetchStats();
      setSuccess('Ticket count refreshed');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error refreshing tickets sold:', err);
      setError('Failed to refresh ticket count');
    }
  };

  // Listen for platform refresh event (after fetchStats is defined)
  useEffect(() => {
    const handlePlatformRefresh = () => {
      console.log('🔄 Platform refresh triggered - refreshing dashboard data');
      fetchStats();
      if (isAdmin) {
        fetchVisitorAnalytics();
      }
    };

    window.addEventListener('platformRefresh', handlePlatformRefresh);
    return () => window.removeEventListener('platformRefresh', handlePlatformRefresh);
  }, [isAdmin, userProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track form changes
  const handleFormChange = (newFormData: typeof formData) => {
    setFormData(newFormData);
    setIsFormDirty(true);
    setSuccess(null); // Clear success message when form changes
  };

  const fetchGenres = async () => {
    try {
      const { data, error } = await supabase
        .from('genres')
        .select('*')
        .eq('category', 'music')
        .order('name');

      if (error) throw error;
      setGenres(data || []);
    } catch (err) {
      console.error('Error fetching genres:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      setIsFormDirty(true);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `avatars/${userProfile?.id}/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('profiles')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handlePaymentVerification = async () => {
    try {
      setLoading(true);
      setError(null);

      // Generate and send verification code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30); // Code expires in 30 minutes

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          payment_verification_code: code,
          payment_verification_expires_at: expiresAt.toISOString()
        })
        .eq('id', userProfile?.id);

      if (updateError) throw updateError;

      // Send verification code via email
      const { error: emailError } = await supabase.auth.resetPasswordForEmail(
        userProfile?.email || '',
        {
          data: {
            type: 'payment_verification',
            code
          }
        }
      );

      if (emailError) throw emailError;

      setIsVerifying(true);
      setSuccess('Verification code sent to your email');
    } catch (err) {
      setError('Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const verifyPaymentUpdate = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: verifyError } = await supabase
        .from('profiles')
        .select('payment_verification_code, payment_verification_expires_at')
        .eq('id', userProfile?.id)
        .single();

      if (verifyError) throw verifyError;

      if (!data || 
          data.payment_verification_code !== verificationCode ||
          new Date(data.payment_verification_expires_at) < new Date()) {
        throw new Error('Invalid or expired verification code');
      }

      // Clear verification code and update payment info
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          bank_iban: formData.bankIban,
          mobile_payment_number: formData.mobilePaymentNumber,
          mobile_payment_name: formData.mobilePaymentName,
          payment_verification_code: null,
          payment_verification_expires_at: null,
          payment_info_verified: true
        })
        .eq('id', userProfile?.id);

      if (updateError) throw updateError;

      setSuccess('Payment information updated successfully');
      setIsVerifying(false);
      setVerificationCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let avatarUrl = formData.avatarUrl;

      // Handle file upload if a new file is selected
      if (fileInputRef.current?.files?.[0]) {
        avatarUrl = await uploadAvatar(fileInputRef.current.files[0]);
      }

      // Ensure genres is a proper array
      const genresArray = Array.isArray(formData.selectedGenres) 
        ? formData.selectedGenres.filter(g => g && g.trim() !== '') 
        : [];
      
      console.log('Saving genres:', genresArray, 'Count:', genresArray.length);

      // Prepare update data
      const updateData: any = {
        username: formData.username,
        full_name: formData.fullName,
        avatar_url: avatarUrl,
        bio: formData.bio,
        country: formData.country,
        region: formData.region,
        genres: genresArray,
      };

      // Encrypt payment data if provided
      if (formData.bankIban && formData.bankIban.trim() !== '') {
        const encryptedIban = encryptPaymentData(formData.bankIban);
        if (encryptedIban) {
          updateData.bank_iban_encrypted = encryptedIban;
          updateData.bank_iban = null; // Clear plain text
          updateData.payment_data_encrypted = true;
        }
      } else {
        // If IBAN is empty, clear both encrypted and plain text fields
        updateData.bank_iban_encrypted = null;
        updateData.bank_iban = null;
      }

      if (formData.mobilePaymentNumber && formData.mobilePaymentNumber.trim() !== '') {
        const encryptedNumber = encryptPaymentData(formData.mobilePaymentNumber);
        if (encryptedNumber) {
          updateData.mobile_payment_number_encrypted = encryptedNumber;
          updateData.mobile_payment_number = null; // Clear plain text
          updateData.payment_data_encrypted = true;
        }
      } else {
        updateData.mobile_payment_number_encrypted = null;
        updateData.mobile_payment_number = null;
      }

      if (formData.mobilePaymentName && formData.mobilePaymentName.trim() !== '') {
        const encryptedName = encryptPaymentData(formData.mobilePaymentName);
        if (encryptedName) {
          updateData.mobile_payment_name_encrypted = encryptedName;
          updateData.mobile_payment_name = null; // Clear plain text
          updateData.payment_data_encrypted = true;
        }
      } else {
        updateData.mobile_payment_name_encrypted = null;
        updateData.mobile_payment_name = null;
      }

      const { error, data } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userProfile.id)
        .select('genres')
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        throw error;
      }
      
      console.log('Genres saved, response from DB:', data?.genres);

      // Fetch updated profile from database to ensure we have the latest data
      const { data: updatedProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userProfile.id)
        .single();

      if (fetchError) {
        console.error('Error fetching updated profile:', fetchError);
        // Fallback to local update if fetch fails
        setUserProfile({
          ...userProfile,
          username: formData.username,
          full_name: formData.fullName,
          avatar_url: avatarUrl,
          bio: formData.bio,
          country: formData.country,
          region: formData.region,
          genres: genresArray,
        } as any);
      } else {
        console.log('Fetched profile genres from DB:', updatedProfile?.genres, 'Type:', typeof updatedProfile?.genres, 'Is Array:', Array.isArray(updatedProfile?.genres));
        // Ensure genres is an array
        const fetchedGenres = Array.isArray(updatedProfile.genres) 
          ? updatedProfile.genres 
          : (updatedProfile.genres ? [updatedProfile.genres] : []);
        
        console.log('Processed genres array:', fetchedGenres, 'Count:', fetchedGenres.length);
        
        // Use the fresh data from database
        setUserProfile({
          ...updatedProfile,
          genres: fetchedGenres
        } as any);
        // Also update formData to match the fetched data
        setFormData(prev => ({
          ...prev,
          selectedGenres: fetchedGenres,
        }));
      }

      setSuccess('Profile updated successfully!');
      setIsFormDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const clearPreview = () => {
    setPreviewUrl(null);
    setFormData({ ...formData, avatarUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsFormDirty(true);
  };

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
            {isSuperAdmin ? 'Super Admin Dashboard' : isAdmin ? 'Admin Dashboard' : 'Artist Dashboard'}
          </h1>
          <p className="text-gray-400 text-lg">Manage your {isAdmin ? 'platform' : 'profile'} and track your performance</p>
        </div>

        {/* Stats Cards */}
        {!loadingStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-10">
            {isArtist ? (
              <>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
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
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Total Viewers</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                        {stats.totalViewers.toLocaleString()}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Eye className="w-6 h-6 text-purple-300" />
                    </div>
                  </div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-400 text-sm">Tickets Sold (Upcoming)</p>
                        {stats.totalRevenue > 0 && (
                          <button
                            onClick={handleResetTicketsSold}
                            className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                            title="Refresh ticket count (only counts upcoming concerts)"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Refresh
                          </button>
                        )}
                      </div>
                      <p className="text-3xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">
                        {stats.totalRevenue}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                      <Ticket className="w-6 h-6 text-green-300" />
                    </div>
                  </div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Active Events</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                        {stats.activeEvents}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Activity className="w-6 h-6 text-blue-300" />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Total Users</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                        {stats.totalUsers}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-300" />
                    </div>
                  </div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Total Artists</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                        {stats.totalArtists}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                      <Music className="w-6 h-6 text-purple-300" />
                    </div>
                  </div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Total Events</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                        {stats.eventsCount}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-300" />
                    </div>
                  </div>
                </div>
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Total Revenue</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">
                        €{stats.totalRevenue.toFixed(2)}
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-300" />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Visitor Analytics Section for Admins */}
        {isAdmin && (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                <Eye className="w-5 h-5 text-yellow-300" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                Visitor Analytics
              </h2>
            </div>

            {loadingVisitorAnalytics ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                <p className="text-gray-400 mt-4">Loading analytics...</p>
              </div>
            ) : visitorAnalytics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">Total Visitors</p>
                    <Eye className="w-5 h-5 text-yellow-400" />
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {visitorAnalytics.total?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">Today</p>
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-3xl font-bold text-green-400">
                    {visitorAnalytics.today?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">This Week</p>
                    <Activity className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-3xl font-bold text-blue-400">
                    {visitorAnalytics.thisWeek?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">This Month</p>
                    <BarChart3 className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-3xl font-bold text-purple-400">
                    {visitorAnalytics.thisMonth?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">Active Now</p>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <p className="text-3xl font-bold text-green-400">
                    {visitorAnalytics.active?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">Total Page Views</p>
                    <Globe className="w-5 h-5 text-cyan-400" />
                  </div>
                  <p className="text-3xl font-bold text-cyan-400">
                    {visitorAnalytics.totalPageViews?.toLocaleString() || 0}
                  </p>
                </div>
                <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-400 text-sm">Avg Session</p>
                    <Clock className="w-5 h-5 text-orange-400" />
                  </div>
                  <p className="text-3xl font-bold text-orange-400">
                    {visitorAnalytics.avgSessionDuration 
                      ? `${Math.floor(visitorAnalytics.avgSessionDuration / 60)}m ${visitorAnalytics.avgSessionDuration % 60}s`
                      : '0s'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">No analytics data available</p>
              </div>
            )}
          </div>
        )}

        {/* Super Admin Feature Toggles */}
        {isSuperAdmin && (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl mb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-purple-300" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                Feature Controls
              </h2>
            </div>

            <div className="space-y-6">
              {/* Artist Login Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Artist Login</h3>
                    <p className="text-sm text-gray-400">Enable or disable artist signup option</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('artist_login_enabled', !appConfig.artist_login_enabled)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.artist_login_enabled
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.artist_login_enabled ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.artist_login_enabled ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Live Chat Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Live Chat</h3>
                    <p className="text-sm text-gray-400">Enable or disable chat in live events</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('live_chat_enabled', !appConfig.live_chat_enabled)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.live_chat_enabled
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.live_chat_enabled ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.live_chat_enabled ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Recording Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                    <Video className="w-6 h-6 text-orange-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Recording</h3>
                    <p className="text-sm text-gray-400">Enable or disable recording functionality in live streams</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('recording_enabled', !appConfig.recording_enabled)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.recording_enabled
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.recording_enabled ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.recording_enabled ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Artist Recordings Visibility Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <Eye className="w-6 h-6 text-cyan-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Artist Recordings Visibility</h3>
                    <p className="text-sm text-gray-400">Show or hide "My Recordings" in Artist Tools</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('artist_recordings_visible', !appConfig.artist_recordings_visible)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.artist_recordings_visible
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.artist_recordings_visible ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.artist_recordings_visible ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Payment Information Visibility Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-yellow-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Payment Information Section</h3>
                    <p className="text-sm text-gray-400">Show or hide payment information section for artists</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('payment_info_visible', !appConfig.payment_info_visible)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.payment_info_visible
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.payment_info_visible ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.payment_info_visible ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Gift Button Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-yellow-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Gift Button</h3>
                    <p className="text-sm text-gray-400">Show or hide the gift button in live events</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('gift_enabled', !appConfig.gift_enabled)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.gift_enabled
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.gift_enabled ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.gift_enabled ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Desktop Mode on Mobile Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                    <Monitor className="w-6 h-6 text-blue-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Desktop Mode on Mobile</h3>
                    <p className="text-sm text-gray-400">Allow desktop mode on mobile devices in Creator Studio</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('desktop_mode_on_mobile', !appConfig.desktop_mode_on_mobile)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.desktop_mode_on_mobile
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.desktop_mode_on_mobile ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.desktop_mode_on_mobile ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Live Event Notifications Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Bell className="w-6 h-6 text-purple-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Live Event Notifications</h3>
                    <p className="text-sm text-gray-400">Enable or disable in-app notifications when live events start</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('live_event_notifications_enabled', !appConfig.live_event_notifications_enabled)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.live_event_notifications_enabled
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.live_event_notifications_enabled ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.live_event_notifications_enabled ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Live Event Email Notifications Section */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Mail className="w-6 h-6 text-purple-400" />
                  Live Event Email Notifications
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Control which user types receive email notifications when live events start. Emails are sent to all registered users and guest ticket buyers.
                </p>

                <div className="space-y-4">
                  {/* Email Notify Admins Toggle */}
                  <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
                        <UserCog className="w-6 h-6 text-red-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">Email Notify Admins</h3>
                        <p className="text-sm text-gray-400">Send email notifications to admins when live events start</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateConfig('live_event_email_notify_admins', !appConfig.live_event_email_notify_admins)}
                      disabled={loadingConfig}
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                        appConfig.live_event_email_notify_admins
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gray-600'
                      } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                          appConfig.live_event_email_notify_admins ? 'translate-x-8' : 'translate-x-0'
                        }`}
                      />
                      {appConfig.live_event_email_notify_admins ? (
                        <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      ) : (
                        <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>

                  {/* Email Notify Artists Toggle */}
                  <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                        <Music className="w-6 h-6 text-pink-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">Email Notify Artists</h3>
                        <p className="text-sm text-gray-400">Send email notifications to artists when live events start</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateConfig('live_event_email_notify_artists', !appConfig.live_event_email_notify_artists)}
                      disabled={loadingConfig}
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                        appConfig.live_event_email_notify_artists
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gray-600'
                      } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                          appConfig.live_event_email_notify_artists ? 'translate-x-8' : 'translate-x-0'
                        }`}
                      />
                      {appConfig.live_event_email_notify_artists ? (
                        <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      ) : (
                        <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>

                  {/* Email Notify Fans Toggle */}
                  <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">Email Notify Fans</h3>
                        <p className="text-sm text-gray-400">Send email notifications to fans (regular users) when live events start</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateConfig('live_event_email_notify_fans', !appConfig.live_event_email_notify_fans)}
                      disabled={loadingConfig}
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                        appConfig.live_event_email_notify_fans
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gray-600'
                      } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                          appConfig.live_event_email_notify_fans ? 'translate-x-8' : 'translate-x-0'
                        }`}
                      />
                      {appConfig.live_event_email_notify_fans ? (
                        <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      ) : (
                        <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Phone Notifications Section */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Phone className="w-6 h-6 text-purple-400" />
                  Phone Notifications
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Control phone (SMS) notifications for event scheduling and live event starts. Notifications are sent via phone number only.
                </p>

                {/* Event Scheduled Phone Notifications */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-300" />
                    Event Scheduled Notifications
                  </h4>
                  <div className="space-y-4">
                    {/* Phone Notify Followers - Event Scheduled */}
                    <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                          <Users className="w-6 h-6 text-green-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">Phone Notify Followers (Event Scheduled)</h3>
                          <p className="text-sm text-gray-400">Send phone notifications to users following an artist when that artist schedules an event</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateConfig('event_scheduled_phone_notify_followers', !appConfig.event_scheduled_phone_notify_followers)}
                        disabled={loadingConfig}
                        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                          appConfig.event_scheduled_phone_notify_followers
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gray-600'
                        } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                            appConfig.event_scheduled_phone_notify_followers ? 'translate-x-8' : 'translate-x-0'
                          }`}
                        />
                        {appConfig.event_scheduled_phone_notify_followers ? (
                          <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                        ) : (
                          <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>

                    {/* Phone Notify All - Event Scheduled */}
                    <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                          <Globe className="w-6 h-6 text-blue-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">Phone Notify All (Event Scheduled)</h3>
                          <p className="text-sm text-gray-400">Send phone notifications to all users when any artist schedules an event</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateConfig('event_scheduled_phone_notify_all', !appConfig.event_scheduled_phone_notify_all)}
                        disabled={loadingConfig}
                        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                          appConfig.event_scheduled_phone_notify_all
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gray-600'
                        } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                            appConfig.event_scheduled_phone_notify_all ? 'translate-x-8' : 'translate-x-0'
                          }`}
                        />
                        {appConfig.event_scheduled_phone_notify_all ? (
                          <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                        ) : (
                          <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Event Started Phone Notifications */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <MonitorPlay className="w-5 h-5 text-purple-300" />
                    Live Event Started Notifications
                  </h4>
                  <div className="space-y-4">
                    {/* Phone Notify Followers - Live Event Started */}
                    <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/20 to-red-500/20 flex items-center justify-center">
                          <Users className="w-6 h-6 text-pink-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">Phone Notify Followers (Live Event Started)</h3>
                          <p className="text-sm text-gray-400">Send phone notifications to users following an artist when that artist starts a live event</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateConfig('live_event_started_phone_notify_followers', !appConfig.live_event_started_phone_notify_followers)}
                        disabled={loadingConfig}
                        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                          appConfig.live_event_started_phone_notify_followers
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gray-600'
                        } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                            appConfig.live_event_started_phone_notify_followers ? 'translate-x-8' : 'translate-x-0'
                          }`}
                        />
                        {appConfig.live_event_started_phone_notify_followers ? (
                          <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                        ) : (
                          <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>

                    {/* Phone Notify All - Live Event Started */}
                    <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                          <Globe className="w-6 h-6 text-purple-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">Phone Notify All (Live Event Started)</h3>
                          <p className="text-sm text-gray-400">Send phone notifications to all users when any artist starts a live event</p>
                        </div>
                      </div>
                      <button
                        onClick={() => updateConfig('live_event_started_phone_notify_all', !appConfig.live_event_started_phone_notify_all)}
                        disabled={loadingConfig}
                        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                          appConfig.live_event_started_phone_notify_all
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gray-600'
                        } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div
                          className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                            appConfig.live_event_started_phone_notify_all ? 'translate-x-8' : 'translate-x-0'
                          }`}
                        />
                        {appConfig.live_event_started_phone_notify_all ? (
                          <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                        ) : (
                          <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Creator Studio Analytics Toggle */}
              <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Creator Studio Analytics</h3>
                    <p className="text-sm text-gray-400">Show or hide the Analytics tab in Creator Studio</p>
                  </div>
                </div>
                <button
                  onClick={() => updateConfig('creator_studio_analytics_enabled', !appConfig.creator_studio_analytics_enabled)}
                  disabled={loadingConfig}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    appConfig.creator_studio_analytics_enabled
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : 'bg-gray-600'
                  } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                      appConfig.creator_studio_analytics_enabled ? 'translate-x-8' : 'translate-x-0'
                    }`}
                  />
                  {appConfig.creator_studio_analytics_enabled ? (
                    <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  ) : (
                    <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                  )}
                </button>
              </div>

              {/* Revenue Settings Section */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-purple-400" />
                  Revenue Distribution Settings
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Configure how revenue from ticket sales is distributed between the platform and artists. 
                  Platform percentage is kept for site maintenance, artist percentage is paid to artists after live events.
                </p>

                <div className="space-y-4">
                  {/* Platform Revenue Percentage */}
                  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                          <Globe className="w-6 h-6 text-blue-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">Platform Revenue Percentage</h3>
                          <p className="text-sm text-gray-400">Percentage kept by platform for maintenance</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-400 mb-2">Platform % (0-100)</label>
                        <input
                          type="number"
                          value={platformRevenuePercentage}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 100)) {
                              setPlatformRevenuePercentage(value);
                            }
                          }}
                          min="0"
                          max="100"
                          step="1"
                          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50"
                          placeholder="Enter percentage"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Current: {appConfig.platform_revenue_percentage || 30}%
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={async () => {
                            const percentage = parseFloat(platformRevenuePercentage);
                            if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
                              try {
                                setLoadingConfig(true);
                                await updateConfig('platform_revenue_percentage', percentage);
                                // Auto-update artist percentage to maintain 100% total
                                const newArtistPercentage = 100 - percentage;
                                await updateConfig('artist_revenue_percentage', newArtistPercentage);
                                setArtistRevenuePercentage(newArtistPercentage.toString());
                                setSuccess(`Revenue percentages updated! Platform: ${percentage}%, Artist: ${newArtistPercentage}%`);
                                setTimeout(() => setSuccess(null), 5000);
                              } catch (err) {
                                console.error('Error updating revenue percentages:', err);
                              } finally {
                                setLoadingConfig(false);
                              }
                            }
                          }}
                          disabled={loadingConfig}
                          className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Artist Revenue Percentage */}
                  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                          <Music className="w-6 h-6 text-purple-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">Artist Revenue Percentage</h3>
                          <p className="text-sm text-gray-400">Percentage paid to artist after live event</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-400 mb-2">Artist % (0-100)</label>
                        <input
                          type="number"
                          value={artistRevenuePercentage}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0 && Number(value) <= 100)) {
                              setArtistRevenuePercentage(value);
                            }
                          }}
                          min="0"
                          max="100"
                          step="1"
                          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50"
                          placeholder="Enter percentage"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Current: {appConfig.artist_revenue_percentage || 70}%
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={async () => {
                            const percentage = parseFloat(artistRevenuePercentage);
                            if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
                              try {
                                setLoadingConfig(true);
                                await updateConfig('artist_revenue_percentage', percentage);
                                // Auto-update platform percentage to maintain 100% total
                                const newPlatformPercentage = 100 - percentage;
                                await updateConfig('platform_revenue_percentage', newPlatformPercentage);
                                setPlatformRevenuePercentage(newPlatformPercentage.toString());
                                setSuccess(`Revenue percentages updated! Platform: ${newPlatformPercentage}%, Artist: ${percentage}%`);
                                setTimeout(() => setSuccess(null), 5000);
                              } catch (err) {
                                console.error('Error updating revenue percentages:', err);
                              } finally {
                                setLoadingConfig(false);
                              }
                            }
                          }}
                          disabled={loadingConfig}
                          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Update
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Summary */}
                  <div className="backdrop-blur-sm bg-gradient-to-br from-emerald-600/20 to-teal-600/20 border border-emerald-500/30 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-bold text-white mb-2">Total Distribution</h4>
                        <p className="text-sm text-gray-300">
                          Platform: <span className="font-bold text-blue-300">{appConfig.platform_revenue_percentage || 30}%</span> | 
                          Artist: <span className="font-bold text-purple-300">{appConfig.artist_revenue_percentage || 70}%</span>
                        </p>
                        <p className={`text-xs mt-2 font-semibold ${
                          ((appConfig.platform_revenue_percentage || 30) + (appConfig.artist_revenue_percentage || 70)) === 100
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}>
                          {((appConfig.platform_revenue_percentage || 30) + (appConfig.artist_revenue_percentage || 70)) === 100
                            ? '✓ Total equals 100%'
                            : '⚠ Total does not equal 100%'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">
                          ${((appConfig.platform_revenue_percentage || 30) / 100 * 1000).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">Platform share (example: $1000 revenue)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Notifications Section */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-purple-400" />
                  Live Stream Notifications
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Control which user types receive notifications when an artist goes live
                </p>

                <div className="space-y-4">
                  {/* Fans Notifications Toggle */}
                  <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-blue-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">Fans Notifications</h3>
                        <p className="text-sm text-gray-400">Send notifications to fans when artists go live</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateConfig('live_notifications_fans_enabled', !appConfig.live_notifications_fans_enabled)}
                      disabled={loadingConfig}
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                        appConfig.live_notifications_fans_enabled
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gray-600'
                      } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                          appConfig.live_notifications_fans_enabled ? 'translate-x-8' : 'translate-x-0'
                        }`}
                      />
                      {appConfig.live_notifications_fans_enabled ? (
                        <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      ) : (
                        <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>

                  {/* Artists Notifications Toggle */}
                  <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Music className="w-6 h-6 text-purple-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">Artists Notifications</h3>
                        <p className="text-sm text-gray-400">Send notifications to artists when other artists go live</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateConfig('live_notifications_artists_enabled', !appConfig.live_notifications_artists_enabled)}
                      disabled={loadingConfig}
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                        appConfig.live_notifications_artists_enabled
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gray-600'
                      } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                          appConfig.live_notifications_artists_enabled ? 'translate-x-8' : 'translate-x-0'
                        }`}
                      />
                      {appConfig.live_notifications_artists_enabled ? (
                        <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      ) : (
                        <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>

                  {/* Admins Notifications Toggle */}
                  <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                        <Settings2 className="w-6 h-6 text-orange-300" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-1">Admins Notifications</h3>
                        <p className="text-sm text-gray-400">Send notifications to admins when artists go live</p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateConfig('live_notifications_admins_enabled', !appConfig.live_notifications_admins_enabled)}
                      disabled={loadingConfig}
                      className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                        appConfig.live_notifications_admins_enabled
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                          : 'bg-gray-600'
                      } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div
                        className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                          appConfig.live_notifications_admins_enabled ? 'translate-x-8' : 'translate-x-0'
                        }`}
                      />
                      {appConfig.live_notifications_admins_enabled ? (
                        <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      ) : (
                        <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Advertisements Home Visibility Toggle */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <MonitorPlay className="w-6 h-6 text-purple-400" />
                  Advertisement Settings
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Control advertisement visibility on the home page
                </p>

                <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 flex items-center justify-center">
                      <MonitorPlay className="w-6 h-6 text-pink-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Home Page Advertisements</h3>
                      <p className="text-sm text-gray-400">Show or hide advertisements on the home page</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfig('advertisements_home_enabled', !appConfig.advertisements_home_enabled)}
                    disabled={loadingConfig}
                    className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                      appConfig.advertisements_home_enabled
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gray-600'
                    } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                        appConfig.advertisements_home_enabled ? 'translate-x-8' : 'translate-x-0'
                      }`}
                    />
                    {appConfig.advertisements_home_enabled ? (
                      <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                    ) : (
                      <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>

              {/* Visitor Counter Visibility Toggle */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Eye className="w-6 h-6 text-purple-400" />
                  Visitor Counter Settings
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Control the visibility of the visitor counter in the navbar
                </p>

                <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
                      <Eye className="w-6 h-6 text-yellow-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Visitor Counter Visibility</h3>
                      <p className="text-sm text-gray-400">Show or hide the visitor counter in the navigation bar</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfig('visitor_counter_visible', !appConfig.visitor_counter_visible)}
                    disabled={loadingConfig}
                    className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                      appConfig.visitor_counter_visible
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gray-600'
                    } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                        appConfig.visitor_counter_visible ? 'translate-x-8' : 'translate-x-0'
                      }`}
                    />
                    {appConfig.visitor_counter_visible ? (
                      <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                    ) : (
                      <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>

              {/* Auth Gate (Sign-in prompt) Toggle */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Lock className="w-6 h-6 text-purple-400" />
                  Auth Gate
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  When enabled, a sign-in/sign-up pop-up appears when a guest clicks anywhere on the site (e.g. nav, images). Guests can dismiss it via &quot;Ignore or Later&quot;.
                </p>

                <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Auth Gate Pop-up</h3>
                      <p className="text-sm text-gray-400">Show sign-in/sign-up prompt on first click for guests</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfig('auth_gate_enabled', !appConfig.auth_gate_enabled)}
                    disabled={loadingConfig}
                    className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                      appConfig.auth_gate_enabled
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gray-600'
                    } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                        appConfig.auth_gate_enabled ? 'translate-x-8' : 'translate-x-0'
                      }`}
                    />
                    {appConfig.auth_gate_enabled ? (
                      <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                    ) : (
                      <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>

              {/* Communication (Artist Management) Toggle */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-purple-400" />
                  Communication
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  When enabled, the Communication section is visible in Artist Management, allowing super admins to send in-app notifications to artists.
                </p>

                <div className="flex items-center justify-between p-6 backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Artist Management Communication</h3>
                      <p className="text-sm text-gray-400">Show Communication section (send in-app notifications to artists)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfig('artist_management_communication_enabled', !appConfig.artist_management_communication_enabled)}
                    disabled={loadingConfig}
                    className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                      appConfig.artist_management_communication_enabled
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                        : 'bg-gray-600'
                    } ${loadingConfig ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                        appConfig.artist_management_communication_enabled ? 'translate-x-8' : 'translate-x-0'
                      }`}
                    />
                    {appConfig.artist_management_communication_enabled ? (
                      <ToggleRight className="absolute top-1/2 left-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                    ) : (
                      <ToggleLeft className="absolute top-1/2 right-2 transform -translate-y-1/2 w-4 h-4 text-white" />
                    )}
                  </button>
                </div>
              </div>

              {/* Free Access Link Generator */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Link2 className="w-6 h-6 text-purple-400" />
                  Free Access Link Generator
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Generate and send free access links to users for specific events (for ticket/access problems)
                </p>

                {/* Error Display for Free Access Link Generator */}
                {error && (error.includes('access link') || error.includes('email') || error.includes('event')) && (
                  <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
                    <p className="text-red-400 text-sm">
                      {error}
                    </p>
                  </div>
                )}

                {/* Success Display for Free Access Link Generator */}
                {success && (success.includes('access link') || success.includes('sent successfully')) && (
                  <div className="mb-4 p-4 rounded-xl bg-green-500/10 border border-green-500/50 backdrop-blur-sm">
                    <p className="text-green-400 text-sm">
                      {success}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Event Selection */}
                  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                    <label className="block text-sm font-semibold text-white mb-2">
                      Select Event
                    </label>
                    <select
                      value={selectedEventId}
                      onChange={(e) => setSelectedEventId(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50"
                    >
                      <option value="">-- Select an event --</option>
                      {availableEvents.map((event) => (
                        <option key={event.id} value={event.id} className="bg-gray-800">
                          {event.title} - {event.profiles?.full_name || event.profiles?.username || 'Unknown Artist'} ({new Date(event.start_time).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* User Email */}
                  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                    <label className="block text-sm font-semibold text-white mb-2">
                      User Email
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50"
                    />
                  </div>

                  {/* Generate Link Button */}
                  <div className="flex gap-3">
                    <button
                      onClick={generateFreeAccessLink}
                      disabled={generatingLink || !selectedEventId || !userEmail}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingLink ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-5 h-5" />
                          Generate Access Link
                        </>
                      )}
                    </button>
                  </div>

                  {/* Generated Link Display */}
                  {generatedLink && (
                    <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                      <label className="block text-sm font-semibold text-white mb-2">
                        Generated Access Link
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={generatedLink}
                          readOnly
                          className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none"
                        />
                        <button
                          onClick={copyLinkToClipboard}
                          className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white transition-colors"
                          title="Copy link"
                        >
                          {linkCopied ? (
                            <Check className="w-5 h-5 text-green-400" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        This link allows the user to watch the event without purchasing a ticket
                      </p>
                    </div>
                  )}

                  {/* Send Email Button */}
                  {generatedLink && (
                    <>
                      <button
                        onClick={sendAccessLinkEmail}
                        disabled={sendingEmail}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingEmail ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="w-5 h-5" />
                            Send Link via Email
                          </>
                        )}
                      </button>
                      <p className="text-xs text-gray-500 text-center mt-2">
                        Note: If email sending fails, you can copy the link above and send it manually to the user.
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Visitor Count Base Management */}
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-purple-400" />
                  Visitor Count Base Settings
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Set a starting/base number for the visitor counter. The displayed count = base + actual unique visitors.
                </p>

                <div className="space-y-4">
                  <div className="backdrop-blur-sm bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                          <BarChart3 className="w-6 h-6 text-blue-300" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">Base Visitor Count</h3>
                          <p className="text-sm text-gray-400">Set the starting number for the visitor counter</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="block text-sm text-gray-400 mb-2">Base Count</label>
                        <input
                          type="number"
                          value={visitorCountBase}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                              setVisitorCountBase(value);
                            }
                          }}
                          min="0"
                          step="1"
                          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50"
                          placeholder="Enter base count"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                          Current base: {appConfig.visitor_count_base?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            const newBase = parseInt(visitorCountBase, 10);
                            if (!isNaN(newBase) && newBase >= 0) {
                              updateVisitorCountBase(newBase);
                            } else {
                              setError('Please enter a valid number (0 or greater)');
                            }
                          }}
                          disabled={loadingConfig || resettingVisitorCount}
                          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Update Base
                        </button>
                        <button
                          onClick={resetVisitorCount}
                          disabled={loadingConfig || resettingVisitorCount}
                          className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-xl font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {resettingVisitorCount ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Resetting...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4" />
                              Reset Count
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-sm text-blue-300">
                        <strong>How it works:</strong> The displayed visitor count = Base Count + Actual Unique Visitors.
                        <br />
                        <strong>Reset:</strong> Sets the base to the current total, preserving the displayed number while clearing tracking data.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Management */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <User className="w-6 h-6 text-purple-400" />
            Profile Settings
          </h2>
          
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
              <p className="text-red-400">
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
            {/* Profile Picture Upload */}
            <div className="flex flex-col items-center space-y-4 pb-6 border-b border-white/10">
              <div className="relative group">
                {previewUrl ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur-md opacity-50 group-hover:opacity-75 transition-opacity"></div>
                    <img
                      src={previewUrl}
                      alt="Profile preview"
                      className="relative w-32 h-32 rounded-full object-cover ring-4 ring-white/20 group-hover:ring-purple-500/50 transition-all duration-300"
                      style={{ objectPosition: 'center top' }}
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-md"></div>
                    <div className="relative w-32 h-32 bg-gradient-to-br from-purple-600/30 to-pink-600/30 rounded-full flex items-center justify-center border-2 border-white/20 backdrop-blur-sm">
                      <Camera size={40} className="text-purple-300" />
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
                    onChange={(e) => handleFormChange({ ...formData, username: e.target.value })}
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
                    onChange={(e) => handleFormChange({ ...formData, fullName: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-400" />
                  Bio
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleFormChange({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all resize-none"
                  rows={4}
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-400" />
                  Country
                </label>
                <div className="relative">
                  <div className="relative">
                    <input
                      ref={countryInputRef}
                      type="text"
                      value={formData.country}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleFormChange({ ...formData, country: value });
                        setCountrySearch(value);
                        // Show dropdown only if user has typed 2+ characters
                        if (value.length >= 2) {
                          setShowCountryDropdown(true);
                        } else {
                          setShowCountryDropdown(false);
                        }
                      }}
                      onFocus={() => {
                        // Show dropdown if there's a search query with 2+ characters
                        if (countrySearch.length >= 2 && filteredCountries.length > 0) {
                          setShowCountryDropdown(true);
                        }
                      }}
                      className="w-full pl-4 pr-10 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      placeholder="Type 2+ letters to search countries..."
                      required
                      autoComplete="off"
                    />
                    {formData.country && (
                      <button
                        type="button"
                        onClick={() => {
                          handleFormChange({ ...formData, country: '' });
                          setCountrySearch('');
                          setShowCountryDropdown(false);
                          countryInputRef.current?.focus();
                        }}
                        className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        aria-label="Clear country"
                      >
                        <X size={18} />
                      </button>
                    )}
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  </div>
                  
                  {showCountryDropdown && filteredCountries.length > 0 && (
                    <div
                      ref={countryDropdownRef}
                      className="absolute z-50 w-full mt-1 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto backdrop-blur-xl"
                    >
                      <div className="p-1">
                        {filteredCountries.map((country) => {
                          // Highlight matching text
                          const index = country.toLowerCase().indexOf(countrySearch.toLowerCase());
                          const beforeMatch = country.substring(0, index);
                          const match = country.substring(index, index + countrySearch.length);
                          const afterMatch = country.substring(index + countrySearch.length);
                          
                          return (
                            <button
                              key={country}
                              type="button"
                              className="w-full px-4 py-2.5 text-left text-white hover:bg-purple-600/30 transition-colors rounded-lg"
                              onClick={() => {
                                handleFormChange({ ...formData, country });
                                setShowCountryDropdown(false);
                                setCountrySearch('');
                              }}
                            >
                              {index >= 0 ? (
                                <>
                                  {beforeMatch}
                                  <span className="font-semibold bg-purple-500/30">{match}</span>
                                  {afterMatch}
                                </>
                              ) : (
                                country
                              )}
                            </button>
                          );
                        })}
                        {filteredCountries.length === 20 && (
                          <div className="px-4 py-2 text-xs text-gray-400 text-center">
                            Showing first 20 results. Type more letters to refine.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {showCountryDropdown && countrySearch.length >= 2 && filteredCountries.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-white/10 rounded-xl shadow-2xl p-4 backdrop-blur-xl">
                      <div className="text-gray-400 text-sm text-center">
                        No countries found matching "{countrySearch}"
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-400" />
                  Region
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => handleFormChange({ ...formData, region: e.target.value })}
                  className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all appearance-none cursor-pointer"
                  required
                >
                  <option value="African" className="bg-gray-800">African</option>
                  <option value="European" className="bg-gray-800">European</option>
                  <option value="American" className="bg-gray-800">American</option>
                  <option value="Asian" className="bg-gray-800">Asian</option>
                  <option value="Maghreb" className="bg-gray-800">Maghreb</option>
                  <option value="Other" className="bg-gray-800">Other</option>
                </select>
              </div>
            </div>

            {isArtist && (
            <div>
                <label className="block text-gray-300 mb-2 font-semibold flex items-center gap-2">
                  <Music className="w-5 h-5 text-purple-400" />
                  Genres
                </label>
                
                {/* Selected Genres Display */}
                <div className="mb-3 flex flex-wrap gap-2 min-h-[40px] p-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl">
                  {formData.selectedGenres.length > 0 ? (
                    formData.selectedGenres.map((genreName) => (
                      <span
                        key={genreName}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white rounded-lg text-sm font-semibold"
                      >
                        {genreName}
                        <button
                          type="button"
                          onClick={() => {
                            handleFormChange({
                              ...formData,
                              selectedGenres: formData.selectedGenres.filter(g => g !== genreName)
                            });
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
                  {formData.selectedGenres.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded-full text-xs font-semibold">
                      {formData.selectedGenres.length}
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
                        
                        {formData.selectedGenres.length > 0 && (
                          <p className="mt-3 text-sm text-gray-400">
                            {formData.selectedGenres.length} {formData.selectedGenres.length === 1 ? 'genre' : 'genres'} selected
                          </p>
                        )}
                      </div>

                      {/* Genres List */}
                      <div className="flex-1 overflow-y-auto p-6">
                        {genres.filter(genre =>
                          genre.name.toLowerCase().includes(genreSearchQuery.toLowerCase())
                        ).length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {genres.filter(genre =>
                              genre.name.toLowerCase().includes(genreSearchQuery.toLowerCase())
                            ).map((genre) => {
                              const isSelected = formData.selectedGenres.includes(genre.name);
                              return (
                                <button
                                  key={genre.id}
                                  type="button"
                                  onClick={() => {
                                    handleFormChange({
                                      ...formData,
                                      selectedGenres: isSelected
                                        ? formData.selectedGenres.filter(g => g !== genre.name)
                                        : [...formData.selectedGenres, genre.name]
                                    });
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
            )}

            {/* Payment Information Section */}
            {isArtist && appConfig.payment_info_visible && (
              <div className="border-t border-white/10 pt-6 mt-6">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-purple-400" />
                  Payment Information
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 mb-2 font-semibold">Bank Account (IBAN)</label>
                    <div className="relative">
                      <CreditCard className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400" size={20} />
                      <input
                        type="text"
                        value={formData.bankIban}
                        onChange={(e) => setFormData({ ...formData, bankIban: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        placeholder="Optional - Enter your IBAN"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-semibold">Mobile Payment Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400" size={20} />
                      <input
                        type="tel"
                        value={formData.mobilePaymentNumber}
                        onChange={(e) => setFormData({ ...formData, mobilePaymentNumber: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        placeholder="Optional - Enter mobile payment number"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-2 font-semibold">Mobile Payment Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-400" size={20} />
                      <input
                        type="text"
                        value={formData.mobilePaymentName}
                        onChange={(e) => setFormData({ ...formData, mobilePaymentName: e.target.value })}
                        className="w-full pl-12 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        placeholder="Optional - Name associated with mobile payment"
                      />
                    </div>
                  </div>

                  {/* Verification Section */}
                  {(formData.bankIban !== userProfile.bank_iban ||
                    formData.mobilePaymentNumber !== userProfile.mobile_payment_number ||
                    formData.mobilePaymentName !== userProfile.mobile_payment_name) && (
                    <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/50 p-6 rounded-xl backdrop-blur-sm">
                      <div className="flex items-center text-yellow-400 mb-4">
                        <Lock className="h-5 w-5 mr-2" />
                        <span className="font-semibold">Verification Required</span>
                      </div>
                      
                      {!isVerifying ? (
                        <button
                          type="button"
                          onClick={handlePaymentVerification}
                          disabled={loading}
                          className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {loading ? 'Sending Code...' : 'Verify Payment Information'}
                        </button>
                      ) : (
                        <div className="space-y-4">
                          <input
                            type="text"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                            placeholder="Enter verification code"
                            className="w-full px-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={verifyPaymentUpdate}
                            disabled={loading || !verificationCode}
                            className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/40 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {loading ? 'Verifying...' : 'Submit Verification Code'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isFormDirty}
              className={`w-full py-3.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                loading
                  ? 'bg-gray-600/50 cursor-not-allowed text-gray-400'
                  : isFormDirty
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:scale-[1.02] active:scale-[0.98]'
                    : success
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/30'
                      : 'bg-gray-600/50 cursor-not-allowed text-gray-400'
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
                  <span>{success && !isFormDirty ? 'Saved!' : 'Save Changes'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;