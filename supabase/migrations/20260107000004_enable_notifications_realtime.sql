-- Enable real-time replication for notifications table
-- This allows clients to subscribe to notification changes
DO $$
BEGIN
  -- Check if the publication exists and add the table if it does
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Check if table is already in publication
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
  END IF;
END $$;

-- Create a function to insert notifications with elevated privileges
-- This allows the system to create notifications for any user
CREATE OR REPLACE FUNCTION insert_notification_for_user(
  target_user_id UUID,
  notification_title TEXT,
  notification_message TEXT,
  notification_type TEXT DEFAULT 'info',
  notification_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    metadata,
    read,
    created_at
  )
  VALUES (
    target_user_id,
    notification_title,
    notification_message,
    notification_type,
    notification_metadata,
    false,
    NOW()
  )
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_notification_for_user TO authenticated;

-- Update the RLS policy to allow system to insert notifications via the function
-- The function runs with SECURITY DEFINER, so it bypasses RLS

