/*
  # Drop and Recreate Visitor Tracking Tables
  
  This migration drops existing visitor tracking tables and recreates them
  with the correct schema. Use this if you want a clean start.
  
  WARNING: This will delete all existing visitor data!
*/

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS visitor_page_views CASCADE;
DROP TABLE IF EXISTS visitor_sessions CASCADE;
DROP TABLE IF EXISTS website_visitors CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS get_total_visitor_count() CASCADE;
DROP FUNCTION IF EXISTS get_unique_visitors_today() CASCADE;
DROP FUNCTION IF EXISTS get_active_visitors() CASCADE;
DROP FUNCTION IF EXISTS get_visitor_analytics() CASCADE;
DROP FUNCTION IF EXISTS increment_visitor_page_views(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_visitor_updated_at() CASCADE;

-- Now recreate everything from scratch
-- Create website_visitors table
CREATE TABLE website_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  city TEXT,
  first_visit_at TIMESTAMPTZ DEFAULT now(),
  last_visit_at TIMESTAMPTZ DEFAULT now(),
  visit_count INTEGER DEFAULT 1,
  total_time_spent INTEGER DEFAULT 0, -- in seconds
  page_views INTEGER DEFAULT 1,
  is_unique_visitor BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create visitor_sessions table for detailed session tracking
CREATE TABLE visitor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES website_visitors(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration INTEGER DEFAULT 0, -- in seconds
  page_views INTEGER DEFAULT 1,
  last_page TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create visitor_page_views table for page-level tracking
CREATE TABLE visitor_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID REFERENCES website_visitors(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  time_spent INTEGER DEFAULT 0, -- in seconds
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_visitors_device_id ON website_visitors(device_id);
CREATE INDEX idx_visitors_user_id ON website_visitors(user_id);
CREATE INDEX idx_visitors_first_visit ON website_visitors(first_visit_at);
CREATE INDEX idx_visitors_last_visit ON website_visitors(last_visit_at);
CREATE INDEX idx_visitors_created_at ON website_visitors(created_at);
CREATE INDEX idx_sessions_visitor_id ON visitor_sessions(visitor_id);
CREATE INDEX idx_sessions_session_id ON visitor_sessions(session_id);
CREATE INDEX idx_sessions_started_at ON visitor_sessions(started_at);
CREATE INDEX idx_page_views_visitor_id ON visitor_page_views(visitor_id);
CREATE INDEX idx_page_views_session_id ON visitor_page_views(session_id);
CREATE INDEX idx_page_views_page_path ON visitor_page_views(page_path);
CREATE INDEX idx_page_views_viewed_at ON visitor_page_views(viewed_at);

-- Enable RLS
ALTER TABLE website_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_page_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can insert, admins can view
CREATE POLICY "Anyone can track visits" ON website_visitors
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view visitor stats" ON website_visitors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('global_admin', 'super_admin')
    )
  );

CREATE POLICY "Anyone can track sessions" ON visitor_sessions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view sessions" ON visitor_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('global_admin', 'super_admin')
    )
  );

CREATE POLICY "Anyone can track page views" ON visitor_page_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view page views" ON visitor_page_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('global_admin', 'super_admin')
    )
  );

-- Function to get total visitor count
CREATE OR REPLACE FUNCTION get_total_visitor_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(DISTINCT device_id) FROM website_visitors);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unique visitors today
CREATE OR REPLACE FUNCTION get_unique_visitors_today()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT device_id)
    FROM website_visitors
    WHERE DATE(first_visit_at) = CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active visitors (last 5 minutes)
CREATE OR REPLACE FUNCTION get_active_visitors()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT device_id)
    FROM website_visitors
    WHERE last_visit_at > now() - interval '5 minutes'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive visitor analytics
CREATE OR REPLACE FUNCTION get_visitor_analytics()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(DISTINCT device_id) FROM website_visitors),
    'today', (SELECT COUNT(DISTINCT device_id) FROM website_visitors WHERE DATE(first_visit_at) = CURRENT_DATE),
    'thisWeek', (SELECT COUNT(DISTINCT device_id) FROM website_visitors WHERE first_visit_at >= date_trunc('week', CURRENT_DATE)),
    'thisMonth', (SELECT COUNT(DISTINCT device_id) FROM website_visitors WHERE first_visit_at >= date_trunc('month', CURRENT_DATE)),
    'active', (SELECT COUNT(DISTINCT device_id) FROM website_visitors WHERE last_visit_at > now() - interval '5 minutes'),
    'totalPageViews', (SELECT COALESCE(SUM(page_views), 0) FROM website_visitors),
    'avgSessionDuration', (SELECT COALESCE(AVG(duration), 0) FROM visitor_sessions WHERE ended_at IS NOT NULL),
    'topPages', (
      SELECT jsonb_agg(jsonb_build_object('path', page_path, 'views', view_count))
      FROM (
        SELECT page_path, COUNT(*) as view_count
        FROM visitor_page_views
        WHERE viewed_at >= now() - interval '7 days'
        GROUP BY page_path
        ORDER BY view_count DESC
        LIMIT 5
      ) top_pages
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment page views
CREATE OR REPLACE FUNCTION increment_visitor_page_views(visitor_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE website_visitors
  SET page_views = COALESCE(page_views, 0) + 1
  WHERE id = visitor_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_visitor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_visitor_updated_at
  BEFORE UPDATE ON website_visitors
  FOR EACH ROW
  EXECUTE FUNCTION update_visitor_updated_at();


