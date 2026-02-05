import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@14.18.0";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) {
      throw new Error("Missing Stripe secret key");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    // Get Supabase client for auth operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract user ID and email from JWT token if available (for logged-in users)
    let authenticatedUserId: string | null = null;
    let authenticatedUserEmail: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (!userError && user) {
          authenticatedUserId = user.id;
          authenticatedUserEmail = user.email || null;
          console.log('✅ Authenticated user ID from JWT:', authenticatedUserId);
          console.log('✅ User email from JWT:', authenticatedUserEmail);
        } else {
          console.warn('⚠️ Could not get user from JWT token:', userError);
        }
      } catch (authErr) {
        console.warn('⚠️ Could not extract user from JWT token:', authErr);
        // Continue with guest checkout if auth fails
      }
    } else {
      console.log('ℹ️ No Authorization header found - proceeding as guest');
    }

    const body = await req.json();
    const { eventId, eventIds, email, phone, isCart, userId } = body;

    // Use authenticated user ID if available, otherwise use userId from body, or null for guest
    const finalUserId = authenticatedUserId || userId || null;
    
    // Get email: prefer authenticated user's email, then body email, then undefined (Stripe will collect)
    let finalEmail: string | undefined = authenticatedUserEmail || email || undefined;
    
    console.log('📧 Email sources:', {
      authenticatedUserEmail,
      emailFromBody: email,
      finalEmail
    });

    // Support both single event and cart (multiple events)
    const eventIdsToProcess = eventIds || (eventId ? [eventId] : []);

    if (eventIdsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Event ID(s) are required' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Fetch all events
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('*')
      .in('id', eventIdsToProcess);

    if (eventError || !events || events.length === 0) {
      throw new Error('Event(s) not found');
    }

    // Check for existing tickets (prevent duplicates)
    console.log('🔍 Checking for existing tickets:', { 
      finalUserId, 
      email, 
      eventIdsToProcess,
      authenticatedUserId,
      userIdFromBody: userId
    });
    
    let existingTickets: any[] = [];
    
    // First, try to check by user_id if we have one
    if (finalUserId) {
      const { data: ticketsByUserId, error: ticketCheckError } = await supabase
        .from('tickets')
        .select('event_id, user_id, email')
        .eq('user_id', finalUserId)
        .in('event_id', eventIdsToProcess)
        .eq('status', 'active');

      console.log('🔍 Existing tickets check result (by user_id):', { 
        ticketsByUserId, 
        ticketCheckError,
        count: ticketsByUserId?.length || 0
      });

      if (ticketCheckError) {
        console.error('❌ Error checking tickets by user_id:', ticketCheckError);
      }

      if (ticketsByUserId && ticketsByUserId.length > 0) {
        existingTickets = ticketsByUserId;
      }
    }
    
    // Also check by email as a fallback (in case user_id wasn't set correctly)
    if (email && existingTickets.length === 0) {
      const normalizedEmail = email.toLowerCase().trim();
      const { data: ticketsByEmail, error: ticketCheckErrorByEmail } = await supabase
        .from('tickets')
        .select('event_id, user_id, email')
        .ilike('email', normalizedEmail)
        .in('event_id', eventIdsToProcess)
        .eq('status', 'active');

      console.log('🔍 Existing tickets check result (by email):', { 
        ticketsByEmail, 
        ticketCheckErrorByEmail,
        count: ticketsByEmail?.length || 0,
        email: normalizedEmail
      });

      if (ticketCheckErrorByEmail) {
        console.error('❌ Error checking tickets by email:', ticketCheckErrorByEmail);
      }

      if (ticketsByEmail && ticketsByEmail.length > 0) {
        existingTickets = ticketsByEmail;
      }
    }
    
    // If we found any existing tickets, block the checkout
    if (existingTickets.length > 0) {
      const existingEventIds = existingTickets.map(t => t.event_id);
      console.log('❌ Blocking checkout - user already has tickets for:', existingEventIds);
      
      // Get event titles for a more user-friendly error message
      const existingEvents = events.filter(e => existingEventIds.includes(e.id));
      const eventTitles = existingEvents.map(e => e.title || `Event ${e.id}`).join(', ');
      
      const errorMessage = existingEvents.length === 1
        ? `You have already purchased a ticket for "${eventTitles}". Please check your tickets or contact support if you believe this is an error.`
        : `You have already purchased tickets for the following events: ${eventTitles}. Please check your tickets or contact support if you believe this is an error.`;
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    
    console.log('✅ No existing tickets found - proceeding with checkout');

    // Build line items for Stripe
    const lineItems = events.map(event => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: event.title,
          description: event.description || `Ticket for ${event.title}`,
          images: event.image_url ? [event.image_url] : undefined,
        },
        unit_amount: Math.round((event.price || 0) * 100), // Convert to cents
      },
      quantity: 1,
    }));

    // Determine success/cancel URLs
    // IMPORTANT: Stripe requires publicly accessible URLs for redirects
    // For local development, use a tunnel service (ngrok/localtunnel)
    // Set SITE_URL secret in Supabase to your tunnel URL (e.g., https://abc123.ngrok.io)
    const siteUrl = Deno.env.get('SITE_URL') || 'https://prodreemystar.netlify.app';
    
    // Log the URL being used (helpful for debugging)
    console.info('🔗 Using SITE_URL for redirects:', siteUrl);
    if (siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1')) {
      console.warn('⚠️ WARNING: Localhost URLs won\'t work with Stripe redirects!');
      console.warn('⚠️ Use ngrok or localtunnel to create a public URL for local development.');
    }
    
    const successUrl = isCart 
      ? `${siteUrl}/ticket-confirmation?session_id={CHECKOUT_SESSION_ID}&cart=true`
      : `${siteUrl}/ticket-confirmation?session_id={CHECKOUT_SESSION_ID}&eventId=${eventIdsToProcess[0]}`;
    const cancelUrl = isCart 
      ? `${siteUrl}/cart`
      : `${siteUrl}/watch/${eventIdsToProcess[0]}`;

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: finalEmail,
      metadata: {
        eventIds: eventIdsToProcess.join(','),
        isCart: isCart ? 'true' : 'false',
        userId: finalUserId || '',
        phone: phone && typeof phone === 'string' ? phone : '',
      },
    });

    return new Response(
      JSON.stringify({ 
        sessionId: session.id,
        url: session.url 
      }),
      { 
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
