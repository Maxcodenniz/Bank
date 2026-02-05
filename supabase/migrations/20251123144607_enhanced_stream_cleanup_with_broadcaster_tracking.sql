/*
  # Enhanced Stream Cleanup with Broadcaster Tracking

  1. New Tables
    - `broadcaster_sessions`: Track when broadcasters are actively streaming

  2. New Functions
    - `cleanup_stale_live_streams_v2`: Enhanced cleanup that checks for broadcaster presence
    - `register_broadcaster_session`: Register when a broadcaster starts streaming
    - `remove_broadcaster_session`: Clean up broadcaster session when they stop

  3. Purpose
    - Automatically mark streams as ended when broadcaster disconnects
    - Prevent "live" streams with no active broadcaster
    - More accurate stream status tracking
*/

-- Create broadcaster sessions table
CREATE TABLE IF NOT EXISTS broadcaster_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  broadcaster_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(event_id, broadcaster_id)
);

-- Enable RLS
ALTER TABLE broadcaster_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for broadcaster_sessions
CREATE POLICY "Broadcasters can insert own sessions"
  ON broadcaster_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = broadcaster_id);

CREATE POLICY "Broadcasters can update own sessions"
  ON broadcaster_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = broadcaster_id)
  WITH CHECK (auth.uid() = broadcaster_id);

CREATE POLICY "Everyone can view active broadcaster sessions"
  ON broadcaster_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can delete any broadcaster session"
  ON broadcaster_sessions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('global_admin', 'super_admin')
    )
  );

-- Enhanced cleanup function
CREATE OR REPLACE FUNCTION cleanup_stale_live_streams_v2(
  stale_minutes INTEGER DEFAULT 5,
  broadcaster_timeout_minutes INTEGER DEFAULT 3
)
RETURNS TABLE (
  event_id UUID,
  event_title TEXT,
  reason TEXT
) AS $$
BEGIN
  -- Mark streams as ended if:
  -- 1. No active broadcaster session, OR
  -- 2. Broadcaster session heartbeat is stale
  RETURN QUERY
  WITH stale_streams AS (
    SELECT 
      e.id,
      e.title,
      bs.last_heartbeat,
      bs.is_active,
      CASE
        WHEN bs.id IS NULL THEN 'No broadcaster session'
        WHEN NOT bs.is_active THEN 'Broadcaster marked inactive'
        WHEN bs.last_heartbeat < NOW() - (broadcaster_timeout_minutes || ' minutes')::INTERVAL THEN 'Broadcaster heartbeat timeout'
        ELSE NULL
      END as end_reason
    FROM events e
    LEFT JOIN broadcaster_sessions bs ON bs.event_id = e.id AND bs.is_active = true
    WHERE e.status = 'live'
      AND (
        bs.id IS NULL 
        OR NOT bs.is_active
        OR bs.last_heartbeat < NOW() - (broadcaster_timeout_minutes || ' minutes')::INTERVAL
      )
  )
  UPDATE events
  SET 
    status = 'ended',
    viewer_count = 0,
    updated_at = NOW()
  WHERE id IN (SELECT id FROM stale_streams WHERE end_reason IS NOT NULL)
  RETURNING 
    id as event_id,
    title as event_title,
    (SELECT end_reason FROM stale_streams WHERE stale_streams.id = events.id) as reason;
    
  -- Also cleanup stale broadcaster sessions
  DELETE FROM broadcaster_sessions
  WHERE is_active = false
    OR last_heartbeat < NOW() - (broadcaster_timeout_minutes + 10 || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to register broadcaster session
CREATE OR REPLACE FUNCTION register_broadcaster_session(
  event_uuid UUID,
  broadcaster_uuid UUID
)
RETURNS UUID AS $$
DECLARE
  session_id UUID;
BEGIN
  -- Insert or update broadcaster session
  INSERT INTO broadcaster_sessions (
    event_id,
    broadcaster_id,
    started_at,
    last_heartbeat,
    is_active
  ) VALUES (
    event_uuid,
    broadcaster_uuid,
    NOW(),
    NOW(),
    true
  )
  ON CONFLICT (event_id, broadcaster_id)
  DO UPDATE SET
    last_heartbeat = NOW(),
    is_active = true,
    started_at = CASE 
      WHEN broadcaster_sessions.is_active = false THEN NOW()
      ELSE broadcaster_sessions.started_at
    END
  RETURNING id INTO session_id;
  
  -- Also ensure event is marked as live
  UPDATE events
  SET status = 'live', updated_at = NOW()
  WHERE id = event_uuid AND status != 'live';
  
  RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update broadcaster heartbeat
CREATE OR REPLACE FUNCTION update_broadcaster_heartbeat(
  event_uuid UUID,
  broadcaster_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE broadcaster_sessions
  SET last_heartbeat = NOW()
  WHERE event_id = event_uuid
    AND broadcaster_id = broadcaster_uuid
    AND is_active = true;
    
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove broadcaster session
CREATE OR REPLACE FUNCTION remove_broadcaster_session(
  event_uuid UUID,
  broadcaster_uuid UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Mark session as inactive
  UPDATE broadcaster_sessions
  SET 
    is_active = false,
    last_heartbeat = NOW()
  WHERE event_id = event_uuid
    AND broadcaster_id = broadcaster_uuid;
  
  -- Mark event as ended
  UPDATE events
  SET 
    status = 'ended',
    viewer_count = 0,
    updated_at = NOW()
  WHERE id = event_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON broadcaster_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_live_streams_v2(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION register_broadcaster_session(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_broadcaster_heartbeat(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_broadcaster_session(UUID, UUID) TO authenticated;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_broadcaster_sessions_event_active 
  ON broadcaster_sessions(event_id, is_active);
CREATE INDEX IF NOT EXISTS idx_broadcaster_sessions_heartbeat 
  ON broadcaster_sessions(last_heartbeat) WHERE is_active = true;
