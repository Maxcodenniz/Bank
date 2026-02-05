-- Fix RLS policy to allow super admin to promote users to super_admin role
-- The issue is that the WITH CHECK clause was too restrictive - it was preventing
-- super admins from promoting other users to super_admin

-- Drop the existing super admin policy
DROP POLICY IF EXISTS "Super admin can update any profile" ON profiles;

-- Recreate with corrected logic that allows promoting users to super_admin
CREATE POLICY "Super admin can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.user_type = 'super_admin'
        OR profiles.id = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.user_type = 'super_admin'
        OR profiles.id = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid
      )
    )
    AND (
      -- Only restriction: cannot change the protected super admin's (Dennis) role
      -- All other users can be updated to any role, including super_admin
      -- This allows promoting admins to super_admin
      CASE 
        WHEN id = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid THEN 
          user_type = 'super_admin'  -- Protected super admin must remain super_admin
        ELSE 
          true  -- All other users can be set to any role including super_admin
      END
    )
  );

COMMENT ON POLICY "Super admin can update any profile" ON profiles IS 
  'Allows super admin (by user_type or protected ID) to update any profile to any role including super_admin, except cannot change the protected super admin (Dennis) role';

