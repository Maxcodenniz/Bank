-- Fix RLS policy to ensure admins can view ALL tickets including guest tickets
-- The policy should explicitly allow global_admin and super_admin to view all tickets

-- Drop ALL existing policies on tickets table to avoid conflicts
DROP POLICY IF EXISTS "Users view own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON tickets;
DROP POLICY IF EXISTS "Guests can view guest tickets" ON tickets;

-- Recreate the guest policy for anonymous users (if needed for guest checkout)
CREATE POLICY "Guests can view guest tickets"
  ON tickets FOR SELECT
  TO anon
  USING (
    user_id IS NULL AND email IS NOT NULL
  );

-- Recreate the authenticated user policy with explicit admin access for all user types
CREATE POLICY "Users view own tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own tickets
    user_id = auth.uid() 
    OR 
    -- Admins (all types) can view all tickets including guest tickets (user_id IS NULL)
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('admin', 'global_admin', 'super_admin')
    )
    OR
    -- Allow if ticket email matches user's email (for cases where user_id is NULL or wasn't set correctly)
    (email IS NOT NULL AND email = auth.email())
  );

-- Ensure the policy allows viewing guest tickets (user_id IS NULL) for admins
-- This is already covered by the admin check above, but we'll add a comment for clarity
COMMENT ON POLICY "Users view own tickets" ON tickets IS 
  'Allows users to view their own tickets, admins to view all tickets (including guest tickets), and users to view tickets matching their email';

