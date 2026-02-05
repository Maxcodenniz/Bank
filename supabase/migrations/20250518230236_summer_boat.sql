/*
  # Storage bucket and policies for profile avatars

  1. Creates a new storage bucket for profile avatars
  2. Sets up policies to control access:
    - Public read access for authenticated users
    - Upload/update/delete access for users managing their own avatars
*/

-- Create profiles bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the profiles bucket
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profiles');

CREATE POLICY "Avatar upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Avatar update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Avatar delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);