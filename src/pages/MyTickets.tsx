import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { Ticket, Calendar, User, Music, Clock, ExternalLink, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

interface TicketData {
  id: string;
  event_id: string;
  event_title: string;
  artist_name: string;
  artist_id: string;
  price: number;
  status: string;
  purchase_date: string;
  start_time?: string;
}

const MyTickets: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, user } = useStore();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'used' | 'expired'>('all');

  useEffect(() => {
    if (userProfile && user) {
      fetchTickets();
    }
  }, [userProfile, user]);

  const fetchTickets = async () => {
    if (!userProfile || !user) return;

    try {
      setLoading(true);
      setError(null);

      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select(`
          id,
          event_id,
          status,
          purchase_date,
          events:event_id (
            title,
            price,
            start_time,
            artist_id,
            profiles:artist_id (
              username,
              full_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false });

      if (ticketsError) {
        throw ticketsError;
      }

      const formattedTickets = (ticketsData || []).map(ticket => ({
        id: ticket.id,
        event_id: ticket.event_id,
        event_title: (ticket.events as any)?.title || 'Unknown Event',
        artist_name: (ticket.events as any)?.profiles?.username || 'Unknown Artist', // Only show username to fans (full_name is confidential)
        artist_id: (ticket.events as any)?.artist_id || '',
        price: (ticket.events as any)?.price || 0,
        status: ticket.status,
        purchase_date: ticket.purchase_date,
        start_time: (ticket.events as any)?.start_time
      }));

      setTickets(formattedTickets);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      setError(err?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    if (filter === 'all') return true;
    if (filter === 'active') return ticket.status === 'active';
    if (filter === 'used') return ticket.status === 'used';
    if (filter === 'expired') {
      if (!ticket.start_time) return false;
      const eventDate = new Date(ticket.start_time);
      const now = new Date();
      return eventDate < now && ticket.status === 'active';
    }
    return true;
  });

  const getStatusBadge = (ticket: TicketData) => {
    const isExpired = ticket.start_time && new Date(ticket.start_time) < new Date() && ticket.status === 'active';
    
    if (isExpired) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
          Expired
        </span>
      );
    }

    switch (ticket.status) {
      case 'active':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30">
            Active
          </span>
        );
      case 'used':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            Used
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/20 text-gray-400 border border-gray-500/30">
            {ticket.status}
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen relative overflow-hidden pt-24 pb-12">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-cyan-900/20 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(219,39,119,0.3),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.2),transparent_50%)]"></div>
      </div>

      <div className="container mx-auto px-6 py-8 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/profile"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Profile</span>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent flex items-center gap-3">
                <Ticket className="w-8 h-8 text-purple-400" />
                My Tickets
              </h1>
              <p className="text-gray-400 text-lg">
                View and manage your event tickets
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                {filteredTickets.length}
              </p>
              <p className="text-gray-400 text-sm">Total Tickets</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-8 flex flex-wrap gap-3">
          {(['all', 'active', 'used', 'expired'] as const).map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-6 py-2.5 rounded-xl font-semibold transition-all duration-300 capitalize ${
                filter === filterOption
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              {filterOption === 'all' ? 'All Tickets' : filterOption}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/50 backdrop-blur-sm">
            <p className="text-red-400 flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              {error}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              <p className="text-gray-400">Loading your tickets...</p>
            </div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/5 border border-white/10 mb-6">
              <Ticket className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">No Tickets Found</h3>
            <p className="text-gray-400 mb-6">
              {filter === 'all'
                ? "You don't have any tickets yet. Start exploring upcoming concerts!"
                : `You don't have any ${filter} tickets.`}
            </p>
            <Link
              to="/upcoming-concerts"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30"
            >
              <Calendar className="w-5 h-5" />
              <span>Browse Concerts</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white mb-1 line-clamp-2 group-hover:text-purple-300 transition-colors">
                      {ticket.event_title}
                    </h3>
                    <p className="text-gray-400 text-sm flex items-center gap-1">
                      <Music className="w-4 h-4" />
                      {ticket.artist_name}
                    </p>
                  </div>
                  {getStatusBadge(ticket)}
                </div>

                <div className="space-y-3 mb-4">
                  {ticket.start_time && (
                    <div className="flex items-center gap-2 text-gray-300 text-sm">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span>{formatDate(ticket.start_time)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Price</span>
                    <span className="text-lg font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                      €{ticket.price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Purchased</span>
                    <span className="text-gray-300 text-sm">{formatDate(ticket.purchase_date)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <Link
                    to={`/watch/${ticket.event_id}`}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl font-semibold transition-all duration-300 group/link"
                  >
                    <span>View Event</span>
                    <ExternalLink className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTickets;



