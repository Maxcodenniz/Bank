/*
  # Add global administrator role
  
  1. Changes
    - Add global_admin role to user_type check constraint
    - Add policies for global admins to manage other admins
    - Update existing policies to include global admin access
    
  2. Security
    - Only global admins can promote/demote other users to admin
    - Global admins have full access to all resources
*/

-- Drop existing check constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Add new check constraint with global_admin type
ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type = ANY (ARRAY['fan'::text, 'artist'::text, 'global_admin'::text]));

-- Update events policies to include global admin access
DROP POLICY IF EXISTS "Artists can create events" ON events;
CREATE POLICY "Artists and admins can create events" ON events
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'artist' OR profiles.user_type = 'global_admin')
  )
);

DROP POLICY IF EXISTS "Artists can update own events" ON events;
CREATE POLICY "Artists and admins can manage events" ON events
FOR UPDATE TO authenticated
USING (
  artist_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
)
WITH CHECK (
  artist_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
);

DROP POLICY IF EXISTS "Artists can delete own events" ON events;
CREATE POLICY "Artists and admins can delete events" ON events
FOR DELETE TO authenticated
USING (
  artist_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'global_admin'
  )
);

-- Update categories policies to include global admin access
DROP POLICY IF EXISTS "Only artists can delete categories" ON categories;
CREATE POLICY "Artists and admins can delete categories" ON categories
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'artist' OR profiles.user_type = 'global_admin')
  )
);

DROP POLICY IF EXISTS "Only artists can insert categories" ON categories;
CREATE POLICY "Artists and admins can insert categories" ON categories
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'artist' OR profiles.user_type = 'global_admin')
  )
);

DROP POLICY IF EXISTS "Only artists can update categories" ON categories;
CREATE POLICY "Artists and admins can update categories" ON categories
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.user_type = 'artist' OR profiles.user_type = 'global_admin')
  )
);

-- Create first global admin
UPDATE profiles
SET user_type = 'global_admin'
WHERE username = 'admin'
AND id IN (
  SELECT id FROM auth.users WHERE email = 'admin@dreemystar.com'
);