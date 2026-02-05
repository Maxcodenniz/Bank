/*
  # Remove admin user type
  
  1. Changes
    - Convert existing admin users to fans
    - Update user_type constraint to remove admin option
    - Update policies to use auth.uid() and remove admin checks
    
  2. Security
    - Transfer admin permissions to artists
    - Ensure proper RLS policy updates
*/

-- First convert any existing admin users to fans
UPDATE profiles 
SET user_type = 'fan' 
WHERE user_type = 'admin';

-- Drop the existing check constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Add the new check constraint without admin type
ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type = ANY (ARRAY['fan'::text, 'artist'::text]));

-- Update the events table policies to remove admin checks
DROP POLICY IF EXISTS "Artists can create events" ON events;
CREATE POLICY "Artists can create events" ON events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'::text
  )
  AND artist_id = auth.uid()
);

DROP POLICY IF EXISTS "Artists can delete own events" ON events;
CREATE POLICY "Artists can delete own events" ON events
FOR DELETE TO authenticated
USING (
  artist_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'::text
  )
);

DROP POLICY IF EXISTS "Artists can update own events" ON events;
CREATE POLICY "Artists can update own events" ON events
FOR UPDATE TO authenticated
USING (
  artist_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'::text
  )
)
WITH CHECK (
  artist_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'::text
  )
);

-- Update categories table policies to remove admin checks
DROP POLICY IF EXISTS "Admins can delete categories" ON categories;
CREATE POLICY "Only artists can delete categories" ON categories
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'::text
  )
);

DROP POLICY IF EXISTS "Admins can insert categories" ON categories;
CREATE POLICY "Only artists can insert categories" ON categories
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'::text
  )
);

DROP POLICY IF EXISTS "Admins can update categories" ON categories;
CREATE POLICY "Only artists can update categories" ON categories
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'artist'::text
  )
);