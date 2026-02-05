import React, { useState, useEffect, useRef } from 'react';
import { Eye, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { getStoredDeviceId } from '../utils/deviceFingerprint';
import { useStore } from '../store/useStore';

interface VisitorStats {
  total: number;
  today: number;
  active: number;
}

const VisitorCounter: React.FC = () => {
  const { user } = useStore();
  const [stats, setStats] = useState<VisitorStats>({ total: 0, today: 0, active: 0 });
  const [baseCount, setBaseCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const sessionIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const pageViewTrackedRef = useRef(false);
  const sessionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Fetch base count first
    fetchBaseCount();
    
    // Track visitor on mount
    trackVisitor();
    
    // Track page view
    trackPageView();

    // Fetch visitor count
    fetchVisitorCount();

    // Set up periodic updates (every 30 seconds)
    const interval = setInterval(() => {
      updateLastVisit();
      fetchVisitorCount();
      fetchBaseCount();
    }, 30000);

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateLastVisit();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Track before page unload
    const handleBeforeUnload = () => {
      trackSessionEnd();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      trackSessionEnd();
    };
  }, []);

  const trackVisitor = async () => {
    try {
      const deviceId = getStoredDeviceId();
      const sessionId = sessionIdRef.current;
      
      // Get user info if logged in
      const userId = user?.id || null;

      // Get page info
      const pagePath = window.location.pathname;
      const referrer = document.referrer || null;

      // Check if this is a new visitor or returning
      const { data: existingVisitor } = await supabase
        .from('website_visitors')
        .select('id, visit_count, last_visit_at')
        .eq('device_id', deviceId)
        .order('last_visit_at', { ascending: false })
        .limit(1)
        .single();

      if (existingVisitor) {
        // Returning visitor - update record
        const timeSinceLastVisit = Math.floor(
          (Date.now() - new Date(existingVisitor.last_visit_at).getTime()) / 1000
        );
        
        // Consider it a new visit if last visit was more than 30 minutes ago
        const isNewVisit = timeSinceLastVisit > 1800;

        await supabase
          .from('website_visitors')
          .update({
            last_visit_at: new Date().toISOString(),
            visit_count: existingVisitor.visit_count + (isNewVisit ? 1 : 0),
            user_id: userId || undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingVisitor.id);
      } else {
        // New visitor - create record
        await supabase
          .from('website_visitors')
          .insert({
            device_id: deviceId,
            session_id: sessionId,
            user_id: userId,
            user_agent: navigator.userAgent,
            referrer: referrer,
            first_visit_at: new Date().toISOString(),
            last_visit_at: new Date().toISOString(),
            visit_count: 1,
            is_unique_visitor: true
          });
      }

      // Track session start
      await supabase
        .from('visitor_sessions')
        .insert({
          device_id: deviceId,
          session_id: sessionId,
          started_at: new Date().toISOString(),
          last_page: pagePath
        });
    } catch (error) {
      console.error('Error tracking visitor:', error);
    }
  };

  const trackPageView = async () => {
    if (pageViewTrackedRef.current) return;
    pageViewTrackedRef.current = true;

    try {
      const deviceId = getStoredDeviceId();
      const sessionId = sessionIdRef.current;
      const pagePath = window.location.pathname;
      const pageTitle = document.title;

      // Get visitor ID
      const { data: visitor } = await supabase
        .from('website_visitors')
        .select('id')
        .eq('device_id', deviceId)
        .order('last_visit_at', { ascending: false })
        .limit(1)
        .single();

      if (visitor) {
        // Track page view
        await supabase
          .from('visitor_page_views')
          .insert({
            visitor_id: visitor.id,
            session_id: sessionId,
            page_path: pagePath,
            page_title: pageTitle,
            viewed_at: new Date().toISOString()
          });

        // Update page views count
        await supabase.rpc('increment_visitor_page_views', {
          visitor_id_param: visitor.id
        });
      }
    } catch (error) {
      console.error('Error tracking page view:', error);
    }
  };

  const updateLastVisit = async () => {
    try {
      const deviceId = getStoredDeviceId();
      await supabase
        .from('website_visitors')
        .update({ last_visit_at: new Date().toISOString() })
        .eq('device_id', deviceId);
    } catch (error) {
      console.error('Error updating last visit:', error);
    }
  };

  const trackSessionEnd = async () => {
    try {
      const deviceId = getStoredDeviceId();
      const sessionId = sessionIdRef.current;
      const duration = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);

      await supabase
        .from('visitor_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration: duration
        })
        .eq('session_id', sessionId)
        .eq('device_id', deviceId);
    } catch (error) {
      console.error('Error tracking session end:', error);
    }
  };

  const fetchBaseCount = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'visitor_count_base')
        .single();

      if (!error && data) {
        const base = typeof data.value === 'number' 
          ? data.value 
          : parseInt(data.value as string, 10);
        setBaseCount(isNaN(base) ? 0 : base);
      }
    } catch (error) {
      console.error('Error fetching base count:', error);
    }
  };

  const fetchVisitorCount = async () => {
    try {
      // Get total unique visitors
      const { data: totalData, error: totalError } = await supabase
        .rpc('get_total_visitor_count');

      // Get today's unique visitors
      const { data: todayData, error: todayError } = await supabase
        .rpc('get_unique_visitors_today');

      // Get active visitors (last 5 minutes)
      const { data: activeData, error: activeError } = await supabase
        .rpc('get_active_visitors');

      if (!totalError && !todayError && !activeError) {
        setStats({
          total: totalData || 0,
          today: todayData || 0,
          active: activeData || 0
        });
      }
    } catch (error) {
      console.error('Error fetching visitor count:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <Eye className="h-4 w-4 animate-pulse" />
        <span className="text-sm">---</span>
      </div>
    );
  }

  // Calculate displayed count: base + actual unique visitors
  const displayedCount = baseCount + stats.total;

  return (
    <div 
      className="relative flex items-center space-x-2 text-gray-300 hover:text-yellow-400 transition-colors duration-300 cursor-pointer"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Eye className="h-4 w-4" />
      <span className="text-sm font-medium">
        {formatCount(displayedCount)}
      </span>
      
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 z-50">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Total Visitors</span>
              <span className="text-sm font-bold text-white">{formatCount(displayedCount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Base Count</span>
              <span className="text-sm font-bold text-blue-400">{formatCount(baseCount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Unique Visitors</span>
              <span className="text-sm font-bold text-purple-400">{formatCount(stats.total)}</span>
            </div>
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Today</span>
                <span className="text-sm font-bold text-green-400">{formatCount(stats.today)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-gray-400">Active Now</span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-green-400">{formatCount(stats.active)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisitorCounter;