-- Fix RLS policies for app_config to allow super admin by ID
-- This ensures the super admin (dennis) can update config even if user_type check fails

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can insert app_config" ON public.app_config;
DROP POLICY IF EXISTS "Super admins can update app_config" ON public.app_config;

-- Create new INSERT policy that checks both user_type and super admin ID
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

-- Create new UPDATE policy that checks both user_type and super admin ID
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

-- Update the RPC function to also check by ID
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
    ELSE 'App configuration'
  END;

  -- Upsert the config value using key as conflict target (not id)
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
      value = EXCLUDED.value,
      description = EXCLUDED.description,
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
      value = EXCLUDED.value,
      updated_at = NOW();
  END IF;
END;
$$;

