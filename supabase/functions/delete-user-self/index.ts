import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the requesting user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const userId = user.id;

    // Prevent deleting protected super admin
    const SUPER_ADMIN_ID = Deno.env.get('SUPER_ADMIN_ID') || 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8';
    if (userId === SUPER_ADMIN_ID) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete the protected super admin account' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check user type - prevent super admins from self-deleting (they should use admin tools)
    // Note: Profile might not exist if signup failed partially, so we handle that case
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', userId)
      .maybeSingle(); // Use maybeSingle() instead of single() to handle missing profiles

    // If profile exists and user is super_admin, prevent deletion
    if (profile && profile.user_type === 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Super admins should contact support to delete their account' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If profile doesn't exist, we'll still proceed with deletion (cleanup orphaned auth user)
    // This handles cases where signup partially failed

    // Delete all related data first (due to foreign key constraints)
    // Delete favorite_artists where user is the fan
    await supabaseAdmin.from('favorite_artists').delete().eq('user_id', userId);

    // Delete favorite_artists where user is the artist
    await supabaseAdmin.from('favorite_artists').delete().eq('artist_id', userId);

    // Delete tickets
    await supabaseAdmin.from('tickets').delete().eq('user_id', userId);

    // Delete events where user is the artist
    await supabaseAdmin.from('events').delete().eq('artist_id', userId);

    // Delete security violations
    await supabaseAdmin.from('security_violations').delete().eq('user_id', userId);

    // Delete stream access logs
    await supabaseAdmin.from('stream_access_logs').delete().eq('user_id', userId);

    // Delete user bans
    await supabaseAdmin.from('user_bans').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_bans').delete().eq('banned_by', userId);

    // Delete content protection logs
    await supabaseAdmin.from('content_protection_logs').delete().eq('user_id', userId);

    // Delete auth logs
    await supabaseAdmin.from('auth_logs').delete().eq('user_id', userId);

    // Delete notifications
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId);

    // artist_media has CASCADE so will be deleted automatically

    // Delete user profile (if it exists - might not exist if signup failed partially)
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    // Don't fail if profile doesn't exist - this is expected for orphaned auth users
    if (profileDeleteError && profileDeleteError.code !== 'PGRST116') {
      console.error('Error deleting profile:', profileDeleteError);
      // Continue with auth user deletion even if profile deletion fails
    }

    // Delete auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) {
      console.error('Error deleting auth user:', authDeleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user authentication' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});



