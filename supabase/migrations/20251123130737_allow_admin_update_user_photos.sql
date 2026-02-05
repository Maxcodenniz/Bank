/*
  # Allow Admins to Update User Photos

  1. Changes
    - Add RLS policy allowing global admins to update any user's avatar_url and cover_url
    - This enables Super Admin and global admins to manage user profile/cover photos
  
  2. Security
    - Only users with user_type = 'global_admin' can update other users' photos
    - Regular users can still update their own photos via existing policies
*/

-- Allow global admins to update any user's profile (including avatar_url and cover_url)
CREATE POLICY "Global admins can update any user profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );
