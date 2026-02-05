/*
  # Add Admin Profile Delete Policy

  1. Changes
    - Add RLS policy allowing global admins to delete other users' profiles
    - This enables the user management page to delete users
  
  2. Security
    - Only users with user_type = 'global_admin' can delete profiles
    - Admins cannot delete their own profile (enforced in application)
*/

-- Allow global admins to delete profiles
CREATE POLICY "Global admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );
