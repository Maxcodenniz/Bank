/*
  # Add Livepeer integration fields
  
  1. Changes
    - Add livepeer_stream_id to events table
    - Add livepeer_playback_id to events table
    - Add indexes for performance
    
  2. Notes
    - These fields store Livepeer-specific identifiers
    - Allows for proper stream management and playback
*/

-- Add Livepeer fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS livepeer_stream_id TEXT,
ADD COLUMN IF NOT EXISTS livepeer_playback_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_livepeer_stream_id ON events(livepeer_stream_id);
CREATE INDEX IF NOT EXISTS idx_events_livepeer_playback_id ON events(livepeer_playback_id);

-- Add comments for documentation
COMMENT ON COLUMN events.livepeer_stream_id IS 'Livepeer stream identifier for RTMP ingestion';
COMMENT ON COLUMN events.livepeer_playback_id IS 'Livepeer playback identifier for HLS/video playback';