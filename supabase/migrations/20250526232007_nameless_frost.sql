/*
  # Fix callback requests table

  1. Changes
    - Ensure callback_requests table exists in public schema
    - Add proper constraints and indexes
    - Enable RLS with appropriate policies
    
  2. Security
    - Enable RLS on callback_requests table
    - Add policy for authenticated users to create requests
    - Add policy for admins to view and manage requests
*/

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.callback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  status text DEFAULT 'pending'::text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create callback requests" ON public.callback_requests;
DROP POLICY IF EXISTS "Only global admins can view callback requests" ON public.callback_requests;
DROP POLICY IF EXISTS "Only global admins can update callback requests" ON public.callback_requests;

-- Create policies
CREATE POLICY "Users can create callback requests"
  ON public.callback_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

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

-- Add status constraint if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.callback_requests 
    ADD CONSTRAINT callback_requests_status_check 
    CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;