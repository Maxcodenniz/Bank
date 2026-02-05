import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getStoredDeviceId } from '../utils/deviceFingerprint';

export const useViewerTracking = (eventId: string, userId: string | null) => {
  const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
  const deviceId = getStoredDeviceId();

  useEffect(() => {
    if (!eventId) return;

    const trackViewer = async () => {
      try {
        const { error } = await supabase
          .from('live_viewers')
          .upsert({
            event_id: eventId,
            device_id: deviceId,
            user_id: userId,
            joined_at: new Date().toISOString(),
            last_seen: new Date().toISOString()
          }, {
            onConflict: 'event_id,device_id'
          });

        if (error) {
          console.error('Error tracking viewer:', error);
        }
      } catch (err) {
        console.error('Viewer tracking error:', err);
      }
    };

    const updateLastSeen = async () => {
      try {
        const { error } = await supabase
          .from('live_viewers')
          .update({ last_seen: new Date().toISOString() })
          .eq('event_id', eventId)
          .eq('device_id', deviceId);

        if (error) {
          console.error('Error updating last seen:', error);
        }
      } catch (err) {
        console.error('Last seen update error:', err);
      }
    };

    trackViewer();

    heartbeatInterval.current = setInterval(() => {
      updateLastSeen();
    }, 15000);

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }

      const removeViewer = async () => {
        try {
          await supabase
            .from('live_viewers')
            .delete()
            .eq('event_id', eventId)
            .eq('device_id', deviceId);
        } catch (err) {
          console.error('Error removing viewer:', err);
        }
      };

      removeViewer();
    };
  }, [eventId, deviceId, userId]);

  return { deviceId };
};
