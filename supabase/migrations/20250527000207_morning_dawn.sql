-- Create callback_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS callback_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE callback_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Only global admins can view callback requests" ON callback_requests;
DROP POLICY IF EXISTS "Only global admins can update callback requests" ON callback_requests;
DROP POLICY IF EXISTS "Users can create callback requests" ON callback_requests;

-- Create policies
CREATE POLICY "Only global admins can view callback requests"
  ON callback_requests
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
  ON callback_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

CREATE POLICY "Users can create callback requests"
  ON callback_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);