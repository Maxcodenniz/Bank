/*
  # Add Stream Status Cleanup Functions

  1. New Functions
    - `cleanup_stale_live_streams`: Automatically mark streams as ended if they have no active viewers for more than 10 minutes
    - `get_stream_health`: Check if a stream has active publishers

  2. Purpose
    - Prevent streams from showing as "live" when they have actually ended
    - Improve monitoring accuracy
    - Clean up stale stream statuses
*/

-- Function to cleanup stale live streams
CREATE OR REPLACE FUNCTION cleanup_stale_live_streams(stale_minutes INTEGER DEFAULT 10)
RETURNS TABLE (
  event_id UUID,
  event_title TEXT,
  last_activity TIMESTAMPTZ
) AS $$
BEGIN
  -- Find events marked as live but with no recent viewer activity
  RETURN QUERY
  WITH stale_events AS (
    SELECT 
      e.id,
      e.title,
      MAX(vs.last_seen) as last_viewer_activity
    FROM events e
    LEFT JOIN viewer_sessions vs ON vs.event_id = e.id AND vs.is_active = true
    WHERE e.status = 'live'
    GROUP BY e.id, e.title
    HAVING MAX(vs.last_seen) < NOW() - (stale_minutes || ' minutes')::INTERVAL
       OR MAX(vs.last_seen) IS NULL
  )
  UPDATE events
  SET 
    status = 'ended',
    viewer_count = 0
  WHERE id IN (SELECT id FROM stale_events)
  RETURNING 
    id as event_id,
    title as event_title,
    NOW() - (stale_minutes || ' minutes')::INTERVAL as last_activity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stream health status
CREATE OR REPLACE FUNCTION get_stream_health(event_uuid UUID)
RETURNS TABLE (
  is_healthy BOOLEAN,
  active_viewers INTEGER,
  last_activity TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) > 0 as is_healthy,
    COUNT(*)::INTEGER as active_viewers,
    MAX(vs.last_seen) as last_activity
  FROM viewer_sessions vs
  WHERE vs.event_id = event_uuid
    AND vs.is_active = true
    AND vs.last_seen > NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_stale_live_streams(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_stream_health(UUID) TO authenticated;
