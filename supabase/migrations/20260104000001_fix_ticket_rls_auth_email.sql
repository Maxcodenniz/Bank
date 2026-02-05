-- Fix RLS policy to use auth.email() instead of querying auth.users table
-- This fixes the "permission denied for table users" error
-- Only fixes the authenticated user policy, leaves guest policy untouched

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Users view own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;

-- Recreate with correct auth.email() function
CREATE POLICY "Users view own tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin'))
    OR
    -- Allow if ticket email matches user's email (for cases where user_id is NULL or wasn't set correctly)
    -- This handles the case where a guest ticket was created with the same email, then user logged in
    (email IS NOT NULL AND email = auth.email())
  );

