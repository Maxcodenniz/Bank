import React, { useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { Concert, Artist } from '../types';
import { formatDate, formatTime } from '../utils/formatters';
import { Link } from 'react-router-dom';
import useCountdown from '../hooks/useCountdown';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { extractFunctionError } from '../utils/ticketUtils';

interface ConcertCardProps {
  concert: Concert;
  artist: Artist;
}

const ConcertCard: React.FC<ConcertCardProps> = ({ concert, artist }) => {
  const { user } = useStore();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const countdownTarget = `${concert.date}T${concert.time}`;
  const timeLeft = useCountdown(countdownTarget);

  const handlePayment = async () => {
    if (!concert.id) {
      alert('Event information is missing. Please try again.');
      return;
    }

    setIsPurchasing(true);
    try {
      // Use the create-checkout-session function that takes eventId
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          eventId: concert.id,
          email: user?.email || undefined,
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
          alert('Stripe is not configured');
          return;
        }

        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(stripePublicKey);
        
        if (!stripe) {
          alert('Failed to load Stripe');
          return;
        }

        const { error: redirectError } = await stripe.redirectToCheckout({
          sessionId: data.sessionId,
        });

        if (redirectError) {
          alert(redirectError.message || 'Failed to redirect to checkout');
        }
      } else {
        alert('No checkout URL or session ID received');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error.message || 'Payment system temporarily unavailable. Please try again later.');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group">
      <div className="relative h-48 overflow-hidden">
        <img 
          src={concert.imageUrl} 
          alt={concert.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          style={{ objectPosition: 'center top' }}
        />
        {concert.isLive && (
          <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse mr-1"></span>
            LIVE
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex flex-wrap gap-2">
            {concert.categories.map((category, index) => (
              <span key={index} className="bg-yellow-700 bg-opacity-70 text-white text-xs px-2 py-0.5 rounded-full">
                {category}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      <div className="p-5">
        <h3 className="font-bold text-xl mb-1 text-gray-800">{concert.title}</h3>
        <p className="text-indigo-600 font-semibold mb-3">{artist.name}</p>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            <span>{formatDate(concert.date)}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            <span>{formatTime(concert.time)} • {concert.duration} mins</span>
          </div>
          <div className="flex items-center text-gray-600">
            <span className="mr-2">€</span>
            <span>€{concert.price.toFixed(2)}</span>
          </div>
        </div>

        {/* Countdown */}
        {!concert.isLive && (
          <div className="flex items-center justify-center space-x-2 mt-2 text-purple-800 font-semibold text-xl">
            {[
              { label: 'Days', value: timeLeft.days },
              { label: 'Hours', value: timeLeft.hours },
              { label: 'Minutes', value: timeLeft.minutes }
            ].map((unit, index) => (
              <div key={unit.label} className="flex items-center space-x-1">
                <div className="flex flex-col items-center bg-white rounded-lg px-3 py-2 shadow-sm">
                  <span className="text-2xl font-bold">{unit.value.toString().padStart(2, '0')}</span>
                  <span className="text-xs uppercase text-gray-500">{unit.label}</span>
                </div>
                {index < 2 && <span className="text-purple-400 font-bold text-xl">:</span>}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 mt-4">
          <button 
            onClick={handlePayment}
            disabled={isPurchasing}
            className="w-full bg-gradient-to-r from-purple-600 to-yellow-600 hover:from-purple-700 hover:to-yellow-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPurchasing ? 'Processing...' : 'Buy Ticket'}
          </button>

          <Link 
            to={`/watch/${concert.id}`}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors duration-300 block text-center"
          >
            Watch Event
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ConcertCard;
