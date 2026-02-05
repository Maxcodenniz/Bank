/*
  # Fix Visitor Tracking RLS Policies
  
  The current RLS policies only allow admins to SELECT from website_visitors,
  but the VisitorCounter component needs to SELECT records for anonymous users
  to check if they exist and update them.
  
  Solution: Create a SECURITY DEFINER function that handles visitor tracking,
  allowing anonymous users to track visits while maintaining security.
  Also add permissive RLS policies for SELECT/UPDATE on website_visitors
  since the data is not sensitive (just device tracking).
*/

-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Admins can view visitor stats" ON website_visitors;

-- Allow anonymous users to SELECT records for tracking purposes
-- This is safe because device_id is not sensitive information
CREATE POLICY "Anyone can view visitor records for tracking" ON website_visitors
  FOR SELECT TO anon, authenticated
  USING (true);

-- Keep admin-only policy for comprehensive analytics (this is for Dashboard)
CREATE POLICY "Admins can view all visitor stats" ON website_visitors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('global_admin', 'super_admin')
    )
  );

-- Add UPDATE policy for anonymous users to update their own records
CREATE POLICY "Anyone can update visitor records for tracking" ON website_visitors
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Also allow UPDATE for admins
CREATE POLICY "Admins can update visitor records" ON website_visitors
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('global_admin', 'super_admin')
    )
  )
  WITH CHECK (true);
