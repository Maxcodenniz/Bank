-- Create RPC function to trigger live event notifications and emails
-- This function will be called from the client when an event goes live
-- It will then call the edge functions to send notifications and emails

CREATE OR REPLACE FUNCTION trigger_live_event_notifications(event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_record RECORD;
  artist_name TEXT;
  result JSONB := '{}'::jsonb;
BEGIN
  -- Get event details
  SELECT 
    e.id,
    e.title,
    e.artist_id,
    COALESCE(p.full_name, p.username, 'Artist') as artist_name
  INTO event_record
  FROM events e
  LEFT JOIN profiles p ON e.artist_id = p.id
  WHERE e.id = event_id AND e.status = 'live';

  -- If event not found or not live, return
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Event not found or not live');
  END IF;

  artist_name := event_record.artist_name;

  -- The actual HTTP calls to edge functions will be made by the client
  -- This function just returns the event data needed for the notifications
  -- The client will then call the edge functions with this data
  
  RETURN jsonb_build_object(
    'success', true,
    'eventId', event_record.id,
    'eventTitle', event_record.title,
    'artistName', artist_name
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION trigger_live_event_notifications(UUID) TO authenticated;
