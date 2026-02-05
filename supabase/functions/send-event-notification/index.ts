import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";
import sgMail from "npm:@sendgrid/mail@8.1.1";
import twilio from "npm:twilio@4.22.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { eventId, notificationType } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        *,
        profiles:artist_id (
          full_name,
          email,
          phone
        )
      `)
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;

    // Get all users with their notification preferences
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('*');

    if (usersError) throw usersError;

    // Initialize email service
    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    if (SENDGRID_API_KEY) {
      sgMail.setApiKey(SENDGRID_API_KEY);
    }

    // Initialize SMS service
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    let twilioClient;
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    }

    // Prepare notification content
    let subject, message;
    switch (notificationType) {
      case 'upcoming':
        subject = `Upcoming Event: ${event.title}`;
        message = `Your event "${event.title}" is starting in 1 hour!`;
        break;
      case 'starting_soon':
        subject = `Starting Soon: ${event.title}`;
        message = `Your event "${event.title}" is starting in 30 minutes!`;
        break;
      case 'about_to_start':
        subject = `Event Starting: ${event.title}`;
        message = `Your event "${event.title}" is starting in 5 minutes!`;
        break;
      case 'event_summary':
        const { count: ticketCount } = await supabase
          .from('tickets')
          .select('*', { count: 'exact' })
          .eq('event_id', eventId)
          .eq('status', 'active');

        const revenue = (ticketCount || 0) * event.price;
        const artistShare = revenue / 2;
        
        subject = `Event Summary: ${event.title}`;
        message = `
          Event Summary for "${event.title}"
          Artist: ${event.profiles.full_name}
          Email: ${event.profiles.email}
          Tickets Sold: ${ticketCount}
          Total Revenue: €${revenue.toFixed(2)}
          Artist Share: €${artistShare.toFixed(2)}
        `;
        break;
      case 'ticket_purchase':
        subject = `Ticket Confirmation: ${event.title}`;
        message = `Thank you for purchasing a ticket to "${event.title}"! Here's your streaming link: ${Deno.env.get('SITE_URL')}/watch/${eventId}`;
        break;
    }

    // Send notifications based on user preferences
    for (const user of users) {
      if (user.notification_preference === 'email' && user.email) {
        try {
          await sgMail.send({
            to: user.email,
            from: Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@dreemystar.com",
            subject,
            text: message,
          });
        } catch (error) {
          console.error(`Failed to send email to ${user.email}:`, error);
        }
      } else if (user.notification_preference === 'phone' && user.phone && twilioClient && TWILIO_PHONE_NUMBER) {
        try {
          await twilioClient.messages.create({
            body: message,
            to: user.phone,
            from: TWILIO_PHONE_NUMBER,
          });
        } catch (error) {
          console.error(`Failed to send SMS to ${user.phone}:`, error);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error('Error in send-event-notification:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});