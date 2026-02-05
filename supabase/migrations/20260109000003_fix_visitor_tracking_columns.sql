/*
  # Fix Visitor Tracking Tables - Add Missing Columns
  
  This migration ensures all required columns exist in the visitor tracking tables.
  It handles cases where tables might have been created without all columns.
*/

-- Ensure website_visitors table has all required columns
DO $$ 
BEGIN
  -- Add device_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'device_id'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN device_id TEXT;
    -- Update existing rows with a default device_id if any exist
    UPDATE website_visitors 
    SET device_id = 'unknown-' || id::text 
    WHERE device_id IS NULL;
    -- Make it NOT NULL after setting defaults
    ALTER TABLE website_visitors ALTER COLUMN device_id SET NOT NULL;
  END IF;

  -- Add session_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'session_id'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN session_id TEXT;
    -- Update existing rows with a default session_id if any exist
    UPDATE website_visitors 
    SET session_id = 'session-' || id::text 
    WHERE session_id IS NULL;
    -- Make it NOT NULL after setting defaults
    ALTER TABLE website_visitors ALTER COLUMN session_id SET NOT NULL;
  END IF;

  -- Add other optional columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN ip_address TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN user_agent TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'referrer'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN referrer TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'country'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN country TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'city'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN city TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'first_visit_at'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN first_visit_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'last_visit_at'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN last_visit_at TIMESTAMPTZ DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'visit_count'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN visit_count INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'total_time_spent'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN total_time_spent INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'page_views'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN page_views INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'is_unique_visitor'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN is_unique_visitor BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'website_visitors' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE website_visitors ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Ensure visitor_sessions table has all required columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'visitor_sessions' 
    AND column_name = 'device_id'
  ) THEN
    ALTER TABLE visitor_sessions ADD COLUMN device_id TEXT;
    UPDATE visitor_sessions 
    SET device_id = 'unknown-' || id::text 
    WHERE device_id IS NULL;
    ALTER TABLE visitor_sessions ALTER COLUMN device_id SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'visitor_sessions' 
    AND column_name = 'session_id'
  ) THEN
    ALTER TABLE visitor_sessions ADD COLUMN session_id TEXT;
    UPDATE visitor_sessions 
    SET session_id = 'session-' || id::text 
    WHERE session_id IS NULL;
    ALTER TABLE visitor_sessions ALTER COLUMN session_id SET NOT NULL;
  END IF;
END $$;

-- Recreate indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_visitors_device_id ON website_visitors(device_id);
CREATE INDEX IF NOT EXISTS idx_visitors_user_id ON website_visitors(user_id);
CREATE INDEX IF NOT EXISTS idx_visitors_first_visit ON website_visitors(first_visit_at);
CREATE INDEX IF NOT EXISTS idx_visitors_last_visit ON website_visitors(last_visit_at);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON website_visitors(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON visitor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON visitor_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_id ON visitor_page_views(visitor_id);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON visitor_page_views(session_id);
CREATE INDEX IF NOT EXISTS idx_page_views_page_path ON visitor_page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON visitor_page_views(viewed_at);


