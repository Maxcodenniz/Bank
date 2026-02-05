import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { Ticket, Search, Filter, Calendar, User, Music, RotateCcw, Download, X, Clock, TrendingUp } from 'lucide-react';

interface TicketData {
  id: string;
  event_id: string;
  event_title: string;
  artist_name: string;
  artist_id: string;
  email: string;
  price: number;
  status: string;
  purchase_date: string;
}

const TicketsManagement: React.FC = () => {
  const { userProfile } = useStore();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [allTickets, setAllTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<string>('all');
  const [selectedArtist, setSelectedArtist] = useState<string>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [customDays, setCustomDays] = useState<number>(7);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Options for filters
  const [events, setEvents] = useState<Array<{ id: string; title: string }>>([]);
  const [artists, setArtists] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!userProfile) return; // Wait for userProfile to load
    
    if (userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') {
      fetchTickets();
      fetchEvents();
      fetchArtists();
    }
  }, [userProfile]);

  useEffect(() => {
    applyFilters();
  }, [allTickets, searchQuery, selectedEvent, selectedArtist, timeFilter, customDays, statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🎫 Fetching all tickets for admin dashboard...');
      
      // Test query first
      const { data: testTickets, error: testError } = await supabase
        .from('tickets')
        .select('id, event_id, email, user_id, status')
        .limit(5);

      if (testError) {
        console.error('❌ Test query failed:', testError);
        setError(`RLS Policy Error: ${testError.message}. Please ensure the migration has been run.`);
        return;
      }

      // Full query with joins
      const { data: ticketsData, error } = await supabase
        .from('tickets')
        .select(`
          id,
          event_id,
          email,
          status,
          purchase_date,
          user_id,
          events:event_id (
            title,
            price,
            artist_id,
            profiles:artist_id (
              username,
              full_name
            )
          )
        `)
        .order('purchase_date', { ascending: false })
        .limit(5000);

      if (error) {
        console.error('❌ Error fetching tickets:', error);
        setError(`Failed to load tickets: ${error.message}`);
        return;
      }

      const formattedTickets = (ticketsData || []).map(ticket => ({
        id: ticket.id,
        event_id: ticket.event_id,
        event_title: (ticket.events as any)?.title || 'Unknown Event',
        artist_name: (ticket.events as any)?.profiles?.full_name || (ticket.events as any)?.profiles?.username || 'Unknown Artist',
        artist_id: (ticket.events as any)?.artist_id || '',
        email: ticket.email || (ticket.user_id ? 'User' : 'Guest'),
        price: (ticket.events as any)?.price || 0,
        status: ticket.status,
        purchase_date: ticket.purchase_date
      }));

      console.log(`✅ Fetched ${formattedTickets.length} tickets`);
      setAllTickets(formattedTickets);
      setTickets(formattedTickets);
    } catch (err: any) {
      console.error('❌ Unexpected error:', err);
      setError(`Failed to load tickets: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title')
        .order('title', { ascending: true });

      if (!error && data) {
        setEvents(data);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    }
  };

  const fetchArtists = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .eq('user_type', 'artist')
        .order('full_name', { ascending: true });

      if (!error && data) {
        setArtists(data.map(p => ({
          id: p.id,
          name: p.full_name || p.username || 'Unknown Artist'
        })));
      }
    } catch (err) {
      console.error('Error fetching artists:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...allTickets];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.event_title.toLowerCase().includes(query) ||
        ticket.artist_name.toLowerCase().includes(query) ||
        ticket.email.toLowerCase().includes(query)
      );
    }

    // Event filter
    if (selectedEvent !== 'all') {
      filtered = filtered.filter(ticket => ticket.event_id === selectedEvent);
    }

    // Artist filter
    if (selectedArtist !== 'all') {
      filtered = filtered.filter(ticket => ticket.artist_id === selectedArtist);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Time filter
    if (timeFilter !== 'all') {
      const now = new Date();
      let cutoffDate: Date;

      switch (timeFilter) {
        case '24h':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          cutoffDate = new Date(now.getTime() - customDays * 24 * 60 * 60 * 1000);
          break;
        case 'week':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filtered = filtered.filter(ticket => {
        const purchaseDate = new Date(ticket.purchase_date);
        return purchaseDate >= cutoffDate;
      });
    }

    setTickets(filtered);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedEvent('all');
    setSelectedArtist('all');
    setTimeFilter('all');
    setCustomDays(7);
    setStatusFilter('all');
  };

  const exportTickets = () => {
    const csv = [
      ['Event', 'Artist', 'Buyer Email', 'Price', 'Status', 'Purchase Date'].join(','),
      ...tickets.map(t => [
        `"${t.event_title}"`,
        `"${t.artist_name}"`,
        `"${t.email}"`,
        t.price.toFixed(2),
        t.status,
        new Date(t.purchase_date).toISOString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tickets-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';

  // Show loading while userProfile is being fetched
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

  const totalRevenue = tickets.reduce((sum, t) => sum + t.price, 0);
  const activeTickets = tickets.filter(t => t.status === 'active').length;

  console.log('🎫 TicketsManagement render:', {
    userProfile: userProfile?.id,
    userType: userProfile?.user_type,
    isAdmin,
    loading,
    error,
    ticketsCount: tickets.length,
    allTicketsCount: allTickets.length
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                <Ticket className="w-6 h-6 text-purple-300" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                Tickets Management
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportTickets}
                disabled={tickets.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 border border-green-500/30 rounded-xl text-green-300 hover:text-green-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-semibold">Export CSV</span>
              </button>
              <button
                onClick={fetchTickets}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 hover:from-purple-600/30 hover:to-pink-600/30 border border-purple-500/30 rounded-xl text-purple-300 hover:text-purple-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="text-sm font-semibold">Refresh</span>
              </button>
            </div>
          </div>
          <p className="text-gray-400">Manage and filter all platform tickets</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Tickets</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  {tickets.length}
                </p>
              </div>
              <Ticket className="w-8 h-8 text-purple-300 opacity-50" />
            </div>
          </div>
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Active Tickets</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">
                  {activeTickets}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-300 opacity-50" />
            </div>
          </div>
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Revenue</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent">
                  €{totalRevenue.toFixed(2)}
                </p>
              </div>
              <span className="text-2xl text-green-300 font-bold opacity-50">€</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Filter className="w-5 h-5 text-purple-300" />
            <h2 className="text-xl font-bold text-white">Filters</h2>
            {(searchQuery || selectedEvent !== 'all' || selectedArtist !== 'all' || timeFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={resetFilters}
                className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
                Clear Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-300 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by event, artist, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="used">Used</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Event Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Event</label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="all">All Events</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>{event.title}</option>
                ))}
              </select>
            </div>

            {/* Artist Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Artist</label>
              <select
                value={selectedArtist}
                onChange={(e) => setSelectedArtist(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="all">All Artists</option>
                {artists.map(artist => (
                  <option key={artist.id} value={artist.id}>{artist.name}</option>
                ))}
              </select>
            </div>

            {/* Time Filter */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Time Range</label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="all">All Time</option>
                <option value="24h">Last 24 Hours</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="custom">Custom Days</option>
              </select>
            </div>

            {/* Custom Days Input */}
            {timeFilter === 'custom' && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Days</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 7)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300">
            {error}
          </div>
        )}

        {/* Tickets Table */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500/30 border-t-purple-500"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">No tickets found</p>
              {allTickets.length > 0 && (
                <p className="text-gray-500 text-sm mt-2">Try adjusting your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Event</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Artist</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Buyer Email</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Price</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 text-gray-300 font-semibold">Purchase Date</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{ticket.event_title}</td>
                      <td className="py-3 px-4 text-gray-300">{ticket.artist_name}</td>
                      <td className="py-3 px-4 text-gray-300">{ticket.email}</td>
                      <td className="py-3 px-4 text-green-400 font-semibold">€{ticket.price.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          ticket.status === 'active' 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : ticket.status === 'used'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {new Date(ticket.purchase_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketsManagement;

