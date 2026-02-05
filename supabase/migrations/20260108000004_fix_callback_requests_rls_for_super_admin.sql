/*
  # Fix Callback Requests RLS Policy for Super Admins
  
  1. Changes
    - Update SELECT policy to allow both global_admin and super_admin
    - Update UPDATE policy to allow both global_admin and super_admin
    - Ensure description column is accessible
*/

-- Step 1: Drop existing admin policies
DROP POLICY IF EXISTS "Only global admins can view callback requests" ON public.callback_requests;
DROP POLICY IF EXISTS "Only global admins can update callback requests" ON public.callback_requests;
DROP POLICY IF EXISTS "Admins can view callback requests" ON public.callback_requests;
DROP POLICY IF EXISTS "Admins can update callback requests" ON public.callback_requests;

-- Step 2: Create SELECT policy for both global_admin and super_admin
CREATE POLICY "Admins can view callback requests"
  ON public.callback_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'global_admin' OR profiles.user_type = 'super_admin')
    )
  );

-- Step 3: Create UPDATE policy for both global_admin and super_admin
CREATE POLICY "Admins can update callback requests"
  ON public.callback_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'global_admin' OR profiles.user_type = 'super_admin')
    )
  );

-- Step 4: Verify policies were created
DO $$
DECLARE
  select_policy_count INTEGER;
  update_policy_count INTEGER;
BEGIN
  -- Check SELECT policy
  SELECT COUNT(*) INTO select_policy_count
  FROM pg_policies
  WHERE tablename = 'callback_requests'
  AND policyname = 'Admins can view callback requests'
  AND schemaname = 'public';
  
  -- Check UPDATE policy
  SELECT COUNT(*) INTO update_policy_count
  FROM pg_policies
  WHERE tablename = 'callback_requests'
  AND policyname = 'Admins can update callback requests'
  AND schemaname = 'public';
  
  IF select_policy_count = 1 AND update_policy_count = 1 THEN
    RAISE NOTICE '✅ Policies created successfully';
  ELSE
    RAISE EXCEPTION '❌ Failed to create policies. SELECT: %, UPDATE: %', select_policy_count, update_policy_count;
  END IF;
END $$;



