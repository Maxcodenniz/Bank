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
    const {
      userId,
      eventId,
      notificationType,
      eventTitle,
      startTime,
      ticketLink,
      viewerCount,
      totalRevenue,
      phoneNumber
    } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get admin profiles
    const { data: adminProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_type', 'global_admin');

    if (profileError) throw profileError;

    // Send notifications to all admins
    for (const admin of adminProfiles) {
      const preferEmail = admin.notification_preference === 'email';
      
      if (preferEmail && admin.email) {
        const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
        if (!SENDGRID_API_KEY) throw new Error("SendGrid API key not configured");
        
        sgMail.setApiKey(SENDGRID_API_KEY);

        let emailContent = '';
        let subject = '';

        switch (notificationType) {
          case 'callback_request':
            subject = 'New Callback Request';
            emailContent = `
              <h2>New Callback Request</h2>
              <p>A new callback request has been received.</p>
              <p>Phone Number: ${phoneNumber}</p>
              <p>Time: ${new Date().toLocaleString()}</p>
            `;
            break;

          case 'event_summary':
            subject = `Event Summary: ${eventTitle}`;
            emailContent = `
              <h2>Event Summary</h2>
              <p>Event: ${eventTitle}</p>
              <p>Total Viewers: ${viewerCount}</p>
              <p>Total Revenue: €${totalRevenue.toFixed(2)}</p>
            `;
            break;
        }

        await sgMail.send({
          to: admin.email,
          from: Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@dreemystar.com",
          subject,
          html: emailContent,
        });
      } else if (admin.phone) {
        // SMS notification via Twilio
        const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
          throw new Error("Twilio configuration missing");
        }

        const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

        let message = '';
        switch (notificationType) {
          case 'callback_request':
            message = `New callback request from: ${phoneNumber}`;
            break;
          case 'event_summary':
            message = `Event Summary - ${eventTitle}: ${viewerCount} viewers, Revenue: €${totalRevenue.toFixed(2)}`;
            break;
        }

        await client.messages.create({
          body: message,
          to: admin.phone,
          from: TWILIO_PHONE_NUMBER
        });
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
    console.error("Error sending notification:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to send notification" 
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