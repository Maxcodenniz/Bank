/*
  # Create recordings table for live stream recordings
  
  1. New Table
    - recordings: Stores metadata for recorded live streams
    - Links to events and artists
    - Stores video URL, duration, file size, etc.
    
  2. Security
    - Enable RLS
    - Public can read recordings
    - Artists can insert their own recordings
    - Admins can manage all recordings
*/

-- Create recordings table
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER, -- Duration in seconds
  file_size BIGINT, -- File size in bytes
  recording_started_at TIMESTAMPTZ,
  recording_ended_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('recording', 'processing', 'completed', 'failed')) DEFAULT 'recording',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_recordings_event_id ON recordings(event_id);
CREATE INDEX IF NOT EXISTS idx_recordings_artist_id ON recordings(artist_id);
CREATE INDEX IF NOT EXISTS idx_recordings_status ON recordings(status);
CREATE INDEX IF NOT EXISTS idx_recordings_created_at ON recordings(created_at DESC);

-- Enable RLS
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- Policy: Public can read recordings
CREATE POLICY "Public can read recordings"
  ON recordings FOR SELECT
  USING (true);

-- Policy: Artists can insert their own recordings
CREATE POLICY "Artists can insert own recordings"
  ON recordings FOR INSERT
  WITH CHECK (
    auth.uid() = artist_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type = 'artist'
    )
  );

-- Policy: Artists can update their own recordings
CREATE POLICY "Artists can update own recordings"
  ON recordings FOR UPDATE
  USING (
    auth.uid() = artist_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type = 'artist'
    )
  );

-- Policy: Admins can manage all recordings
CREATE POLICY "Admins can manage all recordings"
  ON recordings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type IN ('global_admin', 'super_admin')
    )
  );

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_recordings_updated_at
  BEFORE UPDATE ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION update_recordings_updated_at();





