/*
  # Update viewer count to count by user_id when available
  
  This migration updates the viewer count calculation to count distinct user_id values
  when available, falling back to device_id for anonymous viewers. This ensures that
  multiple logged-in users on the same device are counted separately.
  
  1. Changes
    - Update `update_event_viewer_count_from_sessions()` function to count by user_id
    - Update `get_active_viewer_count()` function to count by user_id
    - This allows multiple users on the same device to be counted separately
*/

-- Update the trigger function to count by user_id when available, device_id otherwise
CREATE OR REPLACE FUNCTION update_event_viewer_count_from_sessions()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  -- Count distinct user_id when available, otherwise count distinct device_id
  -- This ensures logged-in users on the same device are counted separately
  SELECT COUNT(DISTINCT COALESCE(user_id::text, device_id))
  INTO active_count
  FROM viewer_sessions
  WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    AND is_active = true
    AND last_seen > now() - interval '2 minutes';
  
  UPDATE events
  SET viewer_count = active_count
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the get_active_viewer_count function to match
CREATE OR REPLACE FUNCTION get_active_viewer_count(event_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT COALESCE(user_id::text, device_id))
    FROM viewer_sessions
    WHERE viewer_sessions.event_id = get_active_viewer_count.event_id
      AND is_active = true
      AND last_seen > now() - interval '2 minutes'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
