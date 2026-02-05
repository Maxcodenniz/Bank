-- Fix RLS policy to allow both 'fan' and 'artist' user types during profile creation
-- Drop the old policy that only allowed 'fan'
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new policy that allows both 'fan' and 'artist' user types
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id AND
    (user_type = 'fan' OR user_type = 'artist')
  );
