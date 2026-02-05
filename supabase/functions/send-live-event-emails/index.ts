import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { eventId, eventTitle, artistName } = await req.json();

    if (!eventId || !eventTitle) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: eventId, eventTitle' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get email notification configs
    const { data: configs } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [
        'live_event_email_notify_admins',
        'live_event_email_notify_artists',
        'live_event_email_notify_fans'
      ]);

    const configMap: Record<string, boolean> = {};
    configs?.forEach(config => {
      configMap[config.key] = config.value === true || config.value === 'true';
    });

    const notifyAdmins = configMap['live_event_email_notify_admins'] ?? true;
    const notifyArtists = configMap['live_event_email_notify_artists'] ?? true;
    const notifyFans = configMap['live_event_email_notify_fans'] ?? true;

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured - RESEND_API_KEY missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get site URL for access link
    const siteUrl = Deno.env.get('SITE_URL') || 'https://prodreemystar.netlify.app';
    const watchUrl = `${siteUrl}/watch/${eventId}`;

    // Collect all email addresses
    const emailSet = new Set<string>();

    // Get emails from registered users based on toggles
    let userQuery = supabase
      .from('profiles')
      .select('id, email, user_type');

    const { data: profiles, error: profilesError } = await userQuery;

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else if (profiles) {
      profiles.forEach(profile => {
        if (!profile.email) return;

        // Check if we should notify this user type
        if (profile.user_type === 'super_admin' || profile.user_type === 'global_admin' || profile.user_type === 'admin') {
          if (notifyAdmins) emailSet.add(profile.email.toLowerCase().trim());
        } else if (profile.user_type === 'artist') {
          if (notifyArtists) emailSet.add(profile.email.toLowerCase().trim());
        } else if (notifyFans) {
          emailSet.add(profile.email.toLowerCase().trim());
        }
      });
    }

    // Get emails from auth.users for users without email in profiles
    if (profiles) {
      for (const profile of profiles) {
        if (!profile.email) {
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
            if (authUser?.user?.email) {
              const email = authUser.user.email.toLowerCase().trim();
              
              // Check if we should notify this user type
              if (profile.user_type === 'super_admin' || profile.user_type === 'global_admin' || profile.user_type === 'admin') {
                if (notifyAdmins) emailSet.add(email);
              } else if (profile.user_type === 'artist') {
                if (notifyArtists) emailSet.add(email);
              } else if (notifyFans) {
                emailSet.add(email);
              }
            }
          } catch (err) {
            console.warn(`Could not fetch email for user ${profile.id}:`, err);
          }
        }
      }
    }

    // Get emails from guest ticket buyers (non-registered users)
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('email')
      .eq('event_id', eventId)
      .eq('status', 'active')
      .not('email', 'is', null);

    if (ticketsError) {
      console.error('Error fetching tickets:', ticketsError);
    } else if (tickets) {
      tickets.forEach(ticket => {
        if (ticket.email) {
          emailSet.add(ticket.email.toLowerCase().trim());
        }
      });
    }

    const emails = Array.from(emailSet);

    if (emails.length === 0) {
      console.log('No email addresses found to notify');
      return new Response(
        JSON.stringify({ message: 'No emails to send', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .event-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔴 Live Event Started!</h1>
            </div>
            <div class="content">
              <h2>${eventTitle} is now live!</h2>
              <p>${artistName || 'The artist'} has started streaming. Don't miss out!</p>
              
              <div class="event-details">
                <h3>${eventTitle}</h3>
                <p><strong>Artist:</strong> ${artistName || 'Artist'}</p>
                <p><strong>Status:</strong> 🔴 LIVE NOW</p>
              </div>

              <p>Click the button below to watch the live stream:</p>
              <a href="${watchUrl}" class="button">Watch Live Now</a>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${watchUrl}</p>

              <p><strong>Don't miss this live event!</strong></p>
            </div>
            <div class="footer">
              <p>© 2025 DREEMYSTAR - All rights reserved</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send emails in batches (Resend allows up to 50 recipients per request)
    const batchSize = 50;
    let sentCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resendFromEmail,
            to: batch,
            subject: `🔴 Live Now: ${eventTitle}`,
            html: emailHtml,
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error(`Error sending email batch ${i / batchSize + 1}:`, errorText);
          errors.push(`Batch ${i / batchSize + 1}: ${errorText}`);
        } else {
          sentCount += batch.length;
        }
      } catch (err) {
        console.error(`Exception sending email batch ${i / batchSize + 1}:`, err);
        errors.push(`Batch ${i / batchSize + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log(`✅ Sent ${sentCount} live event emails`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount,
        total: emails.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Emails sent to ${sentCount} recipients` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-live-event-emails:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
