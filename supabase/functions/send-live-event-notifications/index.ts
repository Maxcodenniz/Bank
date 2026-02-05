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

    // Check if notifications are enabled
    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'live_event_notifications_enabled')
      .single();

    const notificationsEnabled = config?.value === true || config?.value === 'true';

    if (!notificationsEnabled) {
      console.log('📢 Live event notifications are disabled');
      return new Response(
        JSON.stringify({ message: 'Notifications are disabled', skipped: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get site URL for access link
    const siteUrl = Deno.env.get('SITE_URL') || 'https://prodreemystar.netlify.app';
    const watchUrl = `${siteUrl}/watch/${eventId}`;

    // Get all user IDs from profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .not('id', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.log('No users found to notify');
      return new Response(
        JSON.stringify({ message: 'No users to notify', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create notifications for all users
    const notifications = profiles.map(profile => ({
      user_id: profile.id,
      title: `${artistName || 'Artist'} is now live!`,
      message: `${eventTitle} has started streaming. Watch now!`,
      type: 'live_event',
      event_id: eventId, // Include event_id if column exists (migration adds it)
      read: false,
      metadata: {
        eventId,
        eventTitle,
        artistName,
        watchUrl
      }
    }));

    // Insert notifications in batches to avoid overwhelming the database
    const batchSize = 100;
    let insertedCount = 0;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(batch);

      if (insertError) {
        console.error(`Error inserting notification batch ${i / batchSize + 1}:`, insertError);
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`✅ Created ${insertedCount} live event notifications`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: insertedCount,
        message: `Notifications sent to ${insertedCount} users` 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-live-event-notifications:', error);
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
