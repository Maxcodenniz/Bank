/*
  # Security and Anti-Piracy Tables
  
  1. New Tables
    - security_violations: Log security violations and suspicious activities
    - stream_access_logs: Track stream access attempts and tokens
    - user_bans: Manage temporary and permanent user bans
    - content_protection_logs: Log content protection events
    
  2. Security
    - Enable RLS on all tables
    - Add policies for admin access only
    - Create indexes for performance
    
  3. Functions
    - Add functions for security monitoring
    - Create triggers for automatic violation handling
*/

-- Create security_violations table
CREATE TABLE IF NOT EXISTS security_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  details TEXT,
  user_id UUID REFERENCES profiles(id),
  session_id TEXT,
  user_agent TEXT,
  ip_address TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create stream_access_logs table
CREATE TABLE IF NOT EXISTS stream_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  user_id UUID REFERENCES profiles(id),
  user_agent TEXT,
  ip_address TEXT,
  access_granted BOOLEAN DEFAULT false,
  stream_token TEXT,
  violation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_bans table
CREATE TABLE IF NOT EXISTS user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  banned_by UUID REFERENCES profiles(id),
  banned_until TIMESTAMPTZ,
  is_permanent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create content_protection_logs table
CREATE TABLE IF NOT EXISTS content_protection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  user_id UUID REFERENCES profiles(id),
  protection_type TEXT NOT NULL, -- 'watermark', 'drm', 'token_validation', etc.
  action TEXT NOT NULL, -- 'applied', 'violated', 'bypassed'
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE security_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_protection_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (only global admins can access security data)
CREATE POLICY "Only global admins can view security violations"
  ON security_violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

CREATE POLICY "Only global admins can manage security violations"
  ON security_violations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

CREATE POLICY "Only global admins can view stream access logs"
  ON stream_access_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

CREATE POLICY "Only global admins can manage user bans"
  ON user_bans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

CREATE POLICY "Only global admins can view content protection logs"
  ON content_protection_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'global_admin'
    )
  );

-- Create indexes for performance
CREATE INDEX idx_security_violations_user_id ON security_violations(user_id);
CREATE INDEX idx_security_violations_type ON security_violations(type);
CREATE INDEX idx_security_violations_severity ON security_violations(severity);
CREATE INDEX idx_security_violations_created_at ON security_violations(created_at);

CREATE INDEX idx_stream_access_logs_event_id ON stream_access_logs(event_id);
CREATE INDEX idx_stream_access_logs_user_id ON stream_access_logs(user_id);
CREATE INDEX idx_stream_access_logs_created_at ON stream_access_logs(created_at);

CREATE INDEX idx_user_bans_user_id ON user_bans(user_id);
CREATE INDEX idx_user_bans_banned_until ON user_bans(banned_until);

CREATE INDEX idx_content_protection_logs_event_id ON content_protection_logs(event_id);
CREATE INDEX idx_content_protection_logs_user_id ON content_protection_logs(user_id);

-- Create function to check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_bans
    WHERE user_id = user_uuid
    AND (is_permanent = true OR banned_until > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to log security violations
CREATE OR REPLACE FUNCTION log_security_violation(
  violation_type TEXT,
  violation_details TEXT DEFAULT NULL,
  user_uuid UUID DEFAULT NULL,
  session_uuid TEXT DEFAULT NULL,
  user_agent_string TEXT DEFAULT NULL,
  ip_addr TEXT DEFAULT NULL,
  violation_severity TEXT DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
  violation_id UUID;
BEGIN
  INSERT INTO security_violations (
    type, details, user_id, session_id, user_agent, ip_address, severity
  ) VALUES (
    violation_type, violation_details, user_uuid, session_uuid, 
    user_agent_string, ip_addr, violation_severity
  ) RETURNING id INTO violation_id;
  
  RETURN violation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to automatically ban users with critical violations
CREATE OR REPLACE FUNCTION handle_critical_violation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    -- Check if user already has multiple violations
    IF (
      SELECT COUNT(*) FROM security_violations
      WHERE user_id = NEW.user_id
      AND severity IN ('high', 'critical')
      AND created_at > now() - interval '24 hours'
    ) >= 3 THEN
      -- Temporarily ban user for 24 hours
      INSERT INTO user_bans (user_id, reason, banned_until)
      VALUES (
        NEW.user_id,
        'Automatic ban due to multiple critical security violations',
        now() + interval '24 hours'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic violation handling
CREATE TRIGGER on_critical_violation
  AFTER INSERT ON security_violations
  FOR EACH ROW
  EXECUTE FUNCTION handle_critical_violation();

-- Add updated_at trigger for user_bans
CREATE TRIGGER update_user_bans_updated_at
  BEFORE UPDATE ON user_bans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add profile statistics for security monitoring
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS profile_likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_event_views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Create functions to increment profile statistics
CREATE OR REPLACE FUNCTION increment_profile_views(artist_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET profile_views = COALESCE(profile_views, 0) + 1
  WHERE id = artist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_profile_likes(artist_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET profile_likes = COALESCE(profile_likes, 0) + 1
  WHERE id = artist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_profile_likes(artist_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET profile_likes = GREATEST(COALESCE(profile_likes, 0) - 1, 0)
  WHERE id = artist_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add payment verification fields for enhanced security
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bank_iban TEXT,
ADD COLUMN IF NOT EXISTS mobile_payment_number TEXT,
ADD COLUMN IF NOT EXISTS mobile_payment_name TEXT,
ADD COLUMN IF NOT EXISTS payment_verification_code TEXT,
ADD COLUMN IF NOT EXISTS payment_verification_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_info_verified BOOLEAN DEFAULT false;