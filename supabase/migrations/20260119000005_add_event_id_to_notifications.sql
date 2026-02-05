-- Add event_id column to notifications table if it doesn't exist
-- This allows notifications to be linked to specific events

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'event_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);
  END IF;
END $$;
