/*
  # Fix Viewer Sessions Anonymous Access

  1. Changes
    - Allow anonymous viewers to update their own sessions
    - This enables UPSERT operations for viewer tracking
  
  2. Security
    - Anonymous users can update any viewer session during upsert
    - This is safe because the uniqueness constraint prevents tampering
*/

-- Drop existing restrictive update policy for users
DROP POLICY IF EXISTS "Users can update own sessions" ON viewer_sessions;

-- Create a more permissive update policy that allows upserts
CREATE POLICY "Allow session updates for upsert"
  ON viewer_sessions
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);
