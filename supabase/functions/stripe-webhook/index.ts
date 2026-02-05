import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  // Handle checkout.session.completed events (for one-time payments and subscriptions)
  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;
    const { mode, payment_status, customer, customer_email } = session;

    console.info(`Processing checkout.session.completed event: mode=${mode}, payment_status=${payment_status}`);

    // Handle one-time payments (ticket purchases)
    if (mode === 'payment' && payment_status === 'paid') {
      try {
        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
          metadata,
        } = session;
        
        // Get customer_email from session (for guest checkout)
        // Try multiple sources: session.customer_email, payment_intent customer, or customer object
        let sessionCustomerEmail = customer_email;
        
        // If customer_email is not in session, try to get it from payment_intent
        if (!sessionCustomerEmail && payment_intent) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent as string);
            if (paymentIntent.receipt_email) {
              sessionCustomerEmail = paymentIntent.receipt_email;
              console.log(`📧 Found email from payment_intent.receipt_email: ${sessionCustomerEmail}`);
            } else if (paymentIntent.customer && typeof paymentIntent.customer === 'string') {
              const customerObj = await stripe.customers.retrieve(paymentIntent.customer);
              if (customerObj && !customerObj.deleted && 'email' in customerObj && customerObj.email) {
                sessionCustomerEmail = customerObj.email;
                console.log(`📧 Found email from payment_intent.customer: ${sessionCustomerEmail}`);
              }
            }
          } catch (piError) {
            console.warn('⚠️ Could not retrieve payment_intent to get email:', piError);
          }
        }
        
        // Fallback: try customer object if it's not a string
        if (!sessionCustomerEmail && customer && typeof customer !== 'string') {
          sessionCustomerEmail = (customer as any)?.email || null;
          if (sessionCustomerEmail) {
            console.log(`📧 Found email from customer object: ${sessionCustomerEmail}`);
          }
        }
        
        // Final fallback: if customer is a string ID, retrieve the customer
        if (!sessionCustomerEmail && customer && typeof customer === 'string') {
          try {
            const customerObj = await stripe.customers.retrieve(customer);
            if (customerObj && !customerObj.deleted && 'email' in customerObj && customerObj.email) {
              sessionCustomerEmail = customerObj.email;
              console.log(`📧 Found email from customer ID: ${sessionCustomerEmail}`);
            }
          } catch (custError) {
            console.warn('⚠️ Could not retrieve customer to get email:', custError);
          }
        }
        
        console.log(`📧 Final sessionCustomerEmail: ${sessionCustomerEmail || 'null'}`);

        // Get customer ID from metadata or try to find by email
        let customerIdForOrder: string | null = null;
        if (metadata?.userId) {
          customerIdForOrder = metadata.userId;
        } else if (sessionCustomerEmail) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', sessionCustomerEmail)
            .maybeSingle();
          customerIdForOrder = profile?.id || null;
        }

        // Insert the order into the stripe_orders table
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerIdForOrder,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed',
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
        console.log(`📋 Session metadata:`, JSON.stringify(metadata, null, 2));
        console.log(`📋 Customer email from session:`, customer_email);
        console.log(`📋 Session customer email variable:`, sessionCustomerEmail);

        // Handle ticket creation for events
        if (!metadata) {
          console.warn('⚠️ No metadata found in checkout session - cannot create tickets');
        } else if (!metadata.eventId && !metadata.eventIds) {
          console.warn('⚠️ Metadata found but no eventId or eventIds - cannot create tickets');
          console.warn('⚠️ Metadata keys:', Object.keys(metadata));
        } else {
          console.log(`✅ Metadata contains event IDs - proceeding with ticket creation`);
          const eventIds = metadata.eventIds 
            ? metadata.eventIds.split(',').filter((id: string) => id.trim())
            : [metadata.eventId].filter((id: string) => id);
          
          const isCart = metadata.isCart === 'true';
          
          console.info(`Creating tickets for ${eventIds.length} event(s):`, eventIds);

          // Get user ID from customer email or metadata
          let userId: string | null = null;
          if (metadata.userId) {
            userId = metadata.userId;
          } else if (sessionCustomerEmail) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', sessionCustomerEmail)
              .maybeSingle();
            userId = profile?.id || null;
          }

          // Check for existing tickets before creating new ones (prevent duplicates)
          // Note: Payment has already been processed, so we'll log warnings but still process
          let existingTickets: any[] = [];
          
          if (userId) {
            // Check by user_id for logged-in users
            const { data: ticketsByUserId } = await supabase
              .from('tickets')
              .select('event_id, id')
              .eq('user_id', userId)
              .in('event_id', eventIds)
              .eq('status', 'active');
            
            if (ticketsByUserId && ticketsByUserId.length > 0) {
              existingTickets = ticketsByUserId;
              console.warn(`⚠️ WARNING: User ${userId} already has active tickets for events: ${ticketsByUserId.map(t => t.event_id).join(', ')}`);
              console.warn(`⚠️ Payment was already processed - tickets will still be created. Consider refunding.`);
            }
          }
          
          // Also check by email (for guests or as fallback)
          if (sessionCustomerEmail) {
            const normalizedEmail = sessionCustomerEmail.toLowerCase().trim();
            const { data: ticketsByEmail } = await supabase
              .from('tickets')
              .select('event_id, id')
              .ilike('email', normalizedEmail)
              .in('event_id', eventIds)
              .eq('status', 'active');
            
            if (ticketsByEmail && ticketsByEmail.length > 0) {
              // Only use email-based check if we didn't find tickets by user_id
              if (existingTickets.length === 0) {
                existingTickets = ticketsByEmail;
                console.warn(`⚠️ WARNING: Email ${normalizedEmail} already has active tickets for events: ${ticketsByEmail.map(t => t.event_id).join(', ')}`);
                console.warn(`⚠️ Payment was already processed - tickets will still be created. Consider refunding.`);
              }
            }
          }
          
          // Filter out events that already have tickets
          const existingEventIds = existingTickets.map(t => t.event_id);
          const eventsToCreateTicketsFor = eventIds.filter(eventId => !existingEventIds.includes(eventId));
          
          if (existingTickets.length > 0) {
            console.warn(`⚠️ Skipping duplicate ticket creation for: ${existingEventIds.join(', ')}`);
            console.warn(`⚠️ Will create tickets only for: ${eventsToCreateTicketsFor.join(', ') || 'none'}`);
          }
          
          // Create tickets only for events that don't already have tickets
          const tickets = [];
          
          if (eventsToCreateTicketsFor.length === 0) {
            console.warn(`⚠️ All events already have tickets - payment processed but no new tickets created`);
            console.warn(`⚠️ Consider refunding payment for session: ${checkout_session_id}`);
            // Don't create duplicate tickets, but continue to send confirmation email
            // The email will inform the user they already have tickets
            // We'll use the existing tickets for the email
            if (existingTickets.length > 0) {
              // Use existing tickets for email confirmation
              for (const existingTicket of existingTickets) {
                tickets.push(existingTicket);
              }
            }
          } else {
            // Create tickets only for events without existing tickets
            const ticketPhone = metadata.phone && typeof metadata.phone === 'string' ? metadata.phone : null;
            for (const eventId of eventsToCreateTicketsFor) {
              const { data: ticket, error: ticketError } = await supabase
                .from('tickets')
                .insert({
                  event_id: eventId,
                  user_id: userId,
                  email: sessionCustomerEmail || null,
                  phone: ticketPhone,
                  stripe_payment_id: payment_intent,
                  stripe_session_id: checkout_session_id,
                  status: 'active',
                })
                .select()
                .single();

              if (ticketError) {
                console.error(`Error creating ticket for event ${eventId}:`, ticketError);
              } else {
                console.info(`✅ Created ticket ${ticket.id} for event ${eventId}`);
                console.info(`📧 Ticket email saved:`, ticket.email);
                console.info(`📧 Ticket user_id saved:`, ticket.user_id);
                console.info(`📧 Ticket full data:`, JSON.stringify({
                  id: ticket.id,
                  event_id: ticket.event_id,
                  email: ticket.email,
                  user_id: ticket.user_id,
                  status: ticket.status
                }, null, 2));
                tickets.push(ticket);
              }
            }
            // Optionally update profile phone if we have userId and phone and profile has no phone
            if (userId && ticketPhone) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('phone')
                .eq('id', userId)
                .single();
              if (profile && !profile.phone) {
                await supabase.from('profiles').update({ phone: ticketPhone }).eq('id', userId);
              }
            }
          }

          // Send confirmation emails for all tickets
          console.log(`📧 Email sending check: tickets.length=${tickets.length}, sessionCustomerEmail=${sessionCustomerEmail ? 'present' : 'missing'}`);
          console.log(`📧 Tickets array:`, JSON.stringify(tickets.map(t => ({ id: t.id, event_id: t.event_id })), null, 2));
          
          if (tickets.length > 0 && sessionCustomerEmail) {
            console.log(`📧 Preparing to send ${tickets.length} confirmation email(s) to ${sessionCustomerEmail}`);
            
            // Call send-ticket-confirmation function via HTTP (functions.invoke doesn't work in Edge Functions)
            try {
              const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
              const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
              // Use the actual deployed function name
              // If the breadcrumb shows "clever-function", use that; otherwise use "send-ticket-confirmation"
              const functionName = 'send-ticket-confirmation'; // Update this to match the actual deployed function name
              const emailFunctionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
              console.log(`📧 Using function name: ${functionName}`);
              
              console.log(`📧 Supabase URL: ${supabaseUrl}`);
              console.log(`📧 Email function URL: ${emailFunctionUrl}`);
              console.log(`📧 Has service key: ${!!supabaseServiceKey}`);
              
              for (const ticket of tickets) {
                console.log(`📧 Attempting to send email for ticket ${ticket.id}, event ${ticket.event_id}`);
                console.log(`📧 Request payload:`, JSON.stringify({
                  ticketId: ticket.id,
                  eventId: ticket.event_id,
                  email: sessionCustomerEmail,
                }, null, 2));
                
                const emailResponse = await fetch(emailFunctionUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    ticketId: ticket.id,
                    eventId: ticket.event_id,
                    email: sessionCustomerEmail,
                  }),
                });

                console.log(`📧 Email function response status: ${emailResponse.status}`);
                console.log(`📧 Email function response headers:`, Object.fromEntries(emailResponse.headers.entries()));
                
                if (!emailResponse.ok) {
                  const errorText = await emailResponse.text();
                  console.error(`❌ Error sending email for ticket ${ticket.id}:`, errorText);
                  console.error(`❌ Response status: ${emailResponse.status}`);
                  
                  // Check if function doesn't exist
                  if (emailResponse.status === 404) {
                    console.error(`❌ CRITICAL: send-ticket-confirmation function is not deployed!`);
                    console.error(`❌ Please deploy it with: supabase functions deploy send-ticket-confirmation`);
                  }
                } else {
                  const emailData = await emailResponse.json();
                  console.info(`✅ Successfully sent confirmation email for ticket ${ticket.id}`);
                  console.log(`📧 Email response:`, JSON.stringify(emailData, null, 2));
                }
              }
            } catch (emailErr) {
              console.error('❌ Exception while sending confirmation emails:', emailErr);
              console.error('❌ Exception details:', JSON.stringify(emailErr, null, 2));
              if (emailErr instanceof Error) {
                console.error('❌ Exception message:', emailErr.message);
                console.error('❌ Exception stack:', emailErr.stack);
              }
            }
          } else {
            console.warn('⚠️ Email sending skipped:');
            if (tickets.length === 0) {
              console.warn('⚠️   - No tickets to send emails for (tickets.length = 0)');
            }
            if (!sessionCustomerEmail) {
              console.warn('⚠️   - No customer email available for sending confirmation');
              console.warn('⚠️   - sessionCustomerEmail:', sessionCustomerEmail);
              console.warn('⚠️   - customer_email from session:', customer_email);
            }
          }
        }
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
      return; // Exit early after processing payment
    }

    // Handle subscription payments
    if (mode === 'subscription' && customer && typeof customer === 'string') {
      console.info(`Starting subscription sync for customer: ${customer}`);
      await syncCustomerFromStripe(customer);
      return;
    }
  }

  // Handle other event types
  // For one-time payments, we only process checkout.session.completed
  // Other events (charge, payment_intent, etc.) are handled by checkout.session.completed
  // So we can safely ignore them without logging errors
  
  // Skip charge and payment_intent events for one-time payments (they don't have customer field)
  if (event.type === 'charge.succeeded' || 
      event.type === 'payment_intent.succeeded' || 
      event.type === 'payment_intent.created') {
    // These are normal for one-time payments - skip silently
    return;
  }

  // Handle subscription-related events that require a customer
  if (!('customer' in stripeData)) {
    // For non-subscription events without customer, skip silently (not an error)
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    // Only log error for subscription-related events that require a customer
    if (event.type.includes('subscription') || event.type.includes('customer')) {
      console.error(`No customer received on subscription event: ${event.type}`);
    }
    return;
  }

  // Handle subscription-related events
  if (event.type.includes('subscription') || event.type.includes('customer')) {
    console.info(`Processing subscription event: ${event.type} for customer: ${customerId}`);
    await syncCustomerFromStripe(customerId);
  }
}

// based on the excellent https://github.com/t3dotgg/stripe-recommendations
async function syncCustomerFromStripe(customerId: string) {
  try {
    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    // TODO verify if needed
    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    // assumes that a customer can only have a single subscription
    const subscription = subscriptions.data[0];

    // store subscription state
    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }
    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}
