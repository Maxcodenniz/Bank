import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { 
  Activity, 
  Users, 
  TrendingUp, 
  Calendar, 
  Ticket, 
  AlertCircle, 
  DollarSign,
  Eye,
  Clock,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  Shield,
  Video,
  UserCheck,
  XCircle,
  X,
  RotateCcw
} from 'lucide-react';
import { isSuperAdmin } from '../utils/constants';

interface ActivityLog {
  id: string;
  type: string;
  action: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
  event_id?: string;
  event_title?: string;
  details?: any;
  created_at: string;
}

interface AnalyticsData {
  totalUsers: number;
  totalArtists: number;
  totalEvents: number;
  totalTickets: number;
  totalRevenue: number;
  activeStreams: number;
  todayRevenue: number;
  todayTickets: number;
  todayUsers: number;
  recentActivity: ActivityLog[];
  topEvents: Array<{ id: string; title: string; tickets: number; revenue: number }>;
  topArtists: Array<{ id: string; name: string; events: number; revenue: number }>;
  errorCount: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

const Analytics: React.FC = () => {
  const { userProfile } = useStore();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<'all' | 'auth' | 'login' | 'logout' | 'ticket' | 'event' | 'admin'>('all');
  const [resetting, setResetting] = useState<string | null>(null);

  const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
  const isSuperAdminUser = isSuperAdmin(userProfile?.id, userProfile?.user_type);

  useEffect(() => {
    if (!userProfile) return;
    
    if (isAdmin) {
      fetchAnalytics();
      // Refresh every 30 seconds
      const interval = setInterval(fetchAnalytics, 30000);
      return () => clearInterval(interval);
    }
  }, [userProfile, dateRange, isAdmin]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }

      // Get today's date at midnight
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Fetch all data in parallel
      const [
        usersResult,
        artistsResult,
        eventsResult,
        ticketsResult,
        liveEventsResult,
        todayTicketsResult,
        todayUsersResult
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('user_type', 'artist'),
        supabase.from('events').select('id, title, status, viewer_count, created_at, start_time, artist_id'),
        supabase.from('tickets')
          .select(`
            id,
            purchase_date,
            status,
            event_id,
            events:event_id (
              price,
              title,
              artist_id,
              profiles:artist_id (
                full_name,
                username
              )
            )
          `)
          .eq('status', 'active'),
        supabase.from('events').select('id, title, status').eq('status', 'live'),
        supabase.from('tickets')
          .select(`
            id,
            events:event_id (price)
          `)
          .eq('status', 'active')
          .gte('purchase_date', todayStart.toISOString()),
        supabase.from('profiles')
          .select('id')
          .gte('created_at', todayStart.toISOString())
      ]);

      // Calculate revenue
      const allTickets = ticketsResult.data || [];
      const totalRevenue = allTickets.reduce((sum: number, t: any) => {
        const price = t.events?.price || 0;
        return sum + price;
      }, 0);

      const todayTickets = todayTicketsResult.data || [];
      const todayRevenue = todayTickets.reduce((sum: number, t: any) => {
        const price = t.events?.price || 0;
        return sum + price;
      }, 0);

      // Get top events by ticket sales
      const eventTicketMap: Record<string, { title: string; count: number; revenue: number }> = {};
      allTickets.forEach((ticket: any) => {
        if (ticket.events) {
          const eventId = ticket.events.id || ticket.event_id;
          if (!eventTicketMap[eventId]) {
            eventTicketMap[eventId] = {
              title: ticket.events.title || 'Unknown Event',
              count: 0,
              revenue: 0
            };
          }
          eventTicketMap[eventId].count++;
          eventTicketMap[eventId].revenue += ticket.events.price || 0;
        }
      });

