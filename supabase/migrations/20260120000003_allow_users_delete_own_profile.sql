-- Allow users to delete their own profile
-- This enables the self-delete account functionality

-- Drop policy if it exists
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Create policy allowing users to delete their own profile
CREATE POLICY "Users can delete own profile"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = id AND
    -- Prevent deleting protected super admin
    id != 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid AND
    -- Prevent super admins from self-deleting (they should use admin tools)
    NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'super_admin'
    )
  );

COMMENT ON POLICY "Users can delete own profile" ON profiles IS 
  'Allows users to delete their own profile, except protected super admin and other super admins';
