/*
  # Allow Anonymous Users to Request Callbacks
  
  1. Changes
    - Add user_id column to callback_requests (nullable) if it doesn't exist
    - Update RLS policy to allow anonymous users to create callback requests
    - Keep existing admin policies intact
    
  2. Security
    - Anonymous users can only INSERT (create requests)
    - Authenticated users can INSERT with their user_id
    - Only global admins can SELECT and UPDATE
*/

-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'callback_requests' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE callback_requests 
    ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Make user_id nullable (in case it was added as NOT NULL)
ALTER TABLE callback_requests 
  ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can create callback requests" ON callback_requests;
DROP POLICY IF EXISTS "Anyone can create callback requests" ON callback_requests;

-- Create new policy allowing both anonymous and authenticated users to insert
CREATE POLICY "Anyone can create callback requests"
  ON callback_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);








