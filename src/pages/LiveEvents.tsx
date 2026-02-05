import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { Radio, Users, Calendar, Clock, Play } from 'lucide-react';

const LiveEvents: React.FC = () => {
  const { userProfile } = useStore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveEvents();
    
    // Refresh every 30 seconds to update live status
    const interval = setInterval(() => {
      fetchLiveEvents();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchLiveEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          profiles:artist_id (
            id,
            username,
            full_name,
            avatar_url,
            genres,
            artist_type
          )
        `)
        .eq('status', 'live')
        .order('start_time', { ascending: false });

      if (error) throw error;

      const raw = data || [];
      const now = Date.now();
      // Exclude ended events and events whose planned end time has passed
      const stillLive = raw.filter((e: any) => {
        if (e.status === 'ended') return false;
        const start = new Date(e.start_time).getTime();
        const durationMs = (e.duration ?? 0) * 60 * 1000;
        const endTime = start + durationMs;
        return endTime > now;
      });
      setEvents(stillLive);
    } catch (error) {
      console.error('Error fetching live events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-24 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <div className="text-center relative z-10">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-500/30 border-t-red-500 mx-auto mb-4"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-red-500/20"></div>
          </div>
          <p className="text-gray-400 font-medium">Loading live events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-16 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="container mx-auto px-6 py-8 relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-400 via-pink-400 to-red-400 bg-clip-text text-transparent flex items-center mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center mr-3 shadow-xl shadow-red-500/30">
              <Radio className="h-7 w-7 text-white animate-pulse" />
            </div>
            Live Events
          </h1>
          <p className="text-gray-400 text-lg">
            Watch concerts and events happening right now
          </p>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30 flex items-center justify-center">
              <Radio className="h-10 w-10 text-red-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">No Live Events</h2>
            <p className="text-gray-400 mb-6 text-lg">
              There are no events streaming live at the moment.
            </p>
            <Link
              to="/upcoming-concerts"
              className="inline-flex items-center bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 text-white px-8 py-4 rounded-2xl font-bold hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-purple-500/50"
            >
              <Calendar className="h-5 w-5 mr-2" />
              View Upcoming Concerts
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Link
                key={event.id}
                to={`/watch/${event.id}`}
                className="bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group"
              >
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={event.image_url || 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg'}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    style={{ objectPosition: 'center top' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  
                  {/* Live Badge */}
                  <div className="absolute top-4 left-4 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                    LIVE
                  </div>

                  {/* Viewer Count */}
                  <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-full text-sm font-semibold flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    {event.viewer_count?.toLocaleString() || 0}
                  </div>

                  {/* Event Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-bold text-xl mb-1 truncate">{event.title}</h3>
                    <p className="text-gray-200 text-sm truncate">
                      {event.profiles?.username || event.unregistered_artist_name || 'Unknown Artist'} {/* Only show username to fans (full_name is confidential) */}
                    </p>
                  </div>
                </div>

                <div className="p-6">
                  {event.description && (
                    <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{new Date(event.start_time).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>{event.duration} min</span>
                    </div>
                  </div>

                  <button className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center">
                    <Play className="h-5 w-5 mr-2" />
                    Watch Now
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveEvents;

