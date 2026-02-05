/*
  # Add admin delete policy for auth users
  
  1. Changes
    - Add policy allowing global admins to delete auth users
    - Update RLS policies for better admin control
    
  2. Security
    - Only global admins can delete users
    - Maintains existing RLS enabled status
*/

-- Add policy for global admins to delete auth users
CREATE POLICY "Global admins can delete users"
ON auth.users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
);