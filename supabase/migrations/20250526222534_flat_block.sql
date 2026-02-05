/*
  # Add storage policies for advertisements
  
  1. Changes
    - Create advertisements folder in profiles bucket
    - Add policies for global admins to manage advertisement images
    
  2. Security
    - Only global admins can upload/modify advertisement images
    - Public read access for all advertisement images
*/

-- Create advertisements folder policy
CREATE POLICY "Global admins can manage advertisement images"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'advertisements' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
);

-- Allow public read access to advertisement images
CREATE POLICY "Public can view advertisement images"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'advertisements'
);