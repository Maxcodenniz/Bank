-- Create trigger to send notifications and emails when event goes live
-- This trigger fires when an event's status changes to 'live'

-- First, create a function that will be called by the trigger
CREATE OR REPLACE FUNCTION notify_live_event_start()
RETURNS TRIGGER AS $$
DECLARE
  event_title TEXT;
  artist_name TEXT;
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only proceed if status changed to 'live'
  IF NEW.status = 'live' AND (OLD.status IS NULL OR OLD.status != 'live') THEN
    -- Get event and artist details
    SELECT 
      e.title,
      COALESCE(p.full_name, p.username, 'Artist') as artist_name
    INTO event_title, artist_name
    FROM events e
    LEFT JOIN profiles p ON e.artist_id = p.id
    WHERE e.id = NEW.id;

    -- Get Supabase URL and service key from secrets (stored in app_config)
    SELECT value::text INTO supabase_url
    FROM app_config
    WHERE key = 'supabase_url'
    LIMIT 1;

    -- If supabase_url not in config, use default from environment
    IF supabase_url IS NULL THEN
      supabase_url := current_setting('app.supabase_url', true);
    END IF;

    -- Get service key from secrets (this should be set via Supabase dashboard)
    service_key := current_setting('app.service_role_key', true);

    -- Call notification function via HTTP (requires pg_net extension)
    -- Note: This requires the pg_net extension to be enabled
    -- If pg_net is not available, we'll use a different approach
    
    -- For now, we'll use Supabase Edge Functions which can be called via HTTP
    -- The actual HTTP call will be made by a separate edge function or webhook
    
    -- Log the event for processing
    RAISE NOTICE 'Event % went live: % by %', NEW.id, event_title, artist_name;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_event_goes_live ON events;

CREATE TRIGGER on_event_goes_live
  AFTER UPDATE OF status ON events
  FOR EACH ROW
  WHEN (NEW.status = 'live' AND (OLD.status IS NULL OR OLD.status != 'live'))
  EXECUTE FUNCTION notify_live_event_start();

-- Note: The actual HTTP calls to edge functions will be handled by
-- a webhook or scheduled function that processes events marked as live
-- For immediate processing, we can use Supabase Edge Functions with HTTP calls
