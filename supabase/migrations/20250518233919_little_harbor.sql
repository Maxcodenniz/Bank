/*
  # Update RLS policies for events and storage

  1. Changes
    - Drop existing policies to avoid conflicts
    - Recreate events table policies for artists
    - Update storage policies for event images

  2. Security
    - Enable RLS on events table
    - Restrict event management to artists and admins
    - Allow public read access to event images
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Artists can create events" ON events;
DROP POLICY IF EXISTS "Artists can update own events" ON events;
DROP POLICY IF EXISTS "Artists can delete own events" ON events;

-- Events table policies
CREATE POLICY "Artists can create events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'artist' OR profiles.user_type = 'admin')
    )
    AND artist_id = auth.uid()
  );

CREATE POLICY "Artists can update own events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    artist_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'artist' OR profiles.user_type = 'admin')
    )
  )
  WITH CHECK (
    artist_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'artist' OR profiles.user_type = 'admin')
    )
  );

CREATE POLICY "Artists can delete own events"
  ON events
  FOR DELETE
  TO authenticated
  USING (
    artist_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'artist' OR profiles.user_type = 'admin')
    )
  );

-- Storage policies for profiles bucket
BEGIN;
  -- Remove any existing policies
  DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
  DROP POLICY IF EXISTS "Allow artists to upload to own events folder" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public read access to event images" ON storage.objects;

  -- Add new policies
  CREATE POLICY "Allow artists to upload to own events folder"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'profiles'
      AND (storage.foldername(name))[1] = 'events'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.user_type = 'artist' OR profiles.user_type = 'admin')
      )
    );

  CREATE POLICY "Allow public read access to event images"
    ON storage.objects
    FOR SELECT
    TO public
    USING (
      bucket_id = 'profiles'
      AND (storage.foldername(name))[1] = 'events'
    );
COMMIT;