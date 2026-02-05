/*
  # Fix missing Livepeer columns in events table
  
  1. Changes
    - Add livepeer_stream_id to events table if not exists
    - Add livepeer_playback_id to events table if not exists
    - Add indexes for performance
    
  2. Notes
    - These fields store Livepeer-specific identifiers
    - Allows for proper stream management and playback
    - Uses IF NOT EXISTS to prevent errors if columns already exist
*/

-- Add Livepeer fields to events table (safe operation)
DO $$
BEGIN
  -- Add livepeer_stream_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'livepeer_stream_id'
  ) THEN
    ALTER TABLE events ADD COLUMN livepeer_stream_id TEXT;
  END IF;

  -- Add livepeer_playback_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'livepeer_playback_id'
  ) THEN
    ALTER TABLE events ADD COLUMN livepeer_playback_id TEXT;
  END IF;
END $$;

-- Add indexes for better performance (safe operation)
CREATE INDEX IF NOT EXISTS idx_events_livepeer_stream_id ON events(livepeer_stream_id);
CREATE INDEX IF NOT EXISTS idx_events_livepeer_playback_id ON events(livepeer_playback_id);

-- Add comments for documentation
COMMENT ON COLUMN events.livepeer_stream_id IS 'Livepeer stream identifier for RTMP ingestion';
COMMENT ON COLUMN events.livepeer_playback_id IS 'Livepeer playback identifier for HLS/video playback';