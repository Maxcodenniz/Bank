import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone_number, email, user_id, description } = await req.json();

    if (!phone_number || !email) {
      return new Response(
        JSON.stringify({ error: "Phone number and email are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate description - require at least 50 characters to reduce spam
    const trimmedDescription = description?.trim() || '';
    if (!trimmedDescription || trimmedDescription.length < 50) {
      return new Response(
        JSON.stringify({ error: "Please provide a detailed description of your request (at least 50 characters)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert the callback request (service role bypasses RLS)
    const { data, error } = await supabase
      .from('callback_requests')
      .insert([
        {
          phone_number,
          email,
          description: trimmedDescription,
          user_id: user_id || null
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Error inserting callback request:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call the notification function directly to send emails
    // This ensures emails are sent even if the database trigger isn't configured
    try {
      const notificationUrl = `${supabaseUrl}/functions/v1/send-callback-notification`;
      const notificationResponse = await fetch(notificationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          phone_number,
          email,
          user_id: user_id || null,
          request_id: data.id,
          description: trimmedDescription
        }),
      });

      if (!notificationResponse.ok) {
        const errorText = await notificationResponse.text();
        console.error('Failed to send notifications:', errorText);
        // Don't fail the request - the insert succeeded, just log the error
      } else {
        console.log('✅ Notifications sent successfully');
      }
    } catch (notificationError) {
      console.error('Error calling notification function:', notificationError);
      // Don't fail the request - the insert succeeded
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

