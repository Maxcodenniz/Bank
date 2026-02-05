-- Allow service role to insert notifications for live event notifications
-- This is needed for the send-live-event-notifications edge function

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;

-- Create new policy that allows service role and admins to insert
CREATE POLICY "Service role and admins can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (
    -- Service role can always insert
    auth.role() = 'service_role'
    OR
    -- Admins can insert
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('global_admin', 'super_admin')
    )
  );
