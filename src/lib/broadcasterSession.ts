import { supabase } from './supabaseClient';

export async function registerBroadcasterSession(eventId: string, broadcasterId: string): Promise<string | null> {
  try {
    console.log('🔵 Registering broadcaster session:', { eventId, broadcasterId });

    if (!eventId || !broadcasterId) {
      console.error('❌ Missing eventId or broadcasterId');
      return null;
    }

    const { data, error } = await supabase.rpc('register_broadcaster_session', {
      event_uuid: eventId,
      broadcaster_uuid: broadcasterId
    });

    if (error) {
      console.error('❌ Error registering broadcaster session:', error);
      return null;
    }

    console.log('✅ Broadcaster session registered:', data);
    return data;
  } catch (err) {
    console.error('❌ Failed to register broadcaster session:', err);
    return null;
  }
}

export async function updateBroadcasterHeartbeat(eventId: string, broadcasterId: string): Promise<boolean> {
  try {
    console.log('💓 Updating broadcaster heartbeat:', { eventId, broadcasterId });

    const { data, error } = await supabase.rpc('update_broadcaster_heartbeat', {
      event_uuid: eventId,
      broadcaster_uuid: broadcasterId
    });

    if (error) {
      console.error('❌ Error updating broadcaster heartbeat:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('❌ Failed to update broadcaster heartbeat:', err);
    return false;
  }
}

export async function removeBroadcasterSession(eventId: string, broadcasterId: string): Promise<boolean> {
  try {
    console.log('🔴 Removing broadcaster session:', { eventId, broadcasterId });

    const { data, error } = await supabase.rpc('remove_broadcaster_session', {
      event_uuid: eventId,
      broadcaster_uuid: broadcasterId
    });

    if (error) {
      console.error('❌ Error removing broadcaster session:', error);
      return false;
    }

    console.log('✅ Broadcaster session removed');
    return data === true;
  } catch (err) {
    console.error('❌ Failed to remove broadcaster session:', err);
    return false;
  }
}

export function startBroadcasterHeartbeat(
  eventId: string,
  broadcasterId: string,
  intervalMs: number = 30000
): NodeJS.Timeout {
  const heartbeatInterval = setInterval(() => {
    updateBroadcasterHeartbeat(eventId, broadcasterId);
  }, intervalMs);

  return heartbeatInterval;
}
