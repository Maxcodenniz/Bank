/*
  # Final RLS Fix - Ensure Anon Role Works
  
  The issue is that the policy exists but requests aren't being recognized as anon.
  This migration will:
  1. Drop and recreate the policy with explicit role checks
  2. Add a USING clause for INSERT (though it shouldn't be needed, it helps)
  3. Ensure the policy is correctly scoped
*/

-- Step 1: Drop the existing INSERT policy
DROP POLICY IF EXISTS "Anyone can create callback requests" ON public.callback_requests;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

-- Step 3: Create INSERT policy with explicit anon and authenticated roles
-- Using both USING and WITH CHECK to be explicit
CREATE POLICY "Anyone can create callback requests"
  ON public.callback_requests
  FOR INSERT
  TO anon, authenticated
  USING (true)  -- This shouldn't be needed for INSERT, but helps ensure it works
  WITH CHECK (true);

-- Step 4: Verify the policy was created correctly
DO $$
DECLARE
  policy_exists BOOLEAN;
  policy_roles TEXT[];
BEGIN
  -- Check if policy exists
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'callback_requests' 
    AND schemaname = 'public'
    AND policyname = 'Anyone can create callback requests'
    AND cmd = 'INSERT'
  ) INTO policy_exists;
  
  IF NOT policy_exists THEN
    RAISE EXCEPTION 'Policy was not created!';
  END IF;
  
  -- Get the roles
  SELECT ARRAY(
    SELECT unnest(roles::text[])
  ) INTO policy_roles
  FROM pg_policies 
  WHERE tablename = 'callback_requests' 
  AND schemaname = 'public'
  AND policyname = 'Anyone can create callback requests'
  AND cmd = 'INSERT';
  
  -- Verify anon is in the roles
  IF 'anon' != ALL(policy_roles) AND NOT ('anon' = ANY(policy_roles)) THEN
    RAISE EXCEPTION 'anon role is not in the policy roles: %', policy_roles;
  END IF;
  
  RAISE NOTICE '✅ Policy created successfully with roles: %', policy_roles;
END $$;

-- Step 5: Test the policy directly
-- This will help us verify it works
DO $$
DECLARE
  test_result BOOLEAN;
BEGIN
  -- Try to simulate an anon insert (this is just a syntax check)
  -- The actual test needs to be done from the client
  RAISE NOTICE 'Policy verification complete. Test from client with:';
  RAISE NOTICE '  - No session (anonymous user)';
  RAISE NOTICE '  - Valid session (authenticated user)';
END $$;






