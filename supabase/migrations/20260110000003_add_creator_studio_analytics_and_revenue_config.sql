/*
  # Add Creator Studio Analytics and Revenue Configuration
  
  This migration adds:
  1. creator_studio_analytics_enabled - Toggle to show/hide analytics in Creator Studio
  2. platform_revenue_percentage - Percentage of revenue kept by platform (default 30%)
  3. artist_revenue_percentage - Percentage of revenue paid to artist (default 70%)
  
  Note: platform_revenue_percentage + artist_revenue_percentage should equal 100%
*/

-- Add creator_studio_analytics_enabled config (defaults to true)
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('creator_studio_analytics_enabled', 'true'::jsonb, 'Enable/disable analytics tab in Creator Studio')
ON CONFLICT (key) DO NOTHING;

-- Add platform_revenue_percentage config (defaults to 30%)
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('platform_revenue_percentage', '30'::jsonb, 'Percentage of revenue kept by platform for maintenance (0-100)')
ON CONFLICT (key) DO NOTHING;

-- Add artist_revenue_percentage config (defaults to 70%)
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('artist_revenue_percentage', '70'::jsonb, 'Percentage of revenue paid to artist after live event (0-100)')
ON CONFLICT (key) DO NOTHING;

-- Update the update_app_config function to include these new configs
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
    WHEN 'gift_enabled' THEN 'Enable/disable the gift button in live events'
    WHEN 'creator_studio_analytics_enabled' THEN 'Enable/disable analytics tab in Creator Studio'
    WHEN 'platform_revenue_percentage' THEN 'Percentage of revenue kept by platform for maintenance (0-100)'
    WHEN 'artist_revenue_percentage' THEN 'Percentage of revenue paid to artist after live event (0-100)'
    ELSE 'Application configuration'
  END;

  -- Validate revenue percentages if updating them
  IF config_key = 'platform_revenue_percentage' OR config_key = 'artist_revenue_percentage' THEN
    DECLARE
      percentage_value NUMERIC;
    BEGIN
      -- Extract numeric value from JSONB
      percentage_value := (config_value::text)::numeric;
      
      -- Validate range
      IF percentage_value < 0 OR percentage_value > 100 THEN
        RAISE EXCEPTION 'Percentage must be between 0 and 100';
      END IF;
    END;
  END IF;

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
