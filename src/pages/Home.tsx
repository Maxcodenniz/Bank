import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useCartStore } from '../store/useCartStore';
import ConfigurationNotice from '../components/ConfigurationNotice';
import FeaturedConcert from '../components/FeaturedConcert';
import UpcomingConcerts from '../components/UpcomingConcerts';
import ArtistsSection from '../components/ArtistsSection';
import { Concert, Artist } from '../types';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle, X, Ticket } from 'lucide-react';

const Home: React.FC = () => {
  const { userProfile } = useStore();
  const { clearCart } = useCartStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string>('');
  const [advertisementsEnabled, setAdvertisementsEnabled] = useState(true);

  useEffect(() => {
    fetchEvents();
    fetchAdvertisementConfig();

    // Refresh event data every 30 seconds to update live status
    const refreshInterval = setInterval(() => {
      fetchEvents();
    }, 30000);

    // Listen for platform refresh event
    const handlePlatformRefresh = () => {
      console.log('🔄 Platform refresh triggered - refreshing home page data');
      fetchEvents();
      fetchAdvertisementConfig();
    };

    window.addEventListener('platformRefresh', handlePlatformRefresh);

    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('platformRefresh', handlePlatformRefresh);
    };
  }, []);

  const fetchAdvertisementConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'advertisements_home_enabled')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Error fetching advertisement config:', error);
        return;
      }

      // Default to true if config doesn't exist
      const isEnabled = data?.value === true || data?.value === 'true' || data === null;
      setAdvertisementsEnabled(isEnabled);
    } catch (err) {
      console.error('Error fetching advertisement config:', err);
      // Default to enabled on error
      setAdvertisementsEnabled(true);
    }
  };

  // Check for payment success in URL parameters
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment');
    const isCartPurchase = searchParams.get('cart') === 'true';
    const eventId = searchParams.get('eventId');

    if (paymentSuccess === 'success') {
      // Clear cart as a safeguard (in case TicketConfirmation didn't run)
      if (isCartPurchase) {
        clearCart();
        console.log('✅ Cart cleared on Home page (safeguard)');
      }

      // Determine the success message
      if (isCartPurchase) {
        setPaymentMessage('Your tickets have been purchased successfully! Check your email or phone for confirmation details.');
      } else if (eventId) {
        setPaymentMessage('Your ticket has been purchased successfully! Check your email or phone for confirmation details.');
      } else {
        setPaymentMessage('Payment successful! Check your email or phone for confirmation details.');
      }

      setShowPaymentSuccess(true);

      // Clear URL parameters after showing notification
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('payment');
      newSearchParams.delete('cart');
      newSearchParams.delete('eventId');
      newSearchParams.delete('session_id');
      newSearchParams.delete('email');
      
      // Update URL without the payment parameters
      navigate(`/?${newSearchParams.toString()}`, { replace: true });

      // Auto-hide notification after 8 seconds
      const timer = setTimeout(() => {
        setShowPaymentSuccess(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [searchParams, navigate]);

  // Separate effect for auto-advance slideshow
  useEffect(() => {
    if (events.length > 1) {
      const interval = setInterval(() => {
        setCurrentEventIndex((prevIndex) => (prevIndex + 1) % events.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [events.length]);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          profiles:artist_id (
            id,
            username,
            full_name,
            avatar_url,
            artist_type,
            genres
          )
        `)
        .neq('status', 'ended') // Exclude ended events at database level
        .order('start_time', { ascending: true });

      if (error) throw error;
      
      // Filter events based on user role and event status
      const now = new Date();
      let validEvents = (data || []).filter(event => 
        event.profiles !== null || event.unregistered_artist_name
      );
      
      // Filter out ended events for everyone
      validEvents = validEvents.filter(event => event.status !== 'ended');
      
      // Hide past events from public view (only show to admins)
      if (!userProfile || userProfile.user_type !== 'global_admin') {
        validEvents = validEvents.filter(event => {
          const eventStart = new Date(event.start_time);
          const eventEnd = new Date(eventStart.getTime() + event.duration * 60000);
          // Show upcoming, scheduled, and currently live events only (not ended)
          return now <= eventEnd && event.status !== 'ended';
        });
      }
      
      setEvents(validEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToPrevious = () => {
    setCurrentEventIndex((prevIndex) => 
      prevIndex === 0 ? events.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentEventIndex((prevIndex) => (prevIndex + 1) % events.length);
  };

  const currentEvent = events[currentEventIndex];

  // Transform events data into Concert type
  const concerts: Concert[] = events.map(event => ({
    id: event.id,
    artistId: event.artist_id || event.id, // Use event ID as artist ID for unregistered artists
    title: event.title,
    date: event.start_time,
    time: new Date(event.start_time).toLocaleTimeString(),
    imageUrl: event.image_url || 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg',
    description: event.description,
    categories: event.profiles?.genres || [event.artist_type || 'Music'],
    duration: event.duration,
    isLive: event.status === 'live',
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
          id: event.id, // Use event ID as artist ID for unregistered artists
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

  // Filter upcoming concerts (not live or ended) - only show scheduled/upcoming events
  const upcomingConcerts = concerts.filter(concert => {
    // Exclude live and ended events
    if (concert.isLive) return false;
    
    // Check if the event has ended based on status
    const event = events.find(e => e.id === concert.id);
    if (event && event.status === 'ended') return false;
    
    // Also check if event time has passed
    const eventStart = new Date(concert.date);
    const eventEnd = new Date(eventStart.getTime() + concert.duration * 60000);
    const now = new Date();
    
    // Only show events that haven't ended yet
    return now <= eventEnd;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950">
        <div className="h-[70vh] flex flex-col items-center justify-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
          </div>
          <p className="mt-6 text-gray-400 font-medium">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl"></div>
      </div>
      {/* Payment Success Notification - Enhanced */}
      {showPaymentSuccess && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 text-white px-8 py-5 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[400px] max-w-[600px] border-2 border-green-400/50 backdrop-blur-xl">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center border border-white/30">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Ticket className="w-5 h-5" />
                <h3 className="font-bold text-lg">Payment Successful!</h3>
              </div>
              <p className="text-sm text-green-50">{paymentMessage}</p>
            </div>
            <button
              onClick={() => setShowPaymentSuccess(false)}
              className="flex-shrink-0 w-9 h-9 rounded-xl hover:bg-white/20 border border-white/20 transition-all duration-300 flex items-center justify-center group"
              aria-label="Close notification"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 sm:px-6 pt-0 sm:pt-0 relative z-10">
        <ConfigurationNotice />
      </div>
      
      {currentEvent && (
        <FeaturedConcert 
          concert={{
            id: currentEvent.id,
            artistId: currentEvent.artist_id || currentEvent.id,
            title: currentEvent.title,
            date: currentEvent.start_time,
            time: new Date(currentEvent.start_time).toLocaleTimeString(),
            imageUrl: currentEvent.image_url || 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg',
            description: currentEvent.description,
            categories: currentEvent.profiles?.genres || [currentEvent.artist_type || 'Music'],
            duration: currentEvent.duration,
            isLive: currentEvent.status === 'live',
            price: currentEvent.price,
            maxTickets: 1000,
            soldTickets: 0,
            streamUrl: currentEvent.stream_url
          }}
          artist={{
            id: currentEvent.artist_id || currentEvent.id,
            name: currentEvent.profiles?.username || currentEvent.unregistered_artist_name || 'Unknown Artist', // Only show username to fans (full_name is confidential)
            imageUrl: currentEvent.profiles?.avatar_url || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
            genre: currentEvent.profiles?.genres?.[0] || currentEvent.artist_type || 'Music',
            categories: [
              currentEvent.profiles?.artist_type === 'music' || currentEvent.artist_type === 'music' ? 'Music' : 'Comedy',
              ...(currentEvent.profiles?.genres || [])
            ],
            bio: '',
            socialLinks: {}
          }}
          onPrevious={goToPrevious}
          onNext={goToNext}
          showNavigation={events.length > 1}
        />
      )}
      
      <UpcomingConcerts 
        concerts={upcomingConcerts}
        artists={artists}
        showAdvertisements={advertisementsEnabled}
      />
      
      <ArtistsSection searchQuery="" />
    </div>
  );
};

export default Home;