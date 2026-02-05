-- Fix update_app_config function to properly handle upserts
-- Uses INSERT ... ON CONFLICT which handles both insert and update cases
-- SECURITY DEFINER bypasses RLS, so we can directly modify the table

CREATE OR REPLACE FUNCTION update_app_config(
  config_key TEXT,
  config_value BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_description TEXT;
  has_description BOOLEAN;
  record_exists BOOLEAN;
BEGIN
  -- Check if user is super admin (by user_type or by ID)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      profiles.user_type = 'super_admin'
      OR profiles.id = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Only super admins can update app config';
  END IF;

  -- Set description based on key
  config_description := CASE 
    WHEN config_key = 'artist_login_enabled' THEN 'Enable/disable artist signup option'
    WHEN config_key = 'live_chat_enabled' THEN 'Enable/disable chat in live events'
    WHEN config_key = 'advertisements_home_enabled' THEN 'Enable/disable advertisements on the home page'
    ELSE 'App configuration'
  END;

  -- Check if description column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config' 
    AND column_name = 'description'
  ) INTO has_description;

  -- Check if record exists first (bypassing RLS since we're SECURITY DEFINER)
  SELECT EXISTS (
    SELECT 1 FROM public.app_config WHERE key = config_key
  ) INTO record_exists;

  -- Update existing record or insert new one
  IF record_exists THEN
    -- Update existing record
    IF has_description THEN
      UPDATE public.app_config
      SET 
        value = config_value::jsonb,
        description = config_description,
        updated_at = NOW()
      WHERE key = config_key;
    ELSE
      UPDATE public.app_config
      SET 
        value = config_value::jsonb,
        updated_at = NOW()
      WHERE key = config_key;
    END IF;
  ELSE
    -- Insert new record - explicitly exclude id to let database generate it
    IF has_description THEN
      INSERT INTO public.app_config (key, value, description)
      VALUES (
        config_key,
        config_value::jsonb,
        config_description
      );
    ELSE
      INSERT INTO public.app_config (key, value)
      VALUES (
        config_key,
        config_value::jsonb
      );
    END IF;
  END IF;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_app_config(TEXT, BOOLEAN) TO authenticated;


