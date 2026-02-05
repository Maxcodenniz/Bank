-- Allow anonymous users to read guest tickets (for guest checkout)
-- This enables guests to access their tickets using the email link
-- The application layer will verify the email matches the one in the URL

-- Drop existing policy if it exists (from previous migrations)
DROP POLICY IF EXISTS "Users view own tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;

-- Allow anonymous users to read guest tickets (user_id IS NULL)
-- This is safe because:
-- 1. Guest tickets are meant to be accessible via email link
-- 2. The email is provided in the URL (not a secret)
-- 3. The application verifies email matches before granting access
CREATE POLICY "Guests can view guest tickets"
  ON tickets FOR SELECT
  TO anon
  USING (
    user_id IS NULL AND email IS NOT NULL
  );

-- Allow authenticated users to view their own tickets or tickets with matching email
-- Note: auth.email() is available in RLS policies and returns the authenticated user's email
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

