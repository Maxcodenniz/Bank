/*
  # Add Visitor Counter Visibility Config
  
  Adds a configuration option to control the visibility of the visitor counter
  in the navbar. Super admins can toggle this setting.
*/

-- Add visitor_counter_visible config
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('visitor_counter_visible', 'true'::jsonb, 'Enable/disable visitor counter visibility in the navbar')
ON CONFLICT (key) DO NOTHING;

-- Update the update_app_config function to include this new config
CREATE OR REPLACE FUNCTION update_app_config(
  config_key TEXT,
  config_value JSONB
)
RETURNS VOID AS $$
DECLARE
  config_description TEXT;
BEGIN
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


