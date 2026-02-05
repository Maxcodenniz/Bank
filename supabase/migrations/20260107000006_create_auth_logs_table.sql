-- Create auth_logs table to track authentication events
-- This includes successful logins, failed attempts, logouts, and password resets

CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('login_success', 'login_failed', 'logout', 'password_reset_request', 'password_reset_success', 'account_locked', 'account_unlocked')),
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_email ON auth_logs(email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_action ON auth_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_success ON auth_logs(success);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON auth_logs(ip_address);

-- Enable RLS
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all auth logs
CREATE POLICY "Admins can view all auth logs"
  ON auth_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND user_type IN ('global_admin', 'super_admin')
    )
  );

-- Policy: System can insert auth logs (for authenticated users logging their own actions)
-- We'll use a function for this to allow logging even for failed logins
CREATE OR REPLACE FUNCTION insert_auth_log(
  p_email TEXT,
  p_action TEXT,
  p_success BOOLEAN DEFAULT false,
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO auth_logs (
    user_id,
    email,
    action,
    ip_address,
    user_agent,
    success,
    failure_reason,
    metadata,
    created_at
  )
  VALUES (
    p_user_id,
    p_email,
    p_action,
    p_ip_address,
    p_user_agent,
    p_success,
    p_failure_reason,
    p_metadata,
    NOW()
  )
  RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_auth_log TO authenticated;
GRANT EXECUTE ON FUNCTION insert_auth_log TO anon;

COMMENT ON TABLE auth_logs IS 'Tracks all authentication events including logins, logouts, and password resets';
COMMENT ON COLUMN auth_logs.action IS 'Type of authentication action: login_success, login_failed, logout, password_reset_request, etc.';
COMMENT ON COLUMN auth_logs.success IS 'Whether the action was successful';
COMMENT ON COLUMN auth_logs.failure_reason IS 'Reason for failure if action was unsuccessful';



