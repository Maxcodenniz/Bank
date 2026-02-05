-- Fix app_config table structure conflict
-- There may be an old app_config table with different structure
-- This migration ensures we have the correct structure

-- Drop the old app_config table if it exists with wrong structure (key as primary key)
DO $$
BEGIN
  -- Check if table exists with key as primary key (old structure)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config' 
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name IN (
      SELECT constraint_name 
      FROM information_schema.key_column_usage 
      WHERE table_schema = 'public' 
      AND table_name = 'app_config' 
      AND column_name = 'key'
    )
  ) THEN
    -- Drop old table structure
    DROP TABLE IF EXISTS public.app_config CASCADE;
  END IF;
END $$;

-- Create the correct app_config table structure if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.app_config ADD COLUMN description TEXT;
  END IF;
END $$;

-- Ensure default values exist
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('artist_login_enabled', 'true'::jsonb, 'Enable/disable artist signup option'),
  ('live_chat_enabled', 'true'::jsonb, 'Enable/disable chat in live events')
ON CONFLICT (key) DO NOTHING;

-- Recreate trigger if needed
DROP TRIGGER IF EXISTS update_app_config_updated_at ON public.app_config;
DROP FUNCTION IF EXISTS update_app_config_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_config_updated_at();

-- Re-enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Drop and recreate RLS policies
DROP POLICY IF EXISTS "Admins can read app_config" ON public.app_config;
DROP POLICY IF EXISTS "Super admins can insert app_config" ON public.app_config;
DROP POLICY IF EXISTS "Super admins can update app_config" ON public.app_config;
DROP POLICY IF EXISTS "Public can read app_config" ON public.app_config;

-- Recreate policies
CREATE POLICY "Admins can read app_config"
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('global_admin', 'super_admin')
    )
  );

CREATE POLICY "Super admins can insert app_config"
  ON public.app_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.user_type = 'super_admin'
        OR profiles.id = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid
      )
    )
  );

CREATE POLICY "Super admins can update app_config"
  ON public.app_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.user_type = 'super_admin'
        OR profiles.id = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.user_type = 'super_admin'
        OR profiles.id = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid
      )
    )
  );

CREATE POLICY "Public can read app_config"
  ON public.app_config
  FOR SELECT
  TO anon, authenticated
  USING (true);





