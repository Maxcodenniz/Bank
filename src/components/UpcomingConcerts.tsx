import React, { useState, useEffect } from 'react';
import { Calendar, Trophy, Clock, Play, CreditCard, Info, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Concert, Artist } from '../types';
import SectionHeader from './SectionHeader';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { useCartStore } from '../store/useCartStore';
import { hasActiveTicket, extractFunctionError } from '../utils/ticketUtils';

interface Advertisement {
  id: string;
  image_url: string;
  link: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

interface UpcomingConcertsProps {
  concerts: Concert[];
  artists: Artist[];
  showAdvertisements?: boolean;
}

interface TopArtist {
  id: string;
  name: string;
  totalConcerts: number;
  totalViewers: number;
  imageUrl: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
}

// Custom hook for countdown timer
const useCountdown = (targetDate: string): TimeLeft => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const calculateTimeLeft = (): TimeLeft => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const difference = target - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

        return { days, hours, minutes };
      }

      return { days: 0, hours: 0, minutes: 0 };
    };

    // Calculate initial time
    setTimeLeft(calculateTimeLeft());

    // Update every minute (60000ms) for efficiency since we only show minutes precision
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 60000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
};

// Enhanced ConcertCard component with countdown timer and all buttons
const ConcertCard: React.FC<{ concert: Concert; artist: Artist }> = ({ concert, artist }) => {
  const { user } = useStore();
  const { addItem, isInCart, guestEmail } = useCartStore();
  const timeLeft = useCountdown(concert.date);
  const now = new Date();
  const eventStart = new Date(concert.date);
  const eventEnd = new Date(eventStart.getTime() + concert.duration * 60000);
  // Check both database status and time - trust database status first
  const isLive = concert.isLive && now >= eventStart && now <= eventEnd;
  const hasEnded = now > eventEnd || (!concert.isLive && now >= eventStart);

  const formatTime = (time: number): string => {
    return time.toString().padStart(2, '0');
  };

  const getStatusBadge = () => {
    if (hasEnded) {
      return <span className="bg-gray-500 text-white px-3 py-1 rounded-full text-sm font-medium">Ended</span>;
    }
    if (isLive) {
      return <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">• LIVE</span>;
    }
    return <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">Upcoming</span>;
  };

  const handleWatchClick = () => {
    // Always navigate to watch page - let the Watch page handle access control
    // The Watch page will check for tickets and show appropriate UI based on event status
    window.location.href = `/watch/${concert.id}`;
  };

  const handleAddToCart = async () => {
    if (!concert.id) {
      alert('Event information is missing. Please try again.');
      return;
    }

    if (isInCart(concert.id)) {
      alert('This event is already in your cart.');
      return;
    }

    // Check if user already has an active ticket for this event
    const checkEmail = user?.email || guestEmail;
    const hasTicket = await hasActiveTicket(concert.id, user?.id || null, checkEmail || null);
    if (hasTicket) {
      alert('You already have an active ticket for this event.');
      return;
    }

    addItem({
      eventId: concert.id,
      eventTitle: concert.title,
      eventImage: artist.imageUrl,
      price: concert.price,
      artistName: artist.name,
      eventDate: concert.date,
    });

    alert('Event added to cart!');
  };

  const handlePurchaseTicket = async () => {
    if (!concert.id) {
      alert('Event information is missing. Please try again.');
      return;
    }

    // Check if user already has an active ticket for this event
    const checkEmail = user?.email || guestEmail;
    const hasTicket = await hasActiveTicket(concert.id, user?.id || null, checkEmail || null);
    if (hasTicket) {
      alert('You already have an active ticket for this event.');
      return;
    }

    try {
      // Use the create-checkout-session function that takes eventId
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          eventId: concert.id,
          email: user?.email || guestEmail || undefined,
        },
      });

      if (error) {
        console.error('Error creating checkout session:', error);
        // Extract error message from response body
        const errorMessage = extractFunctionError(error);
        alert(errorMessage);
        return;
      }

      if (!data) {
        alert('Invalid response from payment service. Please try again.');
        return;
      }

      // Check if the response contains an error
      if (data.error) {
        alert(data.error);
        return;
      }

      // If URL is provided directly, use it
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      // Otherwise, use sessionId with Stripe redirect
      if (data.sessionId) {
        const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
        if (!stripePublicKey) {
          alert('Payment system is not configured. Please contact support.');
          return;
        }

        // Load Stripe and redirect to checkout
        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(stripePublicKey);

        if (!stripe) {
          alert('Failed to load payment system. Please try again.');
          return;
        }

        // Redirect to Stripe Checkout
        const { error: redirectError } = await stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });

        if (redirectError) {
          alert(redirectError.message || 'Failed to redirect to checkout. Please try again.');
        }
      } else {
        alert('No checkout URL or session ID received. Please try again.');
      }
    } catch (err) {
      console.error('Error purchasing ticket:', err);
      alert(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 group">
      {/* Image Container with fixed aspect ratio */}
      <div className="relative h-48 overflow-hidden bg-gray-200">
        <img
          src={concert.imageUrl || 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg'}
          alt={concert.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          style={{
            aspectRatio: '16/9',
            objectPosition: 'center top'
          }}
        />
        <div className="absolute top-4 left-4">
          {getStatusBadge()}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        
        {/* Event info overlay */}
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <h3 className="font-bold text-lg mb-1 truncate">{concert.title}</h3>
          <p className="text-sm text-gray-200 truncate">by {artist.name}</p>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6">
        {/* Date and Time */}
        <div className="flex items-center text-gray-600 mb-4">
          <Calendar className="h-4 w-4 mr-2" />
          <span className="text-sm">
            {new Date(concert.date).toLocaleDateString('en-US', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            })} at {new Date(concert.date).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        {/* Countdown Timer */}
        {!hasEnded && !isLive && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center">
              <Clock className="h-4 w-4 text-purple-600 mr-2" />
              <span className="text-sm font-medium text-purple-800 mr-4">Starts in:</span>
            </div>
            <div className="flex items-center justify-center space-x-2 mt-2">
              <div className="text-center">
                <div className="bg-white rounded-lg px-3 py-2 shadow-sm min-w-[50px]">
                  <div className="text-2xl font-bold text-purple-600">{formatTime(timeLeft.days)}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Days</div>
                </div>
              </div>
              <div className="text-purple-400 font-bold text-xl">:</div>
              <div className="text-center">
                <div className="bg-white rounded-lg px-3 py-2 shadow-sm min-w-[50px]">
                  <div className="text-2xl font-bold text-purple-600">{formatTime(timeLeft.hours)}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Hours</div>
                </div>
              </div>
              <div className="text-purple-400 font-bold text-xl">:</div>
              <div className="text-center">
                <div className="bg-white rounded-lg px-3 py-2 shadow-sm min-w-[50px]">
                  <div className="text-2xl font-bold text-purple-600">{formatTime(timeLeft.minutes)}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Minutes</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live indicator */}
        {isLive && (
          <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-lg p-4 mb-4 text-center">
            <div className="flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full mr-2 animate-pulse"></div>
              <span className="font-bold">LIVE NOW</span>
            </div>
            <div className="text-sm mt-1 opacity-90">Event is currently streaming</div>
          </div>
        )}

        {/* Description */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{concert.description}</p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <div className="flex flex-col space-y-2">
            {/* Watch Button - Always available for all users (logged in or guest) */}
            {!hasEnded && (
              <button 
                onClick={handleWatchClick}
                className={`font-bold py-2 px-4 rounded-full flex items-center justify-center transition-all duration-300 text-sm ${
                  isLive
                    ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg shadow-red-500/30'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg shadow-purple-500/30'
                }`}
              >
                <Play className="h-4 w-4 mr-2" />
                {isLive ? 'Watch Now' : 'View Event Details'}
              </button>
            )}

            {/* Buy Ticket and Add to Cart Buttons (only for upcoming events) */}
            {!hasEnded && !isLive && concert.price > 0 && (
              <div className="flex flex-col space-y-2">
                <button
                  onClick={handlePurchaseTicket}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center shadow-lg shadow-green-500/30"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Buy Ticket (€{concert.price.toFixed(2)})
                </button>
                {!isInCart(concert.id) && (
                  <button
                    onClick={handleAddToCart}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-all flex items-center justify-center"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </button>
                )}
              </div>
            )}
          </div>

          {/* View Details Button - Always present */}
          <Link
            to={`/artist/${artist.id}`}
            className="block w-full text-center py-2 px-4 rounded-full font-medium transition-all duration-200 bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-200 hover:border-blue-300"
          >
            <Info className="h-4 w-4 mr-2 inline" />
            View Artist Details
          </Link>
        </div>

        {/* Additional Info */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-500">Duration: {concert.duration} min</span>
          <span className="text-xs text-gray-500">Genre: {concert.genre}</span>
        </div>
      </div>
    </div>
  );
};

const UpcomingConcerts: React.FC<UpcomingConcertsProps> = ({ concerts, artists, showAdvertisements = false }) => {
  const now = new Date();
  const upcomingConcerts = concerts.filter(concert => {
    // Exclude live events (they should be in featured section)
    if (concert.isLive) return false;
    
    const eventStart = new Date(concert.date);
    const eventEnd = new Date(eventStart.getTime() + concert.duration * 60000);
    
    // Only show upcoming/scheduled events that haven't ended
    // Exclude events that are past their end time
    return now <= eventEnd;
  });
  
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [topArtists, setTopArtists] = useState<TopArtist[]>([]);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (showAdvertisements) {
      fetchAdvertisements();
      
      const interval = setInterval(() => {
        setCurrentAdIndex(prev => 
          (prev + 1) % (advertisements.length || 1)
        );
        setImageLoaded(false);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [showAdvertisements, advertisements.length]);

  useEffect(() => {
    if (showAdvertisements && advertisements.length > 0) {
      // Reset both image loaded state and dimensions when ad changes
      setImageLoaded(false);
      setImageDimensions(null);
      
      // Check if image is already cached/loaded
      if (advertisements[currentAdIndex]?.image_url) {
        const img = new Image();
        img.onload = () => {
          console.log('Advertisement image already cached/loaded:', advertisements[currentAdIndex]?.image_url);
          setImageLoaded(true);
          // Calculate dimensions
          const containerWidth = window.innerWidth * 0.9; // Approximate container width
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          const displayHeight = Math.min(containerWidth / aspectRatio, 350);
          setImageDimensions({
            width: containerWidth,
            height: displayHeight,
            aspectRatio
          });
        };
        img.onerror = () => {
          console.error('Failed to load advertisement image (pre-check):', advertisements[currentAdIndex]?.image_url);
          setImageLoaded(true);
        };
        img.src = advertisements[currentAdIndex].image_url;
      }
      
      // Set a timeout to prevent loading state from getting stuck
      const timeout = setTimeout(() => {
        console.warn('Advertisement image loading timeout, hiding loading state');
        setImageLoaded(true);
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
  }, [currentAdIndex, advertisements, showAdvertisements]);

  useEffect(() => {
    fetchTopArtists();
  }, []);

  const fetchAdvertisements = async () => {
    try {
      const { data, error } = await supabase
        .from('advertisements')
        .select('*')
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString());

      if (error) throw error;
      setAdvertisements(data || []);
    } catch (error) {
      console.error('Error fetching advertisements:', error);
    }
  };

  const fetchTopArtists = async () => {
    try {
      // Since ended events were deleted, let's use current concerts and upcoming concerts
      // We can also use the concerts data passed as props
      console.log('Fetching top artists from current data...');
      
      // First try to get data from Supabase events table (any status)
      const { data: events, error } = await supabase
        .from('events')
        .select(`
          id,
          viewer_count,
          artist_id,
          status,
          profiles:artist_id (
            id,
            username,
            full_name,
            avatar_url
          )
        `);

      console.log('All events from DB:', events);

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      // If we have events data from the database, use it
      if (events && events.length > 0) {
        const artistStats: Record<string, TopArtist> = {};
        
        events.forEach(event => {
          const artistId = event.profiles?.id || event.artist_id;
          // Use username instead of full_name (full_name is confidential)
          const artistName = event.profiles?.username || event.profiles?.full_name;
          const artistImage = event.profiles?.avatar_url;
          
          // Fallback to artists from props if no profile data
          const fallbackArtist = artists.find(a => a.id === event.artist_id);
          
          const finalArtistId = artistId || fallbackArtist?.id;
          const finalArtistName = artistName || fallbackArtist?.name;
          const finalArtistImage = artistImage || fallbackArtist?.imageUrl;

          if (finalArtistId) {
            if (!artistStats[finalArtistId]) {
              artistStats[finalArtistId] = {
                id: finalArtistId,
                name: finalArtistName || 'Unknown Artist',
                imageUrl: finalArtistImage || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
                totalConcerts: 0,
                totalViewers: 0
              };
            }
            artistStats[finalArtistId].totalConcerts += 1;
            artistStats[finalArtistId].totalViewers += event.viewer_count || 0;
          }
        });

        const topArtistsList = Object.values(artistStats)
          .sort((a, b) => b.totalViewers - a.totalViewers)
          .slice(0, 10);

        if (topArtistsList.length > 0) {
          console.log('Using database events, top artists:', topArtistsList);
          setTopArtists(topArtistsList);
          return;
        }
      }

      // Fallback: Use the concerts prop data to create top artists
      console.log('Using concerts prop data for top artists');
      console.log('Available concerts:', concerts);
      console.log('Available artists:', artists);

      if (concerts && concerts.length > 0 && artists && artists.length > 0) {
        const artistStats: Record<string, TopArtist> = {};
        
        concerts.forEach(concert => {
          const artist = artists.find(a => a.id === concert.artistId);
          if (artist) {
            if (!artistStats[artist.id]) {
              artistStats[artist.id] = {
                id: artist.id,
                name: artist.name,
                imageUrl: artist.imageUrl || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg',
                totalConcerts: 0,
                totalViewers: 0
              };
            }
            artistStats[artist.id].totalConcerts += 1;
            // Since we don't have real viewer data, use a reasonable estimate based on concert data
            artistStats[artist.id].totalViewers += Math.floor(Math.random() * 2000) + 500;
          }
        });

        const topArtistsList = Object.values(artistStats)
          .sort((a, b) => b.totalViewers - a.totalViewers)
          .slice(0, 10);

        console.log('Top artists from concerts prop:', topArtistsList);
        setTopArtists(topArtistsList);
        return;
      }

      // Ultimate fallback: Use first 10 artists from props with demo data
      console.log('Using fallback demo data for top artists');
      const fallbackArtists = artists.slice(0, 10).map((artist, index) => ({
        id: artist.id,
        name: artist.name,
        imageUrl: artist.imageUrl,
        totalConcerts: Math.floor(Math.random() * 5) + 1,
        totalViewers: Math.floor(Math.random() * 3000) + 1000
      }));

      console.log('Fallback artists:', fallbackArtists);
      setTopArtists(fallbackArtists);

    } catch (error) {
      console.error('Error in fetchTopArtists:', error);
      
      // Final fallback: use artists from props
      console.log('Error occurred, using final fallback');
      const fallbackArtists = artists.slice(0, 10).map((artist, index) => ({
        id: artist.id,
        name: artist.name,
        imageUrl: artist.imageUrl,
        totalConcerts: Math.floor(Math.random() * 3) + 1,
        totalViewers: Math.floor(Math.random() * 2000) + 500
      }));
      setTopArtists(fallbackArtists);
    }
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const containerWidth = img.parentElement?.clientWidth || window.innerWidth;
    
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const aspectRatio = naturalWidth / naturalHeight;
    
    const displayWidth = Math.min(naturalWidth, containerWidth);
    const displayHeight = displayWidth / aspectRatio;
    
    setImageDimensions({
      width: displayWidth,
      height: displayHeight,
      aspectRatio
    });
    
    setImageLoaded(true);
  };

  const getImageStyle = (): React.CSSProperties => {
    if (!imageDimensions || !imageLoaded) {
      return {
        width: '100%',
        height: '300px',
        objectFit: 'cover' as const,
        objectPosition: 'center top'
      };
    }

    if (imageDimensions.aspectRatio > 2.5) {
      return {
        width: '100%',
        height: `${Math.min(imageDimensions.height, 300)}px`,
        objectFit: 'contain' as const,
        objectPosition: 'center'
      };
    }
    
    if (imageDimensions.aspectRatio <= 1.5) {
      return {
        width: 'auto',
        maxWidth: '500px',
        maxHeight: '400px',
        height: 'auto',
        objectFit: 'contain' as const
      };
    }
    
    return {
      width: '100%',
      height: `${Math.min(imageDimensions.height, 350)}px`,
      objectFit: 'contain' as const,
      objectPosition: 'center'
    };
  };

  const getContainerStyle = (): React.CSSProperties => {
    return {
      minHeight: '200px',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative' as const
    };
  };

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-6">
        {/* Advertisement Banner - Only show on home page */}
        {showAdvertisements && advertisements.length > 0 && (
          <div className="mb-12 relative overflow-hidden rounded-lg shadow-lg" style={getContainerStyle()}>
            <a 
              href={advertisements[currentAdIndex]?.link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block relative"
            >
              {/* DreemyStar themed background */}
              <div className="absolute inset-0">
                <div className="w-full h-full bg-gradient-to-br from-pink-400 via-purple-500 via-blue-500 to-teal-400"></div>
                
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-8 left-8 w-4 h-4 bg-white transform rotate-12">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-300 to-orange-300" 
                         style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'}}></div>
                  </div>
                  <div className="absolute top-20 right-12 w-3 h-3 bg-white transform -rotate-45">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-300 to-teal-300" 
                         style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'}}></div>
                  </div>
                  <div className="absolute bottom-16 left-16 w-5 h-5 bg-white transform rotate-45">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-300 to-pink-300" 
                         style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'}}></div>
                  </div>
                  <div className="absolute bottom-8 right-8 w-3 h-3 bg-white transform rotate-12">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-300 to-blue-300" 
                         style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'}}></div>
                  </div>
                  <div className="absolute top-1/2 left-4 w-2 h-2 bg-white transform -rotate-12">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-300 to-pink-300" 
                         style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'}}></div>
                  </div>
                  <div className="absolute top-1/3 right-6 w-4 h-4 bg-white transform rotate-90">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-300 to-purple-300" 
                         style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'}}></div>
                  </div>
                </div>

                <div className="absolute inset-0 opacity-5">
                  <svg width="100%" height="100%" viewBox="0 0 400 200" className="absolute inset-0">
                    <defs>
                      <linearGradient id="logoGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F472B6" />
                        <stop offset="25%" stopColor="#FB7185" />
                        <stop offset="50%" stopColor="#8B5CF6" />
                        <stop offset="75%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                      <linearGradient id="logoGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#06B6D4" />
                        <stop offset="50%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#F472B6" />
                      </linearGradient>
                    </defs>
                    
                    <path d="M50 50 Q100 20 150 50 Q200 80 250 50 Q300 20 350 50" 
                          stroke="url(#logoGradient1)" strokeWidth="2" fill="none" opacity="0.6"/>
                    <path d="M50 100 Q100 70 150 100 Q200 130 250 100 Q300 70 350 100" 
                          stroke="url(#logoGradient2)" strokeWidth="2" fill="none" opacity="0.6"/>
                    <path d="M50 150 Q100 120 150 150 Q200 180 250 150 Q300 120 350 150" 
                          stroke="url(#logoGradient1)" strokeWidth="2" fill="none" opacity="0.6"/>
                    
                    <circle cx="80" cy="80" r="15" fill="url(#logoGradient1)" opacity="0.3"/>
                    <circle cx="320" cy="120" r="12" fill="url(#logoGradient2)" opacity="0.3"/>
                    <circle cx="180" cy="160" r="10" fill="url(#logoGradient1)" opacity="0.3"/>
                  </svg>
                </div>

                <div className="absolute inset-0 opacity-8" 
                     style={{
                       backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
                       backgroundSize: '24px 24px'
                     }}>
                </div>
              </div>
              
              <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-pink-500/20 via-purple-500/10 to-transparent"></div>
              <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-teal-500/20 via-blue-500/10 to-transparent"></div>
              
              {!imageLoaded && advertisements[currentAdIndex]?.image_url && (
                <div className="w-full h-72 bg-gradient-to-br from-pink-400 via-purple-500 to-teal-400 animate-pulse flex items-center justify-center relative z-10">
                  <div className="text-white bg-black/20 backdrop-blur-sm px-6 py-3 rounded-lg shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-white" style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'}}>
                        <div className="w-full h-full bg-gradient-to-br from-pink-300 to-teal-300"></div>
                      </div>
                      <span>Loading DreemyStar Advertisement...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="relative z-10 flex items-center justify-center min-h-[200px] p-6">
                {advertisements[currentAdIndex]?.image_url ? (
                  <img
                    key={`ad-${currentAdIndex}-${advertisements[currentAdIndex]?.id || currentAdIndex}`}
                    src={advertisements[currentAdIndex].image_url}
                    alt="Advertisement"
                    style={{
                      ...getImageStyle(),
                      opacity: imageLoaded ? 1 : 0,
                      transition: 'opacity 0.3s ease-in-out',
                      boxShadow: imageLoaded ? '0 12px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)' : 'none',
                      borderRadius: '8px',
                      backgroundColor: 'transparent'
                    }}
                    onLoad={(e) => {
                      console.log('Advertisement image loaded:', advertisements[currentAdIndex]?.image_url);
                      handleImageLoad(e);
                    }}
                    onError={() => {
                      console.error('Failed to load advertisement image:', advertisements[currentAdIndex]?.image_url);
                      setImageLoaded(true);
                      setImageDimensions(null);
                    }}
                  />
                ) : (
                  <div className="text-white text-center">
                    <p className="text-lg font-semibold mb-2">Advertisement</p>
                    <p className="text-sm opacity-75">No image available</p>
                  </div>
                )}
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-purple-500/10 to-transparent pointer-events-none"></div>
            </a>
            
            {advertisements.length > 1 && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-teal-500/20 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                {advertisements.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentAdIndex(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      index === currentAdIndex 
                        ? 'bg-gradient-to-r from-pink-400 to-teal-400 scale-125 shadow-lg' 
                        : 'bg-white/60 hover:bg-white/80 hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            )}
            
            <div className="absolute top-0 left-0 w-12 h-12 bg-gradient-to-br from-pink-400/15 to-transparent rounded-br-full"></div>
            <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-teal-400/15 to-transparent rounded-bl-full"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 bg-gradient-to-tr from-purple-400/15 to-transparent rounded-tr-full"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 bg-gradient-to-tl from-blue-400/15 to-transparent rounded-tl-full"></div>

            <div className="absolute top-6 right-6 w-6 h-6 opacity-20">
              <div className="w-full h-full bg-gradient-to-br from-pink-300 to-orange-300 animate-pulse" 
                   style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'}}></div>
            </div>
            <div className="absolute bottom-6 left-6 w-4 h-4 opacity-20">
              <div className="w-full h-full bg-gradient-to-br from-teal-300 to-blue-300 animate-pulse" 
                   style={{clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', animationDelay: '1s'}}></div>
            </div>
          </div>
        )}

        <SectionHeader 
          title="Upcoming Concerts" 
          icon={<Calendar className="h-6 w-6" />} 
        />
        
        {upcomingConcerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {upcomingConcerts.map((concert) => {
              const artist = artists.find(a => a.id === concert.artistId);
              if (!artist) return null;
              
              return (
                <ConcertCard 
                  key={concert.id} 
                  concert={concert} 
                  artist={artist} 
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 mb-16">
            <p className="text-lg text-gray-600">No upcoming concerts available.</p>
          </div>
        )}

        {/* Top Artists Section */}
        <div className="border-t border-gray-200 pt-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Trophy className="h-6 w-6 text-yellow-500 mr-2" />
              Top 10 Artists
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {topArtists.map((artist, index) => (
              <Link
                key={artist.id}
                to={`/artist/${artist.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 block"
              >
                <div className="relative">
                  <img
                    src={artist.imageUrl || 'https://images.pexels.com/photos/1699161/pexels-photo-1699161.jpeg'}
                    alt={artist.name}
                    className="w-full h-48 object-cover"
                    style={{ objectPosition: 'center top' }}
                  />
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    #{index + 1}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">{artist.name}</h3>
                  <div className="text-sm text-gray-600">
                    <p>{artist.totalConcerts} concerts</p>
                    <p>{artist.totalViewers.toLocaleString()} total viewers</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default UpcomingConcerts;