import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000);
    const sixteenMinutesLater = new Date(now.getTime() + 16 * 60 * 1000);

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, start_time')
      .eq('status', 'upcoming')
      .gte('start_time', fifteenMinutesLater.toISOString())
      .lt('start_time', sixteenMinutesLater.toISOString());

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No events starting in 15 minutes' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let notificationsSent = 0;

    for (const event of events) {
      const { data: tickets, error: ticketsError } = await supabase
        .from('tickets')
        .select('user_id')
        .eq('event_id', event.id)
        .eq('status', 'active');

      if (ticketsError) {
        console.error(`Error fetching tickets for event ${event.id}:`, ticketsError);
        continue;
      }

      if (!tickets || tickets.length === 0) continue;

      const userIds = [...new Set(tickets.map(t => t.user_id))];

      for (const userId of userIds) {
        const { data: existingNotif } = await supabase
          .from('notifications')
          .select('id')
          .eq('event_id', event.id)
          .eq('user_id', userId)
          .eq('type', 'event_starting')
          .maybeSingle();

        if (existingNotif) continue;

        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            event_id: event.id,
            type: 'event_starting',
            title: 'Event Starting Soon!',
            message: `${event.title} starts in 15 minutes. Get ready!`,
            read: false,
            sent: true
          });

        if (!notifError) notificationsSent++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        eventsProcessed: events.length,
        notificationsSent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notification cron:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});