-- Create RPC function for super admins to update app_config
-- This bypasses RLS issues and ensures proper JSONB formatting
CREATE OR REPLACE FUNCTION update_app_config(
  config_key TEXT,
  config_value BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  config_description TEXT;
BEGIN
  -- Check if user is super admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can update app config';
  END IF;

  -- Set description based on key (only if column exists)
  config_description := CASE 
    WHEN config_key = 'artist_login_enabled' THEN 'Enable/disable artist signup option'
    WHEN config_key = 'live_chat_enabled' THEN 'Enable/disable chat in live events'
    ELSE 'App configuration'
  END;

  -- Upsert the config value
  -- Check if description column exists before including it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config' 
    AND column_name = 'description'
  ) THEN
    INSERT INTO public.app_config (key, value, description)
    VALUES (
      config_key,
      config_value::jsonb,
      config_description
    )
    ON CONFLICT (key) 
    DO UPDATE SET 
      value = config_value::jsonb,
      updated_at = NOW();
  ELSE
    -- Insert without description if column doesn't exist
    INSERT INTO public.app_config (key, value)
    VALUES (
      config_key,
      config_value::jsonb
    )
    ON CONFLICT (key) 
    DO UPDATE SET 
      value = config_value::jsonb,
      updated_at = NOW();
  END IF;
END;
$$;

-- Grant execute permission to authenticated users (RLS will check super admin status)
GRANT EXECUTE ON FUNCTION update_app_config(TEXT, BOOLEAN) TO authenticated;

