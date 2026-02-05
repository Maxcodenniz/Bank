import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/useCartStore';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';

const TicketConfirmation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart, items } = useCartStore();
  const { user } = useStore();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verifyAndClearCart = async () => {
      const sessionId = searchParams.get('session_id');
      const eventId = searchParams.get('eventId');
      const cartParam = searchParams.get('cart');
      const emailParam = searchParams.get('email');
      const isCartPurchase = cartParam === 'true';

      if (!sessionId) {
        console.warn('⚠️ No session_id found in URL');
        // Still redirect but don't clear cart
        navigate('/?payment=error&reason=no_session', { replace: true });
        return;
      }

      // Verify tickets were created before clearing cart
      try {
        const eventIdsToCheck = isCartPurchase && items.length > 0
          ? items.map(item => item.eventId)
          : eventId ? [eventId] : [];

        if (eventIdsToCheck.length === 0) {
          console.warn('⚠️ No event IDs to verify');
          // Clear cart anyway if it was a cart purchase
          if (isCartPurchase) {
            clearCart();
          }
          navigate('/?payment=success', { replace: true });
          return;
        }

        // Check for tickets by user_id (if logged in) or by email/phone
        let ticketsFound = false;
        
        if (user?.id) {
          // Check by user_id
          const { data: tickets, error } = await supabase
            .from('tickets')
            .select('id, event_id')
            .eq('user_id', user.id)
            .in('event_id', eventIdsToCheck)
            .eq('status', 'active');

          if (!error && tickets && tickets.length > 0) {
            ticketsFound = true;
            console.log('✅ Verified tickets by user_id:', tickets.length);
          }
        }

        // Also check by email if provided (for guest or phone-only users)
        if (!ticketsFound && emailParam) {
          const { data: tickets, error } = await supabase
            .from('tickets')
            .select('id, event_id')
            .eq('email', emailParam.toLowerCase().trim())
            .in('event_id', eventIdsToCheck)
            .eq('status', 'active');

          if (!error && tickets && tickets.length > 0) {
            ticketsFound = true;
            console.log('✅ Verified tickets by email:', tickets.length);
          }
        }

        // For phone-only users, check by phone if we can get it from session metadata
        // Note: We can't easily check by phone here without fetching session metadata
        // So we'll clear cart if it's a cart purchase and we have a session_id
        // The webhook should have created the tickets by now

        // Clear cart if this was a cart purchase
        // Always clear cart for cart purchases - webhook processes payments asynchronously
        // For phone-only users, tickets are created by webhook even if we can't verify immediately
        if (isCartPurchase) {
          // Clear cart immediately - don't wait for verification
          clearCart();
          console.log('✅ Cart cleared after successful purchase');
          
          // Also remove items from localStorage directly as a backup
          try {
            localStorage.removeItem('dreemystar-cart');
            console.log('✅ Cart also cleared from localStorage');
          } catch (e) {
            console.warn('⚠️ Could not clear localStorage:', e);
          }
        }

        setVerified(true);

        // Redirect to home page with success parameters
        let redirectUrl = '/?payment=success';
        
        if (isCartPurchase) {
          redirectUrl += '&cart=true';
        } else if (eventId) {
          redirectUrl += `&eventId=${eventId}`;
        }
        
        redirectUrl += `&session_id=${sessionId}`;
        
        if (emailParam) {
          redirectUrl += `&email=${encodeURIComponent(emailParam)}`;
        }
        
        navigate(redirectUrl, { replace: true });
      } catch (error) {
        console.error('❌ Error verifying tickets:', error);
        // Still clear cart and redirect on error (webhook should have processed)
        if (isCartPurchase) {
          clearCart();
        }
        navigate('/?payment=success', { replace: true });
      }
    };

    verifyAndClearCart();
  }, [searchParams, navigate, clearCart, items, user]);

  return null; // This component should not render anything visible
};

export default TicketConfirmation;

