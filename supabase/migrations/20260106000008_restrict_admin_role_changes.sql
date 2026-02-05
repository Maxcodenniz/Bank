-- Restrict global_admin from changing other admins' roles
-- Only super_admin can change global_admin roles

-- Drop all existing update policies on profiles (drop all to avoid conflicts)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND cmd = 'UPDATE'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

-- Policy 1: Users can update their own profile (but not their own role unless they're super_admin)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent non-super-admins from changing their own role
    (user_type = (SELECT user_type FROM profiles WHERE id = auth.uid()) OR
     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin'))
  );

-- Policy 2: Global admins can only update fan and artist profiles
CREATE POLICY "Global admins can update fan and artist profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.user_type = 'global_admin'
    )
    AND (
      -- Target profile must be fan or artist
      EXISTS (
        SELECT 1 FROM profiles target
        WHERE target.id = profiles.id
        AND target.user_type IN ('fan', 'artist')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.user_type = 'global_admin'
    )
    AND (
      -- Can only set role to fan or artist (not admin)
      user_type IN ('fan', 'artist')
    )
  );

-- Policy 3: Super admin can update any profile (except super admin's role)
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
      -- Super admin cannot change super admin's role
      (id != 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid OR user_type = 'super_admin')
    )
  );

