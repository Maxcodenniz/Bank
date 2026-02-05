/*
  # Fix Callback Requests RLS Policy
  
  1. Changes
    - Ensure the insert policy allows both anonymous and authenticated users
    - Drop all conflicting policies and recreate the correct one
*/

-- Drop all existing insert policies (handle both schema variations)
DROP POLICY IF EXISTS "Users can create callback requests" ON callback_requests;
DROP POLICY IF EXISTS "Anyone can create callback requests" ON callback_requests;
DROP POLICY IF EXISTS "Users can create callback requests" ON public.callback_requests;
DROP POLICY IF EXISTS "Anyone can create callback requests" ON public.callback_requests;

-- Ensure RLS is enabled
ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

-- Create the correct policy allowing both anonymous and authenticated users
-- Use public schema explicitly (standard in Supabase)
CREATE POLICY "Anyone can create callback requests"
  ON public.callback_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Verify the policy was created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'callback_requests' 
    AND policyname = 'Anyone can create callback requests'
    AND schemaname = 'public'
  ) THEN
    RAISE NOTICE '✅ Policy "Anyone can create callback requests" exists and is active';
  ELSE
    RAISE EXCEPTION '❌ Policy was not created successfully';
  END IF;
END $$;

