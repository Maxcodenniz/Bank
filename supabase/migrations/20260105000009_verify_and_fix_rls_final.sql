/*
  # Final Fix: Verify and Ensure RLS Policy Works for Both Anon and Authenticated
  
  This migration will:
  1. Check existing policies
  2. Drop ALL policies and recreate them cleanly
  3. Ensure both anon and authenticated roles can INSERT
*/

-- Step 1: Drop ALL existing policies (comprehensive cleanup)
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

-- Step 3: Create INSERT policy for BOTH anon and authenticated
-- This is the critical policy - it must allow both roles
CREATE POLICY "Anyone can create callback requests"
  ON public.callback_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Step 4: Create SELECT policy for admins only
DROP POLICY IF EXISTS "Only global admins can view callback requests" ON public.callback_requests;
CREATE POLICY "Only global admins can view callback requests"
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

-- Step 5: Create UPDATE policy for admins only
DROP POLICY IF EXISTS "Only global admins can update callback requests" ON public.callback_requests;
CREATE POLICY "Only global admins can update callback requests"
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

-- Step 6: Verify the policies
DO $$
DECLARE
  insert_policy_count INTEGER;
  policy_details RECORD;
BEGIN
  -- Check INSERT policy
  SELECT COUNT(*) INTO insert_policy_count
  FROM pg_policies 
  WHERE tablename = 'callback_requests' 
  AND schemaname = 'public'
  AND cmd = 'INSERT'
  AND policyname = 'Anyone can create callback requests';
  
  IF insert_policy_count = 0 THEN
    RAISE EXCEPTION '❌ INSERT policy was not created!';
  END IF;
  
  -- Show all policies
  RAISE NOTICE '✅ Policies on callback_requests:';
  FOR policy_details IN
    SELECT policyname, cmd, roles::text
    FROM pg_policies 
    WHERE tablename = 'callback_requests' 
    AND schemaname = 'public'
    ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE '  - %: % (roles: %)', 
      policy_details.policyname, 
      policy_details.cmd, 
      policy_details.roles;
  END LOOP;
END $$;






