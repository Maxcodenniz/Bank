/*
  # Fix storage policies for event images
  
  1. Changes
    - Add proper storage policies for event images
    - Allow artists and admins to upload event images
    - Fix folder structure permissions
    
  2. Security
    - Maintain RLS for proper access control
    - Only allow authorized users to upload
*/

-- Create profiles bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

-- Remove any existing policies for the profiles bucket
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Allow artists to upload to own events folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to event images" ON storage.objects;

-- Create new policies

-- Public read access for all objects in the profiles bucket
CREATE POLICY "Public read access for profiles bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Avatar upload policy
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Avatar update policy
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Avatar delete policy
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Event image upload policy for artists and admins
CREATE POLICY "Artists and admins can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'events' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'artist' OR profiles.user_type = 'global_admin')
  )
);

-- Event image update policy for artists and admins
CREATE POLICY "Artists and admins can update event images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'events' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'artist' OR profiles.user_type = 'global_admin')
  )
);

-- Event image delete policy for artists and admins
CREATE POLICY "Artists and admins can delete event images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'events' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'artist' OR profiles.user_type = 'global_admin')
  )
);