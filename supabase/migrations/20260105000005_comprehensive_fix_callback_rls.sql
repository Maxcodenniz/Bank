/*
  # Comprehensive Fix for Callback Requests RLS Policy
  
  This migration will:
  1. Drop ALL existing policies on callback_requests
  2. Ensure RLS is enabled
  3. Create a clean INSERT policy for anon and authenticated
  4. Verify the policy was created
*/

-- Step 1: Drop ALL existing policies (comprehensive cleanup)
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Get all policies on callback_requests table
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

-- Step 3: Create the INSERT policy for anonymous and authenticated users
CREATE POLICY "Anyone can create callback requests"
  ON public.callback_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Step 4: Ensure admin policies exist for SELECT and UPDATE
-- Drop existing admin policies first
DROP POLICY IF EXISTS "Only global admins can view callback requests" ON public.callback_requests;
DROP POLICY IF EXISTS "Only global admins can update callback requests" ON public.callback_requests;

-- Create admin SELECT policy
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

-- Create admin UPDATE policy
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

-- Step 5: Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'callback_requests' 
  AND schemaname = 'public';
  
  RAISE NOTICE 'Total policies on callback_requests: %', policy_count;
  
  -- Check if INSERT policy exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'callback_requests' 
    AND policyname = 'Anyone can create callback requests'
    AND schemaname = 'public'
    AND cmd = 'INSERT'
  ) THEN
    RAISE NOTICE '✅ INSERT policy "Anyone can create callback requests" exists';
  ELSE
    RAISE EXCEPTION '❌ INSERT policy was not created!';
  END IF;
END $$;







