/*
  # Add user management functionality
  
  1. Changes
    - Add email and phone fields to profiles
    - Add notification preference field
    - Update profile policies for admin access
    
  2. Security
    - Maintain RLS for proper access control
    - Allow admins to manage user profiles
*/

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS notification_preference TEXT DEFAULT 'email'
  CHECK (notification_preference IN ('email', 'phone'));

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Update profiles policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile or admins can update any profile"
ON profiles FOR UPDATE
USING (
  auth.uid() = id OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
);