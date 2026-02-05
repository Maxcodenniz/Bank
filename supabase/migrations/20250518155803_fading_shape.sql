/*
  # Fix profiles RLS policies

  1. Changes
    - Drop existing insert policy
    - Create new insert policy that allows users to create their own profile
    - Ensure policy checks that the profile ID matches the authenticated user's ID

  2. Security
    - Maintains existing RLS enabled status
    - Updates insert policy to properly check auth.uid()
*/

-- Drop the existing insert policy if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    DROP POLICY "Users can insert own profile" ON public.profiles;
  END IF;
END $$;

-- Create new insert policy with proper auth check
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() = id);