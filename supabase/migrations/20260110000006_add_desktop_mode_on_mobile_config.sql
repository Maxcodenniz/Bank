/*
  # Add Desktop Mode on Mobile Config
  
  This migration adds a configuration option to allow desktop mode on mobile devices
  in the Creator Studio, controlled by super admins.
  
  1. Changes
    - Add desktop_mode_on_mobile config to app_config table
    - Update update_app_config function to include this new config
*/

-- Add desktop_mode_on_mobile config (defaults to false)
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('desktop_mode_on_mobile', 'false'::jsonb, 'Allow desktop mode on mobile devices in Creator Studio')
ON CONFLICT (key) DO NOTHING;

-- Update the update_app_config function to include this new config
CREATE OR REPLACE FUNCTION update_app_config(
  config_key TEXT,
  config_value JSONB
)
RETURNS VOID AS $$
DECLARE
  config_description TEXT;
  parsed_value NUMERIC;
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

  -- Validate percentages
  IF config_key IN ('platform_revenue_percentage', 'artist_revenue_percentage') THEN
    BEGIN
      parsed_value := config_value::text::numeric;
      IF parsed_value < 0 OR parsed_value > 100 THEN
        RAISE EXCEPTION 'Percentage value must be between 0 and 100';
      END IF;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'Invalid percentage value format';
    END;
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
    WHEN 'gift_enabled' THEN 'Enable/disable the gift button in live events'
    WHEN 'creator_studio_analytics_enabled' THEN 'Enable/disable the analytics tab in the Creator Studio'
    WHEN 'platform_revenue_percentage' THEN 'Percentage of ticket revenue kept by the platform (0-100)'
    WHEN 'artist_revenue_percentage' THEN 'Percentage of ticket revenue paid to the artist (0-100)'
    WHEN 'desktop_mode_on_mobile' THEN 'Allow desktop mode on mobile devices in Creator Studio' -- Added
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
