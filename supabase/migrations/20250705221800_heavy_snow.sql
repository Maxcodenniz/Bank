/*
  # Add Mux integration fields
  
  1. Changes
    - Add mux_stream_id to events table
    - Add mux_playback_id to events table
    - Add indexes for performance
    
  2. Notes
    - These fields store Mux-specific identifiers
    - Allows for proper stream management and playback
*/

-- Add Mux fields to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS mux_stream_id TEXT,
ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_mux_stream_id ON events(mux_stream_id);
CREATE INDEX IF NOT EXISTS idx_events_mux_playback_id ON events(mux_playback_id);

-- Add comments for documentation
COMMENT ON COLUMN events.mux_stream_id IS 'Mux stream identifier for RTMP ingestion';
COMMENT ON COLUMN events.mux_playback_id IS 'Mux playback identifier for HLS/video playback';