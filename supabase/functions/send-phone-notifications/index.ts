import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import twilio from 'npm:twilio@4.22.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

Deno.serve(async (req) => {
  // Log immediately when function is called
  console.log('📱 ========================================');
  console.log('📱 send-phone-notifications function called');
  console.log('📱 Request method:', req.method);
  console.log('📱 Timestamp:', new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    console.log('📱 OPTIONS request - returning CORS headers');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    console.log('📱 Invalid method:', req.method);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('📱 Parsing request body...');
    const requestBody = await req.json();
    console.log('📱 Request body received:', JSON.stringify(requestBody));
    
    const { eventId, eventTitle, artistId, artistName, notificationType } = requestBody;

    console.log('📱 Extracted parameters:', {
      eventId,
      eventTitle,
      artistId,
      artistName,
      notificationType
    });

    if (!eventId || !eventTitle || !notificationType) {
      console.log('📱 ❌ Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: eventId, eventTitle, notificationType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate notificationType
    if (notificationType !== 'event_scheduled' && notificationType !== 'live_event_started') {
      console.log('📱 ❌ Invalid notificationType:', notificationType);
      return new Response(
        JSON.stringify({ error: 'Invalid notificationType. Must be "event_scheduled" or "live_event_started"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📱 ✅ Parameters validated');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    console.log('📱 Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
    console.log('📱 Supabase Service Key:', supabaseServiceKey ? 'Set' : 'Missing');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Initialize Twilio
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    console.log('📱 Twilio Configuration Check:');
    console.log('📱   TWILIO_ACCOUNT_SID:', TWILIO_ACCOUNT_SID ? `${TWILIO_ACCOUNT_SID.substring(0, 10)}...` : '❌ Missing');
    console.log('📱   TWILIO_AUTH_TOKEN:', TWILIO_AUTH_TOKEN ? 'Set' : '❌ Missing');
    console.log('📱   TWILIO_PHONE_NUMBER:', TWILIO_PHONE_NUMBER || '❌ Missing');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.log('⚠️ Twilio not configured - skipping phone notifications');
      return new Response(
        JSON.stringify({ 
          message: 'Twilio not configured', 
          skipped: true,
          note: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('📱 ✅ Twilio client initialized');

    // Get phone notification configs
    const configKeyFollowers = notificationType === 'event_scheduled' 
      ? 'event_scheduled_phone_notify_followers'
      : 'live_event_started_phone_notify_followers';
    
    const configKeyAll = notificationType === 'event_scheduled'
      ? 'event_scheduled_phone_notify_all'
      : 'live_event_started_phone_notify_all';

    console.log('📱 Checking notification configs:', {
      configKeyFollowers,
      configKeyAll
    });

    const { data: configs, error: configError } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [configKeyFollowers, configKeyAll]);

    if (configError) {
      console.error('📱 ❌ Error fetching configs:', configError);
    } else {
      console.log('📱 Configs fetched:', configs);
    }

    const configMap: Record<string, boolean> = {};
    configs?.forEach(config => {
      configMap[config.key] = config.value === true || config.value === 'true';
    });

    const notifyFollowers = configMap[configKeyFollowers] ?? false;
    const notifyAll = configMap[configKeyAll] ?? false;

    console.log('📱 Notification settings:', {
      notifyFollowers,
      notifyAll,
      configKeyFollowers,
      configKeyAll
    });

    if (!notifyFollowers && !notifyAll) {
      console.log(`📱 ⚠️ Phone notifications disabled for ${notificationType}`);
      return new Response(
        JSON.stringify({ 
          message: 'Phone notifications disabled', 
          skipped: true,
          notifyFollowers,
          notifyAll
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get site URL for access link
    const siteUrl = Deno.env.get('SITE_URL') || 'https://prodreemystar.netlify.app';
    const watchUrl = `${siteUrl}/watch/${eventId}`;
    const eventUrl = `${siteUrl}/artist/${artistId}`;

    // Build SMS message
    const artistDisplayName = artistName || 'Artist';
    let smsMessage = '';
    
    if (notificationType === 'event_scheduled') {
      smsMessage = `${artistDisplayName} has scheduled a new event: "${eventTitle}". Watch it live: ${watchUrl}`;
    } else {
      smsMessage = `${artistDisplayName} is now live! "${eventTitle}" has started. Watch now: ${watchUrl}`;
    }

    console.log('📱 SMS message prepared:', smsMessage.substring(0, 100) + '...');

    // Collect phone numbers
    const phoneSet = new Set<string>();
    let totalUsers = 0;
    let usersWithPhones = 0;

    // Get followers if enabled
    if (notifyFollowers && artistId) {
      console.log('📱 Fetching followers for artist:', artistId);
      const { data: followers, error: followersError } = await supabase
        .from('favorite_artists')
        .select(`
          user_id,
          profiles:user_id (
            id,
            phone
          )
        `)
        .eq('artist_id', artistId);

      if (followersError) {
        console.error('📱 ❌ Error fetching followers:', followersError);
      } else {
        console.log('📱 Found followers:', followers?.length || 0);
        if (followers) {
          totalUsers += followers.length;
          followers.forEach((follower: any) => {
            const phone = follower.profiles?.phone;
            if (phone && phone.trim()) {
              phoneSet.add(phone.trim());
              usersWithPhones++;
            }
          });
          console.log('📱 Followers with phone numbers:', usersWithPhones);
        }
      }
    }

    // Get all users if enabled
    if (notifyAll) {
      console.log('📱 Fetching all users with phone numbers...');
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, phone')
        .not('phone', 'is', null);

      if (allProfilesError) {
        console.error('📱 ❌ Error fetching all profiles:', allProfilesError);
      } else {
        console.log('📱 Found profiles with phones:', allProfiles?.length || 0);
        if (allProfiles) {
          totalUsers += allProfiles.length;
          allProfiles.forEach((profile: any) => {
            if (profile.phone && profile.phone.trim()) {
              phoneSet.add(profile.phone.trim());
              usersWithPhones++;
            }
          });
          console.log('📱 Total users with phone numbers:', usersWithPhones);
        }
      }
    }

    // Remove duplicates and convert to array
    const phoneNumbers = Array.from(phoneSet);

    console.log('📱 Final phone numbers to notify:', phoneNumbers.length);
    if (phoneNumbers.length > 0) {
      console.log('📱 Sample phone numbers:', phoneNumbers.slice(0, 3));
    }

    if (phoneNumbers.length === 0) {
      console.log('📱 ⚠️ No phone numbers found to notify');
      return new Response(
        JSON.stringify({ 
          message: 'No phone numbers found', 
          totalUsers,
          usersWithPhones: 0,
          phonesSent: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS to all phone numbers
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];
    const twilioErrors: any[] = [];

    console.log(`📱 📤 Starting to send SMS to ${phoneNumbers.length} phone numbers...`);

    // Send SMS in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
      const batch = phoneNumbers.slice(i, i + batchSize);
      console.log(`📱 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} numbers)...`);
      
      await Promise.allSettled(
        batch.map(async (phone) => {
          try {
            const message = await twilioClient.messages.create({
              body: smsMessage,
              to: phone,
              from: TWILIO_PHONE_NUMBER,
            });
            successCount++;
            console.log(`✅ SMS sent to ${phone} (SID: ${message.sid})`);
          } catch (error: any) {
            failureCount++;
            
            // Extract detailed error information
            const errorCode = error.code;
            const errorMessage = error.message || 'Unknown error';
            const errorStatus = error.status;
            const errorMoreInfo = error.moreInfo;
            
            // Check for common Twilio trial account errors
            let userFriendlyError = errorMessage;
            if (errorCode === 21211) {
              userFriendlyError = `Phone number ${phone} is not verified. Twilio trial accounts can only send to verified numbers.`;
            } else if (errorCode === 21608) {
              userFriendlyError = `Phone number ${phone} is unverified. Add it in Twilio Console > Phone Numbers > Verified Caller IDs`;
            } else if (errorCode === 21614) {
              userFriendlyError = `Phone number ${phone} format is invalid. Ensure it's in E.164 format (e.g., +1234567890)`;
            } else if (errorStatus === 400) {
              userFriendlyError = `Invalid request for ${phone}: ${errorMessage}`;
            }
            
            const errorDetails = {
              phone,
              code: errorCode,
              message: userFriendlyError,
              status: errorStatus,
              moreInfo: errorMoreInfo
            };
            
            errors.push(`${phone}: ${userFriendlyError}`);
            twilioErrors.push(errorDetails);
            console.error(`❌ Failed to send SMS to ${phone}:`, JSON.stringify(errorDetails));
          }
        })
      );

      // Small delay between batches to avoid rate limits
      if (i + batchSize < phoneNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Check if all failures are due to unverified numbers (trial account limitation)
    const unverifiedErrors = twilioErrors.filter(e => e.code === 21211 || e.code === 21608);
    const isTrialAccountIssue = failureCount > 0 && unverifiedErrors.length === failureCount;

    console.log(`📱 ✅ SMS notifications complete: ${successCount} sent, ${failureCount} failed`);
    if (isTrialAccountIssue) {
      console.log('📱 ⚠️ All failures are due to unverified phone numbers (Twilio trial account limitation)');
    }

    return new Response(
      JSON.stringify({ 
        success: successCount > 0,
        notificationType,
        totalUsers,
        usersWithPhones,
        phonesSent: successCount,
        phonesFailed: failureCount,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit error details
        twilioErrors: twilioErrors.length > 0 ? twilioErrors.slice(0, 5) : undefined,
        isTrialAccountIssue,
        trialAccountNote: isTrialAccountIssue 
          ? 'All failures are due to unverified phone numbers. Twilio trial accounts can only send to verified numbers. Verify numbers in Twilio Console > Phone Numbers > Verified Caller IDs, or upgrade to a paid account.'
          : undefined,
        message: `Sent ${successCount} SMS notifications${failureCount > 0 ? `, ${failureCount} failed` : ''}`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('📱 ❌ Error in send-phone-notifications:', error);
    console.error('📱 Error details:', error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error);
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
