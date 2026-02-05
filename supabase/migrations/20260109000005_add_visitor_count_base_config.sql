/*
  # Add Visitor Count Base Config
  
  Adds a configuration option to set a base/starting number for the visitor counter.
  The displayed count will be: base_count + actual_unique_visitors
*/

-- Add visitor_count_base config (defaults to 0)
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('visitor_count_base', '0'::jsonb, 'Base/starting number for visitor counter. Displayed count = base + actual unique visitors')
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
    WHEN 'visitor_count_base' THEN 'Base/starting number for visitor counter. Displayed count = base + actual unique visitors'
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

-- Function to reset visitor count (sets base to current total and clears all visitors)
CREATE OR REPLACE FUNCTION reset_visitor_count(new_base_count INTEGER DEFAULT 0)
RETURNS JSONB AS $$
DECLARE
  current_total INTEGER;
  result JSONB;
BEGIN
  -- Get current total unique visitors
  SELECT COUNT(DISTINCT device_id) INTO current_total FROM website_visitors;
  
  -- Calculate new base: if new_base_count is provided, use it; otherwise use current total
  -- This allows setting base to current count (preserving the number) or to a new value
  IF new_base_count = 0 AND current_total > 0 THEN
    -- If 0 is passed and we have visitors, set base to current total to preserve the number
    new_base_count := current_total;
  END IF;
  
  -- Update the base count config
  PERFORM update_app_config('visitor_count_base', new_base_count::text::jsonb);
  
  -- Optionally delete all visitor records (uncomment if you want to clear all data)
  -- DELETE FROM visitor_page_views;
  -- DELETE FROM visitor_sessions;
  -- DELETE FROM website_visitors;
  
  -- Return result
  SELECT jsonb_build_object(
    'success', true,
    'new_base_count', new_base_count,
    'previous_total', current_total,
    'message', 'Visitor count base updated successfully'
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


