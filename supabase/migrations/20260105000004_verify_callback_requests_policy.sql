/*
  # Verify Callback Requests RLS Policy
  
  This migration verifies and ensures the policy is correctly set up.
  It will show any existing policies and recreate if needed.
*/

-- First, let's see what policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'callback_requests';

-- Ensure the policy exists and is correct
DO $$
BEGIN
  -- Check if policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'callback_requests' 
    AND policyname = 'Anyone can create callback requests'
    AND schemaname = 'public'
  ) THEN
    -- Create the policy if it doesn't exist
    CREATE POLICY "Anyone can create callback requests"
      ON public.callback_requests
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
    
    RAISE NOTICE 'Policy created successfully';
  ELSE
    RAISE NOTICE 'Policy already exists';
  END IF;
END $$;







