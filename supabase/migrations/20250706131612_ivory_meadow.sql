/*
  # Add Mux streaming fields to events table
  
  1. Changes
    - Add mux_stream_id column to events table
    - Add mux_playback_id column to events table
    - Create indexes for efficient querying
    
  2. Notes
    - These fields store Mux-specific identifiers
    - Allows for proper stream management and playback
*/

-- Add Mux fields to events table if they don't exist
DO $$
BEGIN
  -- Add mux_stream_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'mux_stream_id'
  ) THEN
    ALTER TABLE events ADD COLUMN mux_stream_id TEXT;
  END IF;

  -- Add mux_playback_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'mux_playback_id'
  ) THEN
    ALTER TABLE events ADD COLUMN mux_playback_id TEXT;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_mux_stream_id ON events(mux_stream_id);
CREATE INDEX IF NOT EXISTS idx_events_mux_playback_id ON events(mux_playback_id);

-- Add comments for documentation
COMMENT ON COLUMN events.mux_stream_id IS 'Mux stream identifier for RTMP ingestion';
COMMENT ON COLUMN events.mux_playback_id IS 'Mux playback identifier for HLS/video playback';