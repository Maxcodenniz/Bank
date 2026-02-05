-- Create app_config table to store feature flags (only if it doesn't exist)
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

-- Insert default config values (only if they don't exist)
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('artist_login_enabled', 'true'::jsonb, 'Enable/disable artist signup option'),
  ('live_chat_enabled', 'true'::jsonb, 'Enable/disable chat in live events')
ON CONFLICT (key) DO NOTHING;

-- Note: JSONB values can be stored as boolean true/false or strings 'true'/'false'
-- The application handles both formats for compatibility

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_config_updated_at();

-- Enable RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can read
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

-- Policy: Only super admins can insert
CREATE POLICY "Super admins can insert app_config"
  ON public.app_config
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'super_admin'
    )
  );

-- Policy: Only super admins can update
CREATE POLICY "Super admins can update app_config"
  ON public.app_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'super_admin'
    )
  );

-- Policy: Anyone can read (for public features)
CREATE POLICY "Public can read app_config"
  ON public.app_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

