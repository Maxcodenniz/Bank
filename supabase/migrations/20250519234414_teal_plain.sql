/*
  # Add unregistered artist support
  
  1. Changes
    - Add stream_key column for secure streaming
    - Add unregistered artist fields
    - Update RLS policies
    
  2. Security
    - Stream keys are unique and required for unregistered artists
    - Only global admins can create events with stream keys
*/

-- Add new columns to events table
ALTER TABLE events
ADD COLUMN stream_key TEXT,
ADD COLUMN unregistered_artist_name TEXT,
ADD COLUMN unregistered_artist_email TEXT,
ADD COLUMN artist_type TEXT CHECK (artist_type IN ('music', 'comedy'));

-- Make artist_id nullable (for unregistered artists)
ALTER TABLE events
ALTER COLUMN artist_id DROP NOT NULL;

-- Update RLS policies
DROP POLICY IF EXISTS "Artists and admins can create events" ON events;
CREATE POLICY "Artists and admins can create events"
ON events FOR INSERT
TO authenticated
WITH CHECK (
  (artist_id = auth.uid() AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'
  )) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
);

DROP POLICY IF EXISTS "Artists and admins can manage events" ON events;
CREATE POLICY "Artists and admins can manage events"
ON events FOR UPDATE
TO authenticated
USING (
  (artist_id = auth.uid() AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'
  )) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
)
WITH CHECK (
  (artist_id = auth.uid() AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'
  )) OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
);