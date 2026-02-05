/*
  # Comprehensive RLS Fix - Ensure Anon Requests Work
  
  This migration will:
  1. Drop ALL policies to start fresh
  2. Create a simple, explicit INSERT policy
  3. Verify no conflicts exist
  4. Test the policy structure
*/

-- Step 1: Drop ALL existing policies (complete cleanup)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, policyname 
    FROM pg_policies 
    WHERE tablename = 'callback_requests'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.callback_requests', 
      r.policyname, r.schemaname);
    RAISE NOTICE 'Dropped policy: % on %.callback_requests', r.policyname, r.schemaname;
  END LOOP;
END $$;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

-- Step 3: Create the simplest possible INSERT policy
-- This should work for both anon and authenticated
CREATE POLICY "Allow all inserts to callback_requests"
  ON public.callback_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Step 4: Create SELECT policy for admins
CREATE POLICY "Admins can view callback requests"
  ON public.callback_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

-- Step 5: Create UPDATE policy for admins
CREATE POLICY "Admins can update callback requests"
  ON public.callback_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

-- Step 6: Verify the INSERT policy
DO $$
DECLARE
  policy_count INTEGER;
  policy_info RECORD;
BEGIN
  -- Count INSERT policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'callback_requests' 
  AND schemaname = 'public'
  AND cmd = 'INSERT';
  
  IF policy_count = 0 THEN
    RAISE EXCEPTION 'No INSERT policy found!';
  END IF;
  
  IF policy_count > 1 THEN
    RAISE WARNING 'Multiple INSERT policies found: %', policy_count;
  END IF;
  
  -- Show policy details
  RAISE NOTICE 'INSERT Policy Details:';
  FOR policy_info IN
    SELECT policyname, cmd, roles::text, qual, with_check
    FROM pg_policies 
    WHERE tablename = 'callback_requests' 
    AND schemaname = 'public'
    AND cmd = 'INSERT'
  LOOP
    RAISE NOTICE '  Policy: %', policy_info.policyname;
    RAISE NOTICE '  Roles: %', policy_info.roles;
    RAISE NOTICE '  WITH CHECK: %', policy_info.with_check;
  END LOOP;
  
  RAISE NOTICE '✅ Policy verification complete';
END $$;






