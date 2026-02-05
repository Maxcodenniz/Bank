import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import UpcomingConcertsComponent from '../components/UpcomingConcerts';
import { Concert, Artist } from '../types';
import { Calendar } from 'lucide-react';

const UpcomingConcertsPage: React.FC = () => {
  const { userProfile } = useStore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
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
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      const now = new Date();
      let validEvents = (data || []).filter(event => 
        event.profiles !== null || event.unregistered_artist_name
      );
      
      // Filter out ended events
      validEvents = validEvents.filter(event => event.status !== 'ended');
      
      // Only show upcoming/scheduled events (not live or ended)
      validEvents = validEvents.filter(event => {
        const eventStart = new Date(event.start_time);
        const eventEnd = new Date(eventStart.getTime() + event.duration * 60000);
        // Show only upcoming/scheduled events that haven't started yet
        return event.status !== 'live' && now < eventStart;
      });
      
      setEvents(validEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform events data into Concert type
  const concerts: Concert[] = events.map(event => ({
    id: event.id,
    artistId: event.artist_id || event.id,
    title: event.title,
    date: event.start_time,
    time: new Date(event.start_time).toLocaleTimeString(),
    imageUrl: event.image_url || 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg',
    description: event.description,
    categories: event.profiles?.genres || [event.artist_type || 'Music'],
    duration: event.duration,
    isLive: false, // Upcoming events are not live
    price: event.price,
    maxTickets: 1000,
    soldTickets: 0,
    streamUrl: event.stream_url
  }));

  // Transform profiles data into Artist type
  const artists: Artist[] = events
    .map(event => {
      if (event.profiles) {
        return {
          id: event.profiles.id,
          name: event.profiles.username || 'Unknown Artist', // Only show username to fans (full_name is confidential)
          imageUrl: event.profiles.avatar_url || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
          genre: event.profiles.genres?.[0] || 'Various',
          categories: [
            event.profiles.artist_type === 'music' ? 'Music' : 'Comedy',
            ...(event.profiles.genres || [])
          ],
          bio: '',
          socialLinks: {}
        };
      } else if (event.unregistered_artist_name) {
        return {
          id: event.id,
          name: event.unregistered_artist_name,
          imageUrl: 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
          genre: event.artist_type || 'Various',
          categories: [event.artist_type === 'music' ? 'Music' : 'Comedy'],
          bio: '',
          socialLinks: {}
        };
      }
      return null;
    })
    .filter((artist): artist is Artist => artist !== null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-24 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <div className="text-center relative z-10">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500 mx-auto mb-4"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
          </div>
          <p className="text-gray-400 font-medium">Loading upcoming concerts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-16 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="container mx-auto px-6 py-8 relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent flex items-center mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mr-3 shadow-xl shadow-purple-500/30">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            Upcoming Concerts
          </h1>
          <p className="text-gray-400 text-lg">
            Discover and book tickets for upcoming live events
          </p>
        </div>
        <UpcomingConcertsComponent concerts={concerts} artists={artists} />
      </div>
    </div>
  );
};

export default UpcomingConcertsPage;

