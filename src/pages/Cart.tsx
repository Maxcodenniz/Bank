import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, ShoppingBag, ArrowLeft, CheckCircle } from 'lucide-react';
import { useCartStore, CartItem } from '../store/useCartStore';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { getEventsWithTickets, extractFunctionError } from '../utils/ticketUtils';
import PhoneInput, { type PhoneValue } from '../components/PhoneInput';
import { formatFullPhone, parseFullPhone, getDefaultDialCodeFromBrowser } from '../utils/phoneCountryCodes';

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useStore();
  const { items, removeItem, clearCart, getTotalPrice, guestEmail, setGuestEmail, guestPhone, setGuestPhone } = useCartStore();
  const { userProfile } = useStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<Record<string, any>>({});
  const [eventsWithTickets, setEventsWithTickets] = useState<string[]>([]);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailInput, setEmailInput] = useState(guestEmail || '');
  const [phoneValue, setPhoneValue] = useState<PhoneValue>({ dialCode: getDefaultDialCodeFromBrowser(), localNumber: '' });
  useEffect(() => {
    const source = guestPhone || userProfile?.phone;
    if (source) {
      const p = parseFullPhone(source);
      if (p) setPhoneValue({ dialCode: p.dialCode, localNumber: p.localNumber });
    }
  }, [guestPhone, userProfile?.phone]);

  // Fetch event details for items in cart
  useEffect(() => {
    const fetchEventDetails = async () => {
      if (items.length === 0) return;

      try {
        const eventIds = items.map(item => item.eventId);
        const { data, error } = await supabase
          .from('events')
          .select('id, title, image_url, price, start_time, description')
          .in('id', eventIds);

        if (error) throw error;

        const detailsMap: Record<string, any> = {};
        data?.forEach(event => {
          detailsMap[event.id] = event;
        });
        setEventDetails(detailsMap);
      } catch (err) {
        console.error('Error fetching event details:', err);
      }
    };

    fetchEventDetails();
  }, [items]);

  // Check for existing tickets when items, user, guest email, or guest phone changes
  useEffect(() => {
    const checkExistingTickets = async () => {
      if (items.length === 0) {
        setEventsWithTickets([]);
        return;
      }

      try {
        const eventIds = items.map(item => item.eventId);
        const userId = user?.id || null;
        const email = user?.email || guestEmail || null;
        const phone = userProfile?.phone || guestPhone || null;
        
        // Check by user_id first
        let eventsWithExistingTickets = await getEventsWithTickets(
          eventIds,
          userId,
          email
        );

        // If no tickets found and we have a phone, also check by phone
        if (eventsWithExistingTickets.length === 0 && phone && !userId) {
          try {
            const { data: ticketsByPhone } = await supabase
              .from('tickets')
              .select('event_id')
              .eq('phone', phone)
              .in('event_id', eventIds)
              .eq('status', 'active');

            if (ticketsByPhone && ticketsByPhone.length > 0) {
              eventsWithExistingTickets = ticketsByPhone.map(t => t.event_id);
            }
          } catch (phoneCheckError) {
            console.warn('Could not check tickets by phone:', phoneCheckError);
          }
        }

        setEventsWithTickets(eventsWithExistingTickets);

        // Automatically remove items from cart if tickets exist
        if (eventsWithExistingTickets.length > 0) {
          eventsWithExistingTickets.forEach(eventId => {
            removeItem(eventId);
          });
          console.log(`✅ Removed ${eventsWithExistingTickets.length} item(s) from cart - tickets already exist`);
        }

        // If there are events with existing tickets, show a warning
        if (eventsWithExistingTickets.length > 0) {
          const eventTitles = eventsWithExistingTickets
            .map(id => {
              const item = items.find(i => i.eventId === id);
              return item?.eventTitle || id;
            })
            .join(', ');
          console.warn(`User already has tickets for: ${eventTitles}`);
        }
      } catch (err) {
        console.error('Error checking existing tickets:', err);
      }
    };

    checkExistingTickets();
  }, [items, user, guestEmail, guestPhone, userProfile?.phone, removeItem]);

  const handleCheckout = async () => {
    if (items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    // For guest users, require either email or phone
    const checkoutPhone =
      phoneValue.localNumber.trim() !== ''
        ? formatFullPhone(phoneValue.dialCode, phoneValue.localNumber)
        : (user?.id && userProfile?.phone) ? userProfile.phone : null;

    if (!user) {
      if (!guestEmail && !checkoutPhone) {
        setError('Please enter your email address or phone number to continue');
        return;
      }
    }

    // Validate email format if provided
    const checkoutEmail = user?.email || guestEmail;
    if (checkoutEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkoutEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate phone format if provided
    if (checkoutPhone && checkoutPhone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    // Check if user already has tickets for any events in cart
    if (eventsWithTickets.length > 0) {
      const eventTitles = eventsWithTickets
        .map(id => {
          const item = items.find(i => i.eventId === id);
          return item?.eventTitle || id;
        })
        .join(', ');
      setError(`You already have active tickets for: ${eventTitles}. Please remove them from your cart.`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Create checkout session with multiple events
      // Phone already computed above

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          eventIds: items.map(item => item.eventId),
          email: checkoutEmail || undefined,
          phone: checkoutPhone || undefined,
          isCart: true,
        },
      });

      if (error) {
        console.error('Error creating checkout session:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        console.error('Error keys:', Object.keys(error));
        console.error('Error.context:', error.context);
        console.error('Error.context?.body:', error.context?.body);
        
        // Extract error message from response body
        const errorMessage = extractFunctionError(error);
        console.log('Final error message to display:', errorMessage);
        setError(errorMessage);
        setIsProcessing(false);
        return;
      }

      if (!data) {
        setError('Invalid response from payment service. Please try again.');
        setIsProcessing(false);
        return;
      }

      if (data.error) {
        setError(data.error);
        setIsProcessing(false);
        return;
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.sessionId) {
        // Fallback: redirect to Stripe checkout with session ID
        const stripe = await import('@stripe/stripe-js');
        const stripePromise = stripe.loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
        const stripeInstance = await stripePromise;
        if (stripeInstance) {
          await stripeInstance.redirectToCheckout({ sessionId: data.sessionId });
        }
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      console.error('Full error object:', JSON.stringify(err, null, 2));
      
      // Try to extract error message
      let errorMessage = 'An error occurred during checkout. Please try again.';
      
      if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error) {
        errorMessage = err.error;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Date TBA';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Date TBA';
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white pt-20 pb-20 px-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="max-w-4xl mx-auto relative z-10">
          <Link
            to="/"
            className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-8 transition-colors group"
          >
            <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            Continue Shopping
          </Link>

          <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/10 shadow-2xl">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-purple-400" />
            </div>
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">Your cart is empty</h2>
            <p className="text-gray-400 mb-8 text-lg">
              Looks like you haven't added any events to your cart yet.
            </p>
            <Link
              to="/"
              className="inline-block bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 text-white font-bold py-4 px-10 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-purple-500/50"
            >
              Browse Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 text-white pt-20 pb-20 px-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      <div className="max-w-4xl mx-auto relative z-10">
        <Link
          to="/"
          className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-8 transition-colors group"
        >
          <ArrowLeft className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" />
          Continue Shopping
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
          Shopping Cart
        </h1>

        {error && (
          <div className="bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl mb-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-4 mb-8">
          {items.map((item) => {
            const eventDetail = eventDetails[item.eventId];
            const hasExistingTicket = eventsWithTickets.includes(item.eventId);
            return (
              <div
                key={item.eventId}
                className={`bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-2xl p-6 flex flex-col md:flex-row gap-6 border border-white/10 shadow-xl transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${
                  hasExistingTicket ? 'border-2 border-yellow-500/50 shadow-yellow-500/20' : ''
                }`}
              >
                <div className="flex-shrink-0">
                  {eventDetail?.image_url ? (
                    <img
                      src={eventDetail.image_url}
                      alt={item.eventTitle}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-gray-700 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="h-12 w-12 text-gray-500" />
                    </div>
                  )}
                </div>

                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold">{item.eventTitle}</h3>
                    {hasExistingTicket && (
                      <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full">
                        Already Purchased
                      </span>
                    )}
                  </div>
                  {eventDetail && (
                    <p className="text-gray-400 text-sm mb-2">
                      {formatDate(eventDetail.start_time)}
                    </p>
                  )}
                  {hasExistingTicket && (
                    <p className="text-yellow-400 text-sm mb-2">
                      You already have an active ticket for this event.
                    </p>
                  )}
                  <p className="text-2xl font-bold text-purple-400">
                    €{item.price.toFixed(2)}
                  </p>
                </div>

                <div className="flex items-center">
                  <button
                    onClick={() => removeItem(item.eventId)}
                    className="p-3 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-2xl p-8 mb-6 border border-white/10 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <span className="text-2xl font-bold text-gray-300">Total</span>
            <span className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              €{getTotalPrice().toFixed(2)}
            </span>
          </div>
          <p className="text-sm text-gray-400 mb-6">
            {items.length} {items.length === 1 ? 'ticket' : 'tickets'}
          </p>
          
          {/* Contact info for guest users - email OR phone required */}
          {!user && (
            <div className="mb-6 space-y-4">
              <div>
                <label htmlFor="guest-email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email Address {!guestEmail && !phoneValue.localNumber.trim() && <span className="text-red-400">*</span>}
                  <span className="text-gray-500 text-xs ml-2">(or use phone below)</span>
                </label>
                <input
                  id="guest-email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    setError(null);
                  }}
                  onBlur={() => {
                    if (emailInput && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
                      setGuestEmail(emailInput);
                      setShowEmailInput(false);
                    }
                  }}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <PhoneInput
                  label={`Phone Number ${!guestEmail && !phoneValue.localNumber.trim() ? '(required if no email)' : ''}`}
                  value={phoneValue}
                  onChange={(val, fullPhone) => {
                    setPhoneValue(val);
                    setGuestPhone(fullPhone || null);
                  }}
                  placeholder="For ticket and updates"
                  required={!guestEmail}
                />
              </div>
              <p className="text-xs text-gray-400">
                Provide at least one: email address or phone number for ticket confirmation
              </p>
            </div>
          )}

          {/* Phone number for logged-in users (optional) */}
          {user && (
            <div className="mb-6">
              <PhoneInput
                label="Phone number (optional)"
                value={phoneValue}
                onChange={(val, fullPhone) => {
                  setPhoneValue(val);
                  setGuestPhone(fullPhone || null);
                }}
                placeholder="For ticket and updates"
              />
            </div>
          )}
          
          {!user && guestEmail && !showEmailInput && (
            <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-400">Email</p>
                  <p className="text-white font-medium">{guestEmail}</p>
                </div>
                <button
                  onClick={() => {
                    setShowEmailInput(true);
                    setEmailInput(guestEmail);
                  }}
                  className="text-purple-400 hover:text-purple-300 text-sm"
                >
                  Change
                </button>
              </div>
            </div>
          )}
          
          <button
            onClick={handleCheckout}
            disabled={isProcessing || items.length === 0 || (!user && !guestEmail && !phoneValue.localNumber.trim())}
            className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:from-purple-700 hover:via-pink-700 hover:to-purple-700 disabled:from-gray-600 disabled:via-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold py-5 px-8 rounded-2xl transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 flex items-center justify-center shadow-2xl hover:shadow-purple-500/50 disabled:shadow-none"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Proceed to Checkout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Cart;