      const topEvents = Object.entries(eventTicketMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Get top artists by revenue
      const artistRevenueMap: Record<string, { name: string; events: number; revenue: number }> = {};
      allTickets.forEach((ticket: any) => {
        if (ticket.events?.profiles) {
          const artistId = ticket.events.artist_id;
          const artistName = ticket.events.profiles.full_name || ticket.events.profiles.username || 'Unknown';
          if (!artistRevenueMap[artistId]) {
            artistRevenueMap[artistId] = {
              name: artistName,
              events: 0,
              revenue: 0
            };
          }
          artistRevenueMap[artistId].revenue += ticket.events.price || 0;
        }
      });

      // Count events per artist
      const eventsList = eventsResult.data || [];
      eventsList.forEach((event: any) => {
        if (event.artist_id && artistRevenueMap[event.artist_id]) {
          artistRevenueMap[event.artist_id].events++;
        }
      });

      const topArtists = Object.entries(artistRevenueMap)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Fetch auth logs
      const { data: authLogs } = await supabase
        .from('auth_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      // Build recent activity log
      const recentActivity: ActivityLog[] = [];

      // Add auth logs to activity
      if (authLogs) {
        authLogs.forEach((log: any) => {
          const actionLabel = log.action === 'login_success' ? 'logged in' :
                             log.action === 'login_failed' ? 'failed login attempt' :
                             log.action === 'logout' ? 'logged out' :
                             log.action === 'password_reset_request' ? 'requested password reset' :
                             log.action;
          
          recentActivity.push({
            id: log.id,
            type: 'auth',
            action: actionLabel,
            user_id: log.user_id,
            user_email: log.email,
            details: {
              success: log.success,
              failure_reason: log.failure_reason,
              ip_address: log.ip_address,
              user_agent: log.user_agent
            },
            created_at: log.created_at
          });
        });
      }

      // Recent ticket purchases
      const recentTickets = allTickets
        .filter((t: any) => new Date(t.purchase_date) >= startDate)
        .sort((a: any, b: any) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime())
        .slice(0, 20);

      recentTickets.forEach((ticket: any) => {
        // Check if this is an admin-granted ticket
        const isAdminGranted = ticket.stripe_payment_id === 'admin_granted' || 
                               (ticket.stripe_session_id && ticket.stripe_session_id.startsWith('admin_'));
        
        recentActivity.push({
          id: ticket.id,
          type: 'ticket',
          action: isAdminGranted ? 'admin granted' : 'purchased',
          event_id: ticket.event_id,
          event_title: ticket.events?.title || 'Unknown Event',
          user_email: ticket.email || 'Guest',
          details: {
            price: isAdminGranted ? 0 : (ticket.events?.price || 0),
            status: ticket.status,
            admin_granted: isAdminGranted
          },
          created_at: ticket.purchase_date
        });
      });

      // Recent events
      const recentEvents = eventsList
        .filter((e: any) => new Date(e.created_at || e.start_time) >= startDate)
        .sort((a: any, b: any) => new Date(b.created_at || b.start_time).getTime() - new Date(a.created_at || a.start_time).getTime())
        .slice(0, 10);

      recentEvents.forEach((event: any) => {
        recentActivity.push({
          id: event.id,
          type: 'event',
          action: 'created',
          event_id: event.id,
          event_title: event.title,
          details: {
            status: event.status,
            viewer_count: event.viewer_count || 0
          },
          created_at: event.created_at || event.start_time
        });
      });

      // Sort activity by date
      recentActivity.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Calculate login stats
      const loginStats = {
        successful: authLogs?.filter((l: any) => l.action === 'login_success' && l.success).length || 0,
        failed: authLogs?.filter((l: any) => l.action === 'login_failed' && !l.success).length || 0,
        logouts: authLogs?.filter((l: any) => l.action === 'logout').length || 0
      };

      setAnalytics({
        totalUsers: usersResult.count || 0,
        totalArtists: artistsResult.count || 0,
        totalEvents: eventsList.length,
        totalTickets: allTickets.length,
        totalRevenue,
        activeStreams: liveEventsResult.data?.length || 0,
        todayRevenue,
        todayTickets: todayTickets.length,
        todayUsers: todayUsersResult.data?.length || 0,
        recentActivity: recentActivity.slice(0, 50),
        topEvents,
        topArtists,
        errorCount: loginStats.failed,
        systemHealth: loginStats.failed > 50 ? 'warning' : 'healthy',
        loginStats
      });
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(`Failed to load analytics: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = () => {
    if (!analytics) return;

    const csv = [
      ['Metric', 'Value'].join(','),
      ['Total Users', analytics.totalUsers].join(','),
      ['Total Artists', analytics.totalArtists].join(','),
      ['Total Events', analytics.totalEvents].join(','),
      ['Total Tickets', analytics.totalTickets].join(','),
      ['Total Revenue', analytics.totalRevenue.toFixed(2)].join(','),
      ['Active Streams', analytics.activeStreams].join(','),
      ['Today Revenue', analytics.todayRevenue.toFixed(2)].join(','),
      ['Today Tickets', analytics.todayTickets].join(','),
      ['Today Users', analytics.todayUsers].join(',')
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const confirmReset = (label: string) =>
    window.confirm(`Are you sure you want to reset ${label}? This cannot be undone.`);

  const handleResetRevenueAndTickets = async () => {
    if (!isSuperAdminUser || !confirmReset('Total Revenue and Total Tickets (this will delete all tickets from user accounts)')) return;
    setResetting('revenue_tickets');
    try {
      const { data, error } = await supabase.rpc('reset_analytics_tickets');
      if (error) throw error;
      setError(null);
      await fetchAnalytics();
    } catch (err: any) {
      setError(err?.message || 'Failed to reset revenue and tickets');
    } finally {
      setResetting(null);
    }
  };

  const handleResetSuccessfulLogins = async () => {
    if (!isSuperAdminUser || !confirmReset('Successful Logins')) return;
    setResetting('successful_logins');
    try {
      const { error } = await supabase.rpc('reset_auth_logs_successful_logins');
      if (error) throw error;
      setError(null);
      await fetchAnalytics();
    } catch (err: any) {
      setError(err?.message || 'Failed to reset successful logins');
    } finally {
      setResetting(null);
    }
  };

  const handleResetFailedLogins = async () => {
    if (!isSuperAdminUser || !confirmReset('Failed Logins')) return;
    setResetting('failed_logins');
    try {
      const { error } = await supabase.rpc('reset_auth_logs_failed_logins');
      if (error) throw error;
      setError(null);
      await fetchAnalytics();
    } catch (err: any) {
      setError(err?.message || 'Failed to reset failed logins');
    } finally {
      setResetting(null);
    }
  };

  const handleResetLogouts = async () => {
    if (!isSuperAdminUser || !confirmReset('Logouts')) return;
    setResetting('logouts');
    try {
      const { error } = await supabase.rpc('reset_auth_logs_logouts');
      if (error) throw error;
      setError(null);
      await fetchAnalytics();
    } catch (err: any) {
      setError(err?.message || 'Failed to reset logouts');
    } finally {
      setResetting(null);
    }
  };

  const handleResetRecentActivity = async () => {
    if (!isSuperAdminUser || !confirmReset('Recent Activity (all auth logs)')) return;
    setResetting('recent_activity');
    try {
      const { error } = await supabase.rpc('reset_auth_logs_recent_activity');
      if (error) throw error;
      setError(null);
      await fetchAnalytics();
    } catch (err: any) {
      setError(err?.message || 'Failed to reset recent activity');
    } finally {
      setResetting(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500/30 border-t-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-purple-300" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                Analytics & Logs
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
              <button
                onClick={exportAnalytics}
                disabled={!analytics}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 border border-green-500/30 rounded-xl text-green-300 hover:text-green-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-semibold">Export</span>
              </button>
              <button
                onClick={fetchAnalytics}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/30 rounded-xl text-purple-300 hover:text-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-semibold">Refresh</span>
              </button>
            </div>
          </div>
          <p className="text-gray-400">Platform analytics and activity logs</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300">
            {error}
          </div>
        )}

        {loading && !analytics ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500/30 border-t-purple-500"></div>
          </div>
        ) : analytics ? (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Users</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                      {analytics.totalUsers}
                    </p>
                    <p className="text-xs text-green-400 mt-1">+{analytics.todayUsers} today</p>
                  </div>
                  <Users className="w-8 h-8 text-purple-300 opacity-50" />
                </div>
              </div>

              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">
                      {formatCurrency(analytics.totalRevenue)}
                    </p>
                    <p className="text-xs text-green-400 mt-1">+{formatCurrency(analytics.todayRevenue)} today</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-8 h-8 text-green-300 opacity-50" />
                    {isSuperAdminUser && (
                      <button
                        type="button"
                        onClick={handleResetRevenueAndTickets}
                        disabled={resetting !== null}
                        title="Reset Total Revenue (deletes all tickets)"
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className={`w-4 h-4 ${resetting === 'revenue_tickets' ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Total Tickets</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                      {analytics.totalTickets}
                    </p>
                    <p className="text-xs text-green-400 mt-1">+{analytics.todayTickets} today</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="w-8 h-8 text-blue-300 opacity-50" />
                    {isSuperAdminUser && (
                      <button
                        type="button"
                        onClick={handleResetRevenueAndTickets}
                        disabled={resetting !== null}
                        title="Reset Total Tickets (deletes all tickets from user accounts)"
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw className={`w-4 h-4 ${resetting === 'revenue_tickets' ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Active Streams</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-red-300 to-orange-300 bg-clip-text text-transparent">
                      {analytics.activeStreams}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Live now</p>
                  </div>
                  <Video className="w-8 h-8 text-red-300 opacity-50" />
                </div>
              </div>
            </div>

            {/* Login Stats */}
            {analytics.loginStats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Successful Logins</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">
                        {analytics.loginStats.successful}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Last {dateRange === '24h' ? '24h' : dateRange === '7d' ? '7 days' : dateRange === '30d' ? '30 days' : 'all time'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-8 h-8 text-green-300 opacity-50" />
                      {isSuperAdminUser && (
                        <button
                          type="button"
                          onClick={handleResetSuccessfulLogins}
                          disabled={resetting !== null}
                          title="Reset Successful Logins"
                          className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className={`w-4 h-4 ${resetting === 'successful_logins' ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Failed Logins</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-red-300 to-orange-300 bg-clip-text text-transparent">
                        {analytics.loginStats.failed}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Security monitoring</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="w-8 h-8 text-red-300 opacity-50" />
                      {isSuperAdminUser && (
                        <button
                          type="button"
                          onClick={handleResetFailedLogins}
                          disabled={resetting !== null}
                          title="Reset Failed Logins"
                          className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className={`w-4 h-4 ${resetting === 'failed_logins' ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Logouts</p>
                      <p className="text-3xl font-bold bg-gradient-to-r from-blue-300 to-cyan-300 bg-clip-text text-transparent">
                        {analytics.loginStats.logouts}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">User sessions</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-8 h-8 text-blue-300 opacity-50" />
                      {isSuperAdminUser && (
                        <button
                          type="button"
                          onClick={handleResetLogouts}
                          disabled={resetting !== null}
                          title="Reset Logouts"
                          className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className={`w-4 h-4 ${resetting === 'logouts' ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Top Events */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-300" />
                  Top Events by Revenue
                </h2>
                <div className="space-y-3">
                  {analytics.topEvents.length > 0 ? (
                    analytics.topEvents.map((event, index) => (
                      <div key={event.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-sm font-bold text-purple-300">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-white font-medium">{event.title}</p>
                            <p className="text-xs text-gray-400">{event.count} tickets</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-semibold">{formatCurrency(event.revenue)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center py-4">No events found</p>
                  )}
                </div>
              </div>

              {/* Top Artists */}
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-300" />
                  Top Artists by Revenue
                </h2>
                <div className="space-y-3">
                  {analytics.topArtists.length > 0 ? (
                    analytics.topArtists.map((artist, index) => (
                      <div key={artist.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-sm font-bold text-purple-300">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-white font-medium">{artist.name}</p>
                            <p className="text-xs text-gray-400">{artist.events} events</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-green-400 font-semibold">{formatCurrency(artist.revenue)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-400 text-center py-4">No artists found</p>
                  )}
                </div>
              </div>
            </div>

            {/* Activity Log */}
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-300" />
                  Recent Activity
                </h2>
                <div className="flex items-center gap-2">
                  {isSuperAdminUser && (
                    <button
                      type="button"
                      onClick={handleResetRecentActivity}
                      disabled={resetting !== null}
                      title="Reset Recent Activity (clear all auth logs)"
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <RotateCcw className={`w-4 h-4 ${resetting === 'recent_activity' ? 'animate-spin' : ''}`} />
                      Reset Activity
                    </button>
                  )}
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <select
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value as 'all' | 'auth' | 'login' | 'logout' | 'ticket' | 'event' | 'admin')}
                      className="pl-9 pr-8 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50 appearance-none cursor-pointer"
                    >
                      <option value="all">All Activities</option>
                      <option value="auth">All Authentication</option>
                      <option value="login">Logins</option>
                      <option value="logout">Logouts</option>
                      <option value="ticket">Ticket Purchases</option>
                      <option value="admin">Admin Actions</option>
                      <option value="event">Event Creation</option>
                    </select>
                  </div>
                  {activityFilter !== 'all' && (
                    <button
                      onClick={() => setActivityFilter('all')}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="Clear filter"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                {analytics.recentActivity.filter(activity => {
                  if (activityFilter === 'all') return true;
                  if (activityFilter === 'auth') return activity.type === 'auth';
                  if (activityFilter === 'login') {
                    return activity.type === 'auth' && (
                      activity.action === 'logged in' || 
                      activity.action === 'login_success' ||
                      (activity.details?.success === true && activity.action?.includes('login'))
                    );
                  }
                  if (activityFilter === 'logout') {
                    return activity.type === 'auth' && (
                      activity.action === 'logged out' || 
                      activity.action === 'logout'
                    );
                  }
                  if (activityFilter === 'ticket') {
                    return activity.type === 'ticket' && !activity.details?.admin_granted;
                  }
                  if (activityFilter === 'admin') {
                    return activity.type === 'ticket' && activity.details?.admin_granted === true;
                  }
                  if (activityFilter === 'event') {
                    return activity.type === 'event';
                  }
                  return activity.type === activityFilter;
                }).length > 0 ? (
                  analytics.recentActivity
                    .filter(activity => {
                      if (activityFilter === 'all') return true;
                      if (activityFilter === 'auth') return activity.type === 'auth';
                      if (activityFilter === 'login') {
                        return activity.type === 'auth' && (
                          activity.action === 'logged in' || 
                          activity.action === 'login_success' ||
                          (activity.details?.success === true && activity.action?.includes('login'))
                        );
                      }
                      if (activityFilter === 'logout') {
                        return activity.type === 'auth' && (
                          activity.action === 'logged out' || 
                          activity.action === 'logout'
                        );
                      }
                      if (activityFilter === 'ticket') {
                        return activity.type === 'ticket' && !activity.details?.admin_granted;
                      }
                      if (activityFilter === 'admin') {
                        return activity.type === 'ticket' && activity.details?.admin_granted === true;
                      }
                      if (activityFilter === 'event') {
                        return activity.type === 'event';
                      }
                      return activity.type === activityFilter;
                    })
                    .map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
                        {activity.type === 'ticket' ? (
                          activity.details?.admin_granted ? (
                            <Shield className="w-4 h-4 text-yellow-300" />
                          ) : (
                            <Ticket className="w-4 h-4 text-purple-300" />
                          )
                        ) : activity.type === 'event' ? (
                          <Calendar className="w-4 h-4 text-purple-300" />
                        ) : activity.type === 'auth' ? (
                          activity.action.includes('failed') ? (
                            <XCircle className="w-4 h-4 text-red-300" />
                          ) : activity.action.includes('logged in') ? (
                            <UserCheck className="w-4 h-4 text-green-300" />
                          ) : (
                            <Shield className="w-4 h-4 text-purple-300" />
                          )
                        ) : (
                          <Activity className="w-4 h-4 text-purple-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm">
                          {activity.user_email && (
                            <span className="font-semibold text-purple-300">{activity.user_email}</span>
                          )}
                          <span className="font-semibold ml-1">{activity.action}</span>
                          {activity.event_title && (
                            <span className="text-gray-300"> - {activity.event_title}</span>
                          )}
                        </p>
                        {activity.details && (
                          <p className="text-xs text-gray-400 mt-1">
                            {activity.details.admin_granted && (
                              <span className="text-yellow-400 font-semibold">Admin Granted • </span>
                            )}
                            {activity.details.price && activity.details.price > 0 && `Price: ${formatCurrency(activity.details.price)}`}
                            {activity.details.status && ` • Status: ${activity.details.status}`}
                            {activity.details.viewer_count !== undefined && ` • Viewers: ${activity.details.viewer_count}`}
                            {activity.details.failure_reason && ` • Reason: ${activity.details.failure_reason}`}
                            {activity.details.success !== undefined && (
                              <span className={activity.details.success ? 'text-green-400' : 'text-red-400'}>
                                {activity.details.success ? ' ✓ Success' : ' ✗ Failed'}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 flex-shrink-0">
                        {formatDate(activity.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center py-4">
                    {activityFilter === 'all' 
                      ? 'No recent activity' 
                      : activityFilter === 'auth'
                      ? 'No authentication activity found'
                      : activityFilter === 'login'
                      ? 'No login activity found'
                      : activityFilter === 'logout'
                      ? 'No logout activity found'
                      : activityFilter === 'ticket'
                      ? 'No ticket purchase activity found'
                      : activityFilter === 'admin'
                      ? 'No admin actions found'
                      : 'No event creation activity found'}
                  </p>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default Analytics;

