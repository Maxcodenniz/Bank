/*
  # Add Help Content and Callback Requests Tables
  
  1. New Tables
    - help_content: Stores help documentation and guides
    - callback_requests: Tracks user callback requests
    
  2. Security
    - Enable RLS on all tables
    - Add policies for proper access control
    
  3. Changes
    - Create tables with proper constraints
    - Set up RLS policies
    - Add updated_at trigger for help_content
*/

-- Create help_content table
CREATE TABLE IF NOT EXISTS help_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  section TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create callback_requests table
CREATE TABLE IF NOT EXISTS callback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE help_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for help_content
CREATE POLICY "Help content is viewable by everyone"
  ON help_content FOR SELECT
  USING (true);

CREATE POLICY "Only global admins can manage help content"
  ON help_content FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

-- Create policies for callback_requests
CREATE POLICY "Users can create callback requests"
  ON callback_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Only global admins can view callback requests"
  ON callback_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

CREATE POLICY "Only global admins can update callback requests"
  ON callback_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

-- Create updated_at trigger for help_content
CREATE TRIGGER update_help_content_updated_at
  BEFORE UPDATE ON help_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();