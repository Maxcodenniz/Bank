import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useStreaming } from '../contexts/StreamingContext';
import { supabase } from '../lib/supabaseClient';
import AgoraStreamingStudio from '../components/AgoraStreamingStudio';
import MobileLiveStudio from '../components/MobileLiveStudio';
import { Concert } from '../types';
import {
  Users,
  Settings,
  AlertTriangle,
  Tv,
  BarChart,
  SlidersHorizontal,
  Smartphone,
  Monitor,
  Loader2,
  CheckCircle,
  Video,
  MessageCircle,
  Globe,
  Music,
} from 'lucide-react';

const LIVE_LEAVE_MESSAGE = 'You must end the live event before leaving this page. Use "End stream" in the studio.';

// Generate UUID v4
const generateUUID = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const GoLive: React.FC = () => {
  const { userProfile } = useStore();
  const { 
    isStreaming, 
    currentEvent: contextEvent, 
    setCurrentEvent: setContextEvent,
    streamingEventId,
    setStreamingEventId 
  } = useStreaming();
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studioMode, setStudioMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showMobileStudio, setShowMobileStudio] = useState(false);
  const [activeTab, setActiveTab] = useState<'stream' | 'analytics' | 'settings'>('stream');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const hasInitializedRef = useRef(false);
  const isRestoringRef = useRef(false);
  
  // Analytics state
  const [analytics, setAnalytics] = useState({
    currentViewers: 0,
    peakViewers: 0,
    totalViewers: 0,
    streamDuration: 0,
    ticketsSold: 0,
    revenue: 0,
    platformRevenue: 0,
    artistRevenue: 0,
    chatMessages: 0,
    averageViewers: 0,
  });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [platformRevenuePercentage, setPlatformRevenuePercentage] = useState(30);
  const [artistRevenuePercentage, setArtistRevenuePercentage] = useState(70);
  const [artistSpecificRevenuePercentage, setArtistSpecificRevenuePercentage] = useState<number | null>(null);
  const [desktopModeOnMobile, setDesktopModeOnMobile] = useState(false);

  // Initialize event data - only run once or when userProfile changes
  useEffect(() => {
    // Prevent multiple initializations
    if (hasInitializedRef.current) return;
    
    if (!userProfile) {
      setLoading(false);
      return;
    }
    
    // If there's an active stream in context, restore it instead of fetching
    if (isStreaming && contextEvent && streamingEventId && streamingEventId === contextEvent.id) {
      if (!isRestoringRef.current) {
        isRestoringRef.current = true;
        console.log('🔄 Restoring active stream from context:', streamingEventId);
        setCurrentEvent(contextEvent);
        setLoading(false);
        hasInitializedRef.current = true;
      }
      return;
    }
    
    // Otherwise, fetch the event normally (only once)
    if (userProfile && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchCurrentEvent();
    }
  }, [userProfile?.id, isStreaming, streamingEventId, contextEvent]);
  
  // Reset initialization flag when user changes
  useEffect(() => {
    hasInitializedRef.current = false;
    isRestoringRef.current = false;
  }, [userProfile?.id]);

  // Fetch analytics visibility and revenue config
  useEffect(() => {
    const fetchAnalyticsConfig = async () => {
      try {
        // Fetch app config
        const { data: configData, error: configError } = await supabase
          .from('app_config')
          .select('key, value')
          .in('key', ['creator_studio_analytics_enabled', 'platform_revenue_percentage', 'artist_revenue_percentage', 'desktop_mode_on_mobile']);

        if (configError) throw configError;

        configData?.forEach(item => {
          if (item.key === 'desktop_mode_on_mobile') {
            const isEnabled = item.value === true || item.value === 'true';
            setDesktopModeOnMobile(isEnabled);
          } else if (item.key === 'creator_studio_analytics_enabled') {
            const isEnabled = item.value === true || item.value === 'true';
            setAnalyticsEnabled(isEnabled);
          } else if (item.key === 'platform_revenue_percentage') {
            const percentage = typeof item.value === 'number' ? item.value : parseFloat(item.value as string);
            setPlatformRevenuePercentage(isNaN(percentage) ? 30 : percentage);
          } else if (item.key === 'artist_revenue_percentage') {
            const percentage = typeof item.value === 'number' ? item.value : parseFloat(item.value as string);
            setArtistRevenuePercentage(isNaN(percentage) ? 70 : percentage);
          }
        });

        // Fetch artist-specific revenue percentage if user is an artist
        if (userProfile?.user_type === 'artist' && userProfile?.id) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('revenue_percentage')
            .eq('id', userProfile.id)
            .single();

          if (!profileError && profileData) {
            setArtistSpecificRevenuePercentage(profileData.revenue_percentage);
          }
        }
      } catch (err) {
        console.warn('Error fetching analytics config:', err);
      }
    };

    fetchAnalyticsConfig();

    // Set up real-time subscription for artist revenue percentage changes
    if (userProfile?.user_type === 'artist' && userProfile?.id) {
      const channel = supabase
        .channel(`artist-revenue-${userProfile.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userProfile.id}`,
          },
          (payload) => {
            const newData = payload.new as any;
            if (newData.revenue_percentage !== undefined) {
              setArtistSpecificRevenuePercentage(newData.revenue_percentage);
              console.log('Artist revenue percentage updated:', newData.revenue_percentage);
            }
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }

    // Set up real-time subscription for config changes
    const channel = supabase
      .channel('analytics-config-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_config',
          filter: 'key=in.(creator_studio_analytics_enabled,platform_revenue_percentage,artist_revenue_percentage,desktop_mode_on_mobile)',
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.key === 'creator_studio_analytics_enabled') {
            const isEnabled = newData.value === true || newData.value === 'true';
            setAnalyticsEnabled(isEnabled);
            // Switch to stream tab if analytics is disabled and we're on analytics tab
            if (!isEnabled && activeTab === 'analytics') {
              setActiveTab('stream');
            }
          } else if (newData.key === 'platform_revenue_percentage') {
            const percentage = typeof newData.value === 'number' ? newData.value : parseFloat(newData.value as string);
            setPlatformRevenuePercentage(isNaN(percentage) ? 30 : percentage);
          } else if (newData.key === 'artist_revenue_percentage') {
            const percentage = typeof newData.value === 'number' ? newData.value : parseFloat(newData.value as string);
            setArtistRevenuePercentage(isNaN(percentage) ? 70 : percentage);
          } else if (newData.key === 'desktop_mode_on_mobile') {
            const isEnabled = newData.value === true || newData.value === 'true';
            setDesktopModeOnMobile(isEnabled);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [activeTab]);

  // Switch to stream tab if analytics is disabled and we're on analytics tab
  useEffect(() => {
    if (!analyticsEnabled && activeTab === 'analytics') {
      setActiveTab('stream');
    }
  }, [analyticsEnabled, activeTab]);

  // Detect mobile device
  useEffect(() => {
    const checkMobileDevice = () => {
      // Check user agent for mobile devices
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
      
      // Also check screen width (mobile devices typically < 768px)
      const isMobileWidth = window.innerWidth < 768;
      
      // Consider it mobile if either condition is true
      const isMobile = isMobileUA || isMobileWidth;
      
      setIsMobileDevice(isMobile);
      
      // If on mobile device, default to mobile mode (unless desktop mode on mobile is enabled)
      if (isMobile && studioMode === 'desktop' && !desktopModeOnMobile) {
        setStudioMode('mobile');
      }
    };

    checkMobileDevice();
    
      // Listen for window resize to update mobile detection
      window.addEventListener('resize', checkMobileDevice);
      
      // Prevent mode switching on scroll when desktop mode is enabled on mobile
      const handleScroll = (e: Event) => {
        if (isMobileDevice && studioMode === 'desktop' && desktopModeOnMobile) {
          // Prevent accidental mode switching on scroll
          e.stopPropagation();
        }
      };
      
      if (isMobileDevice && desktopModeOnMobile) {
        window.addEventListener('scroll', handleScroll, { passive: false });
      }
      
      return () => {
        window.removeEventListener('resize', checkMobileDevice);
        window.removeEventListener('scroll', handleScroll);
      };
    }, [studioMode, desktopModeOnMobile]);

  const createAdminEvent = useCallback(async () => {
    if (!userProfile || userProfile.user_type !== 'global_admin')
      throw new Error('Only global admins can create instant streams');

    const eventId = generateUUID();
    const now = new Date().toISOString();

    const { data, error: insertError } = await supabase
      .from('events')
      .insert({
        id: eventId,
        title: 'Admin Live Stream',
        description: 'Administrative live streaming session',
        artist_id: userProfile.id,
        start_time: now,
        duration: 120,
        price: 0,
        status: 'live',
        artist_type: 'music',
      })
      .select()
      .single();

    if (insertError) throw insertError;
    return data;
  }, [userProfile]);

  const fetchCurrentEvent = useCallback(async () => {
    if (!userProfile) return setLoading(false);

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true })
        .limit(1);

      if (userProfile.user_type === 'artist') {
        query = query
          .eq('artist_id', userProfile.id)
          .in('status', ['upcoming', 'live']);
      } else if (userProfile.user_type === 'global_admin' || userProfile.user_type === 'super_admin') {
        query = query.in('status', ['upcoming', 'live']);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      if (data) {
        setCurrentEvent(data);
        // Store in context for persistence across navigation
        setContextEvent(data);
        setStreamingEventId(data.id);
      } else if (userProfile.user_type === 'global_admin' || userProfile.user_type === 'super_admin') {
        const newEvent = await createAdminEvent();
        if (newEvent) {
          setCurrentEvent(newEvent);
          // Store in context for persistence across navigation
          setContextEvent(newEvent);
          setStreamingEventId(newEvent.id);
        }
      } else {
        setError('No upcoming events found. Please schedule an event first.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userProfile, setContextEvent, setStreamingEventId, createAdminEvent]);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    if (!currentEvent) return;
    
    try {
      setAnalyticsLoading(true);
      
      // Fetch event with latest viewer count
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('viewer_count, start_time, price')
        .eq('id', currentEvent.id)
        .single();

      if (eventError) throw eventError;
      
      // Try to get peak_viewers if column exists
      let peakViewers = eventData?.viewer_count || 0;
      try {
        const { data: eventWithPeak } = await supabase
          .from('events')
          .select('peak_viewers')
          .eq('id', currentEvent.id)
          .single();
        if (eventWithPeak?.peak_viewers !== null && eventWithPeak?.peak_viewers !== undefined) {
          peakViewers = eventWithPeak.peak_viewers;
        }
      } catch (e) {
        // peak_viewers column might not exist, use current viewer count
      }

      // Fetch tickets sold and revenue
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('id, user_id, email, purchase_date, events:event_id(price)')
        .eq('event_id', currentEvent.id)
        .eq('status', 'active');

      if (ticketsError) {
        console.error('Error fetching tickets:', ticketsError);
        throw ticketsError;
      }

      // Debug: Log ticket data
      console.log('📊 Tickets data:', {
        eventId: currentEvent.id,
        ticketsCount: ticketsData?.length || 0,
        tickets: ticketsData?.map(t => ({
          id: t.id,
          user_id: t.user_id,
          email: t.email,
          purchase_date: t.purchase_date
        })) || []
      });

      // Fetch chat messages count (excluding deleted)
      const { data: chatData, error: chatError } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', currentEvent.id)
        .is('deleted_at', null);

      if (chatError && chatError.code !== 'PGRST116') {
        console.warn('Error fetching chat messages:', chatError);
      }

      // Manually calculate viewer count from viewer_sessions as a verification
      const { data: viewerSessionsData, error: viewerSessionsError } = await supabase
        .from('viewer_sessions')
        .select('device_id, user_id, is_active, last_seen')
        .eq('event_id', currentEvent.id)
        .eq('is_active', true);

      let currentViewers = eventData?.viewer_count || 0;
      
      if (!viewerSessionsError && viewerSessionsData) {
        const now = new Date();
        const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
        const activeSessions = viewerSessionsData.filter(session => {
          const lastSeen = new Date(session.last_seen);
          return lastSeen > twoMinutesAgo;
        });
        // Count distinct user_id when available, otherwise use device_id
        // This ensures multiple logged-in users on the same device are counted separately
        const distinctViewers = new Set(
          activeSessions.map(s => s.user_id || s.device_id)
        );
        const manualViewerCount = distinctViewers.size;
        
        console.log('📊 Viewer sessions debug:', {
          eventId: currentEvent.id,
          totalSessions: viewerSessionsData.length,
          activeSessions: activeSessions.length,
          distinctViewers: manualViewerCount,
          databaseViewerCount: eventData?.viewer_count || 0,
          sessions: activeSessions.map(s => ({
            device_id: s.device_id?.substring(0, 8) + '...',
            user_id: s.user_id || 'anonymous',
            identifier: s.user_id || s.device_id,
            last_seen: s.last_seen
          }))
        });

        // Use manual count if it's different from database (database might be stale)
        if (manualViewerCount !== currentViewers) {
          console.log(`⚠️ Viewer count mismatch! Database: ${currentViewers}, Manual: ${manualViewerCount}`);
          // Update database if manual count is higher
          if (manualViewerCount > currentViewers) {
            try {
              await supabase
                .from('events')
                .update({ viewer_count: manualViewerCount })
                .eq('id', currentEvent.id);
              currentViewers = manualViewerCount;
              console.log('✅ Updated viewer count in database');
            } catch (e) {
              console.warn('Could not update viewer count:', e);
            }
          }
        }
      } else {
        console.warn('Could not fetch viewer sessions:', viewerSessionsError);
      }

      // Calculate metrics
      const ticketsSold = ticketsData?.length || 0;
      const totalRevenue = ticketsData?.reduce((sum: number, ticket: any) => {
        return sum + (ticket.events?.price || currentEvent.price || 0);
      }, 0) || 0;
      
      // Use artist-specific revenue percentage if available, otherwise use global
      const effectiveArtistPercentage = artistSpecificRevenuePercentage !== null 
        ? artistSpecificRevenuePercentage 
        : artistRevenuePercentage;
      
      // Calculate platform percentage (100 - artist percentage)
      const effectivePlatformPercentage = 100 - effectiveArtistPercentage;
      
      // Calculate revenue distribution based on effective percentages
      const platformRevenue = (totalRevenue * (effectivePlatformPercentage / 100));
      const artistRevenue = (totalRevenue * (effectiveArtistPercentage / 100));
      
      const chatMessages = chatData?.length || 0;

      // Calculate stream duration
      let streamDuration = 0;
      if (currentEvent.start_time && currentEvent.status === 'live') {
        const startTime = new Date(currentEvent.start_time).getTime();
        const now = Date.now();
        streamDuration = Math.floor((now - startTime) / 1000); // in seconds
      }

      // Update peak viewers if current is higher
      const finalPeakViewers = Math.max(peakViewers, currentViewers);
      if (currentViewers > peakViewers) {
        try {
          await supabase
            .from('events')
            .update({ peak_viewers: currentViewers })
            .eq('id', currentEvent.id);
        } catch (e) {
          // peak_viewers column might not exist, ignore error
        }
      }

      setAnalytics({
        currentViewers,
        peakViewers: finalPeakViewers,
        totalViewers: currentViewers,
        streamDuration,
        ticketsSold,
        revenue: totalRevenue,
        platformRevenue,
        artistRevenue,
        chatMessages,
        averageViewers: currentViewers,
      });
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Set up real-time subscription for viewer count
  useEffect(() => {
    if (!currentEvent || activeTab !== 'analytics') return;

    // Initial fetch
    fetchAnalytics();

    // Set up real-time subscription
    const channel = supabase
      .channel(`event-analytics-${currentEvent.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${currentEvent.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          setAnalytics(prev => ({
            ...prev,
            currentViewers: newData.viewer_count || 0,
            peakViewers: Math.max(prev.peakViewers, newData.viewer_count || 0),
          }));
        }
      )
      .subscribe();

    // Update stream duration every second when live
    let durationInterval: NodeJS.Timeout | null = null;
    if (currentEvent.status === 'live' && currentEvent.start_time) {
      durationInterval = setInterval(() => {
        const startTime = new Date(currentEvent.start_time).getTime();
        const now = Date.now();
        const duration = Math.floor((now - startTime) / 1000);
        setAnalytics(prev => ({ ...prev, streamDuration: duration }));
      }, 1000);
    }

    // Refresh analytics periodically
    const refreshInterval = setInterval(() => {
      fetchAnalytics();
    }, 10000); // Every 10 seconds

    return () => {
      channel.unsubscribe();
      if (durationInterval) clearInterval(durationInterval);
      clearInterval(refreshInterval);
    };
  }, [currentEvent?.id, activeTab, currentEvent?.status, currentEvent?.start_time]);

  // Block leaving the page while live: use isStreaming (set as soon as they go live) OR DB status
  const isLive = !!currentEvent && (currentEvent.status === 'live' || isStreaming);

  // Keep currentEvent in sync with DB (e.g. status -> 'live') so isLive stays correct
  useEffect(() => {
    if (!currentEvent?.id) return;
    const channel = supabase
      .channel(`golive-event-${currentEvent.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${currentEvent.id}` },
        (payload) => {
          const newData = payload.new as any;
          setCurrentEvent((prev: any) => {
            if (!prev) return prev;
            const next = { ...prev, ...newData };
            setContextEvent(next);
            return next;
          });
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [currentEvent?.id, setContextEvent]);

  useEffect(() => {
    if (!isLive) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = LIVE_LEAVE_MESSAGE;
      return LIVE_LEAVE_MESSAGE;
    };

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
      window.alert(LIVE_LEAVE_MESSAGE);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isLive]);

  // Block in-app navigation when live: intercept any internal link click (capture phase)
  useEffect(() => {
    if (!isLive) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href]');
      if (!anchor) return;
      const href = (anchor.getAttribute('href') ?? '').trim();
      if (!href || href === '#' || href.startsWith('javascript:')) return;
      const isInternal = href.startsWith('/') || href.startsWith(window.location.origin);
      if (isInternal) {
        e.preventDefault();
        e.stopPropagation();
        window.alert(LIVE_LEAVE_MESSAGE);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isLive]);

  // Loading UI
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
        </div>
        <p className="mt-6 text-gray-400 font-medium">Loading streaming studio...</p>
      </div>
    );
  }

  // Permissions check
  if (!userProfile || !['artist', 'global_admin', 'super_admin'].includes(userProfile.user_type)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white">
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-xl rounded-3xl p-12 border border-red-500/30 shadow-2xl max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center border-4 border-red-500/30">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            Access Denied
          </h2>
          <p className="text-gray-400 text-lg">You don't have access to the streaming studio.</p>
        </div>
      </div>
    );
  }

  // Agora config check
  if (!import.meta.env.VITE_AGORA_APP_ID) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
        <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-xl border-2 border-red-500/50 text-red-400 p-8 rounded-3xl w-[520px] shadow-2xl">
          <div className="flex items-start">
            <div className="w-12 h-12 rounded-xl bg-red-500/30 flex items-center justify-center mr-4 flex-shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-xl mb-2 text-red-300">Agora App ID Required</h3>
              <p className="text-red-200/80">Please configure VITE_AGORA_APP_ID in your environment file.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No event found UI
  if (!currentEvent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white">
        <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-xl rounded-3xl p-12 border border-purple-500/30 shadow-2xl max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-purple-500/20 flex items-center justify-center border-4 border-purple-500/30">
            <Tv className="w-10 h-10 text-purple-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            No Event Available
          </h2>
          <p className="text-gray-400 mb-8 text-lg">Schedule an event to start streaming</p>
          <a
            href="/schedule"
            className="inline-flex items-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-xl font-bold shadow-xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all duration-300"
          >
            Schedule Event
          </a>
        </div>
      </div>
    );
  }

  // Create concert object only when currentEvent exists
  const concert: Concert = {
    id: currentEvent.id,
    artistId: currentEvent.artist_id,
    title: currentEvent.title,
    date: currentEvent.start_time,
    time: new Date(currentEvent.start_time).toLocaleTimeString(),
    imageUrl: currentEvent.image_url,
    description: currentEvent.description,
    categories: ['Music'],
    duration: currentEvent.duration,
    isLive: currentEvent.status === 'live',
    price: currentEvent.price,
    maxTickets: 1000,
    soldTickets: 0,
    streamUrl: currentEvent.stream_url,
  };

  return (
    <>
      <div className="flex flex-col md:flex-row min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl"></div>
        </div>

        {/* Left Sidebar - Fixed Sticky Design */}
        <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-72 border-r border-white/5 bg-gradient-to-b from-black/80 via-gray-950/60 to-black/80 backdrop-blur-2xl p-6 flex-col z-40 shadow-2xl overflow-y-auto">
          <div className="mb-10">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Tv className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
                  Creator Studio
                </h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest">Professional</p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            <button 
              onClick={() => setActiveTab('stream')}
              className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 group border ${
                activeTab === 'stream'
                  ? 'bg-gradient-to-r from-purple-600/30 via-pink-600/30 to-purple-600/30 hover:from-purple-600/40 hover:via-pink-600/40 hover:to-purple-600/40 border-purple-500/30 shadow-lg shadow-purple-500/10'
                  : 'hover:bg-white/5 border-transparent hover:border-white/10'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 transition-colors ${
                activeTab === 'stream' ? 'bg-white/10 group-hover:bg-white/20' : 'bg-white/5 group-hover:bg-purple-500/20'
              }`}>
                <Tv className={`w-5 h-5 transition-colors ${
                  activeTab === 'stream' ? 'text-purple-300' : 'text-gray-400 group-hover:text-purple-400'
                }`} />
              </div>
              <span className={`font-semibold transition-colors ${
                activeTab === 'stream' ? 'text-white' : 'text-gray-300 group-hover:text-white'
              }`}>Stream</span>
            </button>
            {analyticsEnabled && (
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 group border ${
                  activeTab === 'analytics'
                    ? 'bg-gradient-to-r from-blue-600/30 via-cyan-600/30 to-blue-600/30 hover:from-blue-600/40 hover:via-cyan-600/40 hover:to-blue-600/40 border-blue-500/30 shadow-lg shadow-blue-500/10'
                    : 'hover:bg-white/5 border-transparent hover:border-white/10'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 transition-colors ${
                  activeTab === 'analytics' ? 'bg-white/10 group-hover:bg-white/20' : 'bg-white/5 group-hover:bg-blue-500/20'
                }`}>
                  <BarChart className={`w-5 h-5 transition-colors ${
                    activeTab === 'analytics' ? 'text-blue-300' : 'text-gray-400 group-hover:text-blue-400'
                  }`} />
                </div>
                <span className={`font-semibold transition-colors ${
                  activeTab === 'analytics' ? 'text-white' : 'text-gray-300 group-hover:text-white'
                }`}>Analytics</span>
              </button>
            )}
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 group border ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-purple-600/30 via-pink-600/30 to-purple-600/30 hover:from-purple-600/40 hover:via-pink-600/40 hover:to-purple-600/40 border-purple-500/30 shadow-lg shadow-purple-500/10'
                  : 'hover:bg-white/5 border-transparent hover:border-white/10'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 transition-colors ${
                activeTab === 'settings' ? 'bg-white/10 group-hover:bg-white/20' : 'bg-white/5 group-hover:bg-purple-500/20'
              }`}>
                <SlidersHorizontal className={`w-5 h-5 transition-colors ${
                  activeTab === 'settings' ? 'text-purple-300' : 'text-gray-400 group-hover:text-purple-400'
                }`} />
              </div>
              <span className={`font-semibold transition-colors ${
                activeTab === 'settings' ? 'text-white' : 'text-gray-300 group-hover:text-white'
              }`}>Settings</span>
            </button>
          </nav>

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-xs text-gray-500 mb-4 font-bold uppercase tracking-widest">Studio Mode</p>
            <div className="space-y-2">
              <button
                onClick={() => setStudioMode('desktop')}
                className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 ${
                  studioMode === 'desktop'
                    ? 'bg-gradient-to-r from-blue-600/30 to-cyan-600/30 text-blue-200 border-2 border-blue-500/50 shadow-xl shadow-blue-500/20'
                    : 'hover:bg-white/5 text-gray-400 border border-transparent hover:border-white/10'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 ${
                  studioMode === 'desktop' ? 'bg-blue-500/20' : 'bg-white/5'
                }`}>
                  <Monitor className="w-5 h-5" />
                </div>
                <span className="font-semibold">Desktop View</span>
              </button>
              {/* Only show mobile mode button on actual mobile devices */}
              {isMobileDevice && (
                <button
                  onClick={() => {
                    setStudioMode('mobile');
                    setShowMobileStudio(true);
                  }}
                  className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-300 ${
                    studioMode === 'mobile'
                      ? 'bg-gradient-to-r from-pink-600/30 to-rose-600/30 text-pink-200 border-2 border-pink-500/50 shadow-xl shadow-pink-500/20'
                      : 'hover:bg-white/5 text-gray-400 border border-transparent hover:border-white/10'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mr-3 ${
                    studioMode === 'mobile' ? 'bg-pink-500/20' : 'bg-white/5'
                  }`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <span className="font-semibold">Mobile Live</span>
                </button>
              )}
            </div>
          </div>

          {(userProfile.user_type === 'global_admin' || userProfile.user_type === 'super_admin') && (
            <div className="mt-auto bg-gradient-to-r from-yellow-600/20 via-orange-600/20 to-yellow-600/20 text-yellow-300 px-4 py-3 rounded-xl text-sm flex items-center border border-yellow-500/30 shadow-lg backdrop-blur-sm">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center mr-3">
                <Settings className="w-5 h-5" />
              </div>
              <span className="font-bold">Admin Mode</span>
            </div>
          )}
        </aside>

        {/* Mobile Top Bar - Enhanced */}
        <div className="md:hidden bg-gradient-to-r from-black/90 to-gray-950/90 backdrop-blur-xl border-b border-white/10 p-4 shadow-xl relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                <Tv className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  Creator Studio
                </h1>
                <p className="text-xs text-gray-500">Professional Streaming</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {(userProfile.user_type === 'global_admin' || userProfile.user_type === 'super_admin') && (
                <span className="bg-gradient-to-r from-yellow-600/30 to-orange-600/30 text-yellow-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-yellow-500/30">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Streaming Area - Enhanced */}
        <main className="flex-1 p-6 md:p-8 md:ml-72 flex flex-col gap-6 md:gap-8 overflow-y-auto pb-8 relative z-10">
          {/* Analytics Tab Content */}
          {activeTab === 'analytics' && analyticsEnabled && (
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <BarChart className="w-6 h-6 text-blue-400" />
                  Stream Analytics
                </h2>
                {analyticsLoading && (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <span>Updating...</span>
                  </div>
                )}
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-xl p-5 border border-blue-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-300 text-sm font-medium">Current Viewers</p>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                  <p className="text-3xl font-bold text-white">{analytics.currentViewers}</p>
                  <p className="text-xs text-gray-400 mt-1">Live count</p>
                </div>

                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-5 border border-purple-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-300 text-sm font-medium">Peak Viewers</p>
                    <BarChart className="w-4 h-4 text-purple-300" />
                  </div>
                  <p className="text-3xl font-bold text-white">{analytics.peakViewers}</p>
                  <p className="text-xs text-gray-400 mt-1">Highest concurrent</p>
                </div>

                <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-xl p-5 border border-green-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-300 text-sm font-medium">Stream Duration</p>
                    <Video className="w-4 h-4 text-green-300" />
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {analytics.streamDuration > 0 
                      ? `${Math.floor(analytics.streamDuration / 60)}:${String(Math.floor(analytics.streamDuration % 60)).padStart(2, '0')}`
                      : '0:00'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">MM:SS format</p>
                </div>

                <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 rounded-xl p-5 border border-orange-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-300 text-sm font-medium">Chat Messages</p>
                    <MessageCircle className="w-4 h-4 text-orange-300" />
                  </div>
                  <p className="text-3xl font-bold text-white">{analytics.chatMessages}</p>
                  <p className="text-xs text-gray-400 mt-1">Total messages</p>
                </div>
              </div>

              {/* Revenue & Tickets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-yellow-600/20 to-amber-600/20 rounded-xl p-5 border border-yellow-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-300 text-sm font-medium">Tickets Sold</p>
                    <Users className="w-4 h-4 text-yellow-300" />
                  </div>
                  <p className="text-3xl font-bold text-white">{analytics.ticketsSold}</p>
                  <p className="text-xs text-gray-400 mt-1">Active tickets</p>
                </div>

                <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-5 border border-purple-500/30 shadow-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-300 text-sm font-medium">Artist Revenue</p>
                    <Music className="w-4 h-4 text-purple-300" />
                  </div>
                  <p className="text-3xl font-bold text-white">
                    €{analytics.artistRevenue.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {artistSpecificRevenuePercentage !== null 
                      ? `${artistSpecificRevenuePercentage}% (custom)` 
                      : `${artistRevenuePercentage}% (global)`} of total revenue
                  </p>
                </div>
              </div>

              {/* Additional Stats */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-blue-400" />
                  Performance Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Average Viewers</p>
                    <p className="text-2xl font-bold text-white">{analytics.averageViewers}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Engagement Rate</p>
                    <p className="text-2xl font-bold text-white">
                      {analytics.currentViewers > 0 && analytics.chatMessages > 0
                        ? `${((analytics.chatMessages / analytics.currentViewers) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Conversion Rate</p>
                    <p className="text-2xl font-bold text-white">
                      {analytics.currentViewers > 0
                        ? `${((analytics.ticketsSold / analytics.currentViewers) * 100).toFixed(1)}%`
                        : '0%'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab Content */}
          {activeTab === 'settings' && (
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <SlidersHorizontal className="w-6 h-6 text-purple-400" />
                Stream Settings
              </h2>
              <div className="space-y-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <label className="text-white font-semibold mb-2 block">Stream Quality</label>
                  <select className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white">
                    <option>Auto (Recommended)</option>
                    <option>720p HD</option>
                    <option>1080p Full HD</option>
                  </select>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <label className="text-white font-semibold mb-2 block">Audio Quality</label>
                  <select className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white">
                    <option>High (Recommended)</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
                    <span className="text-white">Enable chat moderation</span>
                  </label>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
                    <span className="text-white">Record stream automatically</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Stream Tab Content */}
          {activeTab === 'stream' && (
            <>
          {/* Stream Info Header - Modern Card Design */}
          <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                  <span className="text-sm font-bold text-red-400 uppercase tracking-wider">Live</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-2">
                  {concert.title}
                </h1>
                <p className="text-gray-400 text-sm md:text-base">
                  {new Date(concert.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-600/30 to-pink-600/30 backdrop-blur-sm px-6 py-4 rounded-2xl border border-purple-500/30 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Viewers</p>
                      <p className="text-2xl font-bold text-white">Live</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Mode Selection - Enhanced */}
          {desktopModeOnMobile && (
            <div className="md:hidden flex gap-3 mb-4 sticky top-0 z-50 bg-gray-950/95 backdrop-blur-sm py-2">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStudioMode('desktop');
                }}
                className={`flex-1 flex items-center justify-center px-4 py-4 rounded-2xl transition-all duration-300 ${
                  studioMode === 'desktop'
                    ? 'bg-gradient-to-r from-blue-600/40 to-cyan-600/40 text-blue-200 border-2 border-blue-500/50 shadow-xl shadow-blue-500/20'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                <Monitor className="w-5 h-5 mr-2" />
                <span className="text-sm font-bold">Desktop</span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStudioMode('mobile');
                  setShowMobileStudio(true);
                }}
                className={`flex-1 flex items-center justify-center px-4 py-4 rounded-2xl transition-all duration-300 ${
                  studioMode === 'mobile'
                    ? 'bg-gradient-to-r from-pink-600/40 to-rose-600/40 text-pink-200 border-2 border-pink-500/50 shadow-xl shadow-pink-500/20'
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                }`}
              >
                <Smartphone className="w-5 h-5 mr-2" />
                <span className="text-sm font-bold">Mobile</span>
              </button>
            </div>
          )}

          {/* Mode Selection Banner - Only show on actual mobile devices */}
          {isMobileDevice && studioMode === 'mobile' && !showMobileStudio && (
            <div className="hidden md:block bg-gradient-to-br from-pink-600/20 via-purple-600/20 to-blue-600/20 border border-pink-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-2xl">
                      <Smartphone className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">Mobile Live Mode</h3>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileStudio(true)}
                  className="ml-6 bg-gradient-to-r from-pink-500 via-purple-600 to-pink-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-pink-500/50 transform hover:scale-105 transition-all duration-300"
                >
                  Launch Mobile Studio
                </button>
              </div>
            </div>
          )}

          {/* Quick Launch Card - Only show on actual mobile devices */}
          {isMobileDevice && studioMode === 'mobile' && !showMobileStudio && (
            <div className="md:hidden bg-gradient-to-br from-pink-600/20 via-purple-600/20 to-pink-600/20 border border-pink-500/30 rounded-3xl p-8 text-center shadow-2xl">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-2xl">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Mobile Live Mode</h3>
              <button
                onClick={() => setShowMobileStudio(true)}
                className="w-full bg-gradient-to-r from-pink-500 via-purple-600 to-pink-500 text-white px-6 py-4 rounded-2xl font-bold shadow-2xl hover:shadow-pink-500/50 transform active:scale-95 transition-all duration-300"
              >
                Start Mobile Stream
              </button>
            </div>
          )}

          {/* Streaming Studio - Enhanced Container */}
          {studioMode === 'desktop' && (
            <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm">
              <AgoraStreamingStudio key={`streaming-studio-${currentEvent.id}`} concert={concert} />
            </div>
          )}
            </>
          )}

      </main>
    </div>

    {/* Mobile Studio Modal - Only show on actual mobile devices and when on Stream tab */}
    {isMobileDevice && showMobileStudio && currentEvent && activeTab === 'stream' && (
      <MobileLiveStudio
        key={`mobile-studio-${currentEvent.id}`}
        concert={concert}
        onClose={() => {
          setShowMobileStudio(false);
          setStudioMode('desktop');
        }}
      />
    )}
  </>
  );
};

export default GoLive;
