/*
  # Add storage policies for cover photos
  
  1. Changes
    - Add policies for users to manage their own cover photos in profiles bucket
    - Allow upload, update, and delete operations for covers folder
    
  2. Security
    - Users can only manage their own cover photos
    - Path must match covers/{user_id}/ pattern
*/

-- Add policy for cover photo uploads
CREATE POLICY "Users can upload their own cover photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'covers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Add policy for cover photo updates
CREATE POLICY "Users can update their own cover photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'covers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Add policy for cover photo deletions
CREATE POLICY "Users can delete their own cover photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'covers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Add cover_url column to profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN cover_url TEXT;
  END IF;
END $$;