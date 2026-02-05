import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  console.log('📧 send-ticket-confirmation function called');
  console.log('📧 Request method:', req.method);
  console.log('📧 Request URL:', req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.error('❌ Invalid method:', req.method);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    console.log('📧 Request body received:', { 
      ticketId: body.ticketId, 
      eventId: body.eventId, 
      email: body.email ? `${body.email.substring(0, 3)}***` : 'missing' 
    });
    
    const { ticketId, eventId, email } = body;

    if (!ticketId || !eventId || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: ticketId, eventId, email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('Error fetching ticket:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select(`
        *,
        profiles:artist_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      console.error('Error fetching event:', eventError);
      return new Response(
        JSON.stringify({ error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get site URL for access link
    const siteUrl = Deno.env.get('SITE_URL') || 'https://prodreemystar.netlify.app';
    
    // Validate SITE_URL is not a Stripe domain
    const isValidSiteUrl = siteUrl && 
      !siteUrl.includes('stripe.com') && 
      !siteUrl.includes('buy.stripe.com') &&
      siteUrl.startsWith('http');

    const finalSiteUrl = isValidSiteUrl 
      ? siteUrl 
      : 'https://prodreemystar.netlify.app';

    // Generate access link
    // For guest tickets (no user_id), include email in URL so page can verify ticket
    const isGuestTicket = !ticket.user_id;
    const accessLink = isGuestTicket 
      ? `${finalSiteUrl}/watch/${eventId}?email=${encodeURIComponent(email)}`
      : `${finalSiteUrl}/watch/${eventId}`;
    
    console.log(`📧 Generated access link (guest: ${isGuestTicket}): ${accessLink}`);

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';

    console.log('📧 Resend configuration check:', {
      hasApiKey: !!resendApiKey,
      apiKeyLength: resendApiKey?.length || 0,
      fromEmail: resendFromEmail
    });

    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY not configured in Supabase secrets');
      console.error('❌ Please set it with: supabase secrets set RESEND_API_KEY=your_key');
      return new Response(
        JSON.stringify({ error: 'Email service not configured - RESEND_API_KEY missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format event date
    const eventDate = new Date(event.start_time);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Build email content
    const artistName = event.profiles?.full_name || event.profiles?.username || event.unregistered_artist_name || 'Artist';
    const eventTitle = event.title || 'Live Event';

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
              <h1>🎟️ Ticket Confirmation</h1>
            </div>
            <div class="content">
              <h2>Thank you for your purchase!</h2>
              <p>Your ticket has been confirmed. Here are your event details:</p>
              
              <div class="event-details">
                <h3>${eventTitle}</h3>
                <p><strong>Artist:</strong> ${artistName}</p>
                <p><strong>Date & Time:</strong> ${formattedDate}</p>
                <p><strong>Duration:</strong> ${event.duration} minutes</p>
                ${event.price > 0 ? `<p><strong>Price:</strong> €${event.price.toFixed(2)}</p>` : ''}
              </div>

              <p>Click the button below to access your event:</p>
              <a href="${accessLink}" class="button">Watch Event</a>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${accessLink}</p>

              <p><strong>Important:</strong> Please save this email. You'll need it to access the event when it goes live.</p>
            </div>
            <div class="footer">
              <p>© 2025 DREEMYSTAR - All rights reserved</p>
              <p>If you have any questions, please contact support.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    console.log('📧 Sending email via Resend API...');
    console.log('📧 Email details:', {
      to: email,
      from: resendFromEmail,
      subject: `🎟️ Ticket Confirmation: ${eventTitle}`,
      accessLink: accessLink
    });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: email,
        subject: `🎟️ Ticket Confirmation: ${eventTitle}`,
        html: emailHtml,
      }),
    });

    console.log('📧 Resend API response status:', resendResponse.status);
    console.log('📧 Resend API response headers:', Object.fromEntries(resendResponse.headers.entries()));

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('❌ Resend API error:', errorText);
      console.error('❌ Response status:', resendResponse.status);
      
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = JSON.stringify(errorJson, null, 2);
        console.error('❌ Parsed error:', errorJson);
      } catch (e) {
        // Not JSON, use as-is
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email via Resend API', 
          details: errorDetails,
          status: resendResponse.status
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendData = await resendResponse.json();
    console.log('✅ Ticket confirmation email sent successfully to buyer!');
    console.log('✅ Resend response:', JSON.stringify(resendData, null, 2));

    // Now send notifications to admins
    console.log('📧 Fetching admins to notify about ticket purchase...');
    
    // Fetch all global admins and super admins
    const { data: admins, error: adminsError } = await supabase
      .from('profiles')
      .select('*')
      .in('user_type', ['global_admin', 'super_admin']);

    if (adminsError) {
      console.error('❌ Error fetching admins:', adminsError);
      // Don't fail the whole request if admin notification fails
    } else if (admins && admins.length > 0) {
      console.log(`📧 Found ${admins.length} admin(s) to notify`);

      // Enrich admins with email from auth.users if profile email is missing
      const adminsToNotify = [];
      for (const admin of admins) {
        let adminEmail = admin.email;
        
        if (!adminEmail) {
          // Try to get email from auth.users
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(admin.id);
            if (authUser?.user?.email) {
              adminEmail = authUser.user.email;
              console.log(`📧 Found email for admin ${admin.id} from auth.users: ${adminEmail}`);
            }
          } catch (authErr) {
            console.warn(`⚠️ Could not fetch email from auth.users for admin ${admin.id}:`, authErr);
          }
        }
        
        if (adminEmail) {
          adminsToNotify.push({ ...admin, email: adminEmail });
        } else {
          console.warn(`⚠️ Admin ${admin.id} (${admin.username || admin.full_name || 'Unknown'}) has no email address. Skipping.`);
        }
      }

      if (adminsToNotify.length > 0) {
        console.log(`📧 Sending admin notifications to ${adminsToNotify.length} admin(s)...`);
        
        // Build admin notification email content
        const adminEmailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
                .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎟️ New Ticket Purchase</h1>
                </div>
                <div class="content">
                  <h2>Ticket Purchase Notification</h2>
                  <p>A new ticket has been purchased for an upcoming event.</p>
                  
                  <div class="details">
                    <h3>Purchase Details:</h3>
                    <p><strong>Event:</strong> ${eventTitle}</p>
                    <p><strong>Artist:</strong> ${artistName}</p>
                    <p><strong>Buyer Email:</strong> ${email}</p>
                    <p><strong>Ticket ID:</strong> ${ticketId}</p>
                    <p><strong>Price:</strong> €${event.price.toFixed(2)}</p>
                    <p><strong>Date & Time:</strong> ${formattedDate}</p>
                    <p><strong>Purchase Date:</strong> ${new Date().toLocaleString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</p>
                  </div>

                  <p>Click the button below to view event details:</p>
                  <a href="${finalSiteUrl}/watch/${eventId}" class="button">View Event</a>
                </div>
                <div class="footer">
                  <p>© 2025 DREEMYSTAR - All rights reserved</p>
                </div>
              </div>
            </body>
          </html>
        `;

        // Send emails to admins with rate limiting (600ms delay between emails)
        const emailDelayMs = 600;
        
        for (let i = 0; i < adminsToNotify.length; i++) {
          const admin = adminsToNotify[i];
          
          // Add delay before sending (except for the first email)
          if (i > 0) {
            console.log(`⏳ Waiting ${emailDelayMs}ms before sending next admin email (rate limit protection)...`);
            await new Promise(resolve => setTimeout(resolve, emailDelayMs));
          }
          
          console.log(`📧 Sending admin notification to: ${admin.email}`);
          
          try {
            const adminResendResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: resendFromEmail,
                to: admin.email,
                subject: `🎟️ New Ticket Purchase: ${eventTitle}`,
                html: adminEmailHtml,
              }),
            });

            if (!adminResendResponse.ok) {
              const errorText = await adminResendResponse.text();
              console.error(`❌ Failed to send email to admin ${admin.email}:`, errorText);
              
              try {
                const errorJson = JSON.parse(errorText);
                console.error(`❌ Error details:`, JSON.stringify(errorJson, null, 2));
              } catch (e) {
                // Not JSON, use as-is
              }
            } else {
              const adminResendData = await adminResendResponse.json();
              console.log(`✅ Successfully sent admin notification to ${admin.email}`);
            }
          } catch (adminEmailErr) {
            console.error(`❌ Exception sending email to admin ${admin.email}:`, adminEmailErr);
          }
        }
        
        console.log(`✅ Completed sending admin notifications`);
      } else {
        console.warn('⚠️ No admins with email addresses found. Admin notifications skipped.');
      }
    } else {
      console.warn('⚠️ No admins found in database. Admin notifications skipped.');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailId: resendData.id,
        message: 'Email sent successfully to buyer and admins' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-ticket-confirmation:', error);
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

