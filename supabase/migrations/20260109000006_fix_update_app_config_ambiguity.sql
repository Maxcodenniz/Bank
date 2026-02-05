/*
  # Fix update_app_config Function Ambiguity
  
  Removes the BOOLEAN overload and keeps only the JSONB version to avoid
  PostgreSQL ambiguity errors. The JSONB version can handle all types.
*/

-- Drop the old BOOLEAN version
DROP FUNCTION IF EXISTS update_app_config(TEXT, BOOLEAN) CASCADE;

-- Ensure we have the unified JSONB version (handles all types)
CREATE OR REPLACE FUNCTION update_app_config(
  config_key TEXT,
  config_value JSONB
)
RETURNS VOID AS $$
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

  -- Determine description based on key
  config_description := CASE config_key
    WHEN 'payment_encryption_enabled' THEN 'Enable/disable payment data encryption'
    WHEN 'payment_info_visible' THEN 'Control visibility of payment information in dashboard'
    WHEN 'live_stream_notifications_enabled' THEN 'Enable/disable live stream notifications'
    WHEN 'live_stream_notification_time' THEN 'Time before event to send live stream notification (in minutes)'
    WHEN 'recording_enabled' THEN 'Enable/disable event recording feature'
    WHEN 'artist_recordings_visible' THEN 'Control visibility of recordings to artists'
    WHEN 'advertisements_home_enabled' THEN 'Enable/disable advertisements on the Home page'
    WHEN 'visitor_counter_visible' THEN 'Enable/disable visitor counter visibility in the navbar'
    WHEN 'visitor_count_base' THEN 'Base/starting number for visitor counter. Displayed count = base + actual unique visitors'
    WHEN 'artist_login_enabled' THEN 'Enable/disable artist signup option'
    WHEN 'live_chat_enabled' THEN 'Enable/disable chat in live events'
    ELSE 'Application configuration'
  END;

  -- Upsert the config
  INSERT INTO public.app_config (key, value, description)
  VALUES (config_key, config_value, config_description)
  ON CONFLICT (key) 
  DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_app_config(TEXT, JSONB) TO authenticated;


