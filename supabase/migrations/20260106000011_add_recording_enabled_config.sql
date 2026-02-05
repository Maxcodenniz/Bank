/*
  # Add recording_enabled config to app_config table
  
  1. Changes
    - Insert default value for recording_enabled feature flag
    - Defaults to 'true' (enabled)
*/

-- Insert recording_enabled config if it doesn't exist
INSERT INTO public.app_config (key, value, description)
VALUES ('recording_enabled', 'true'::jsonb, 'Enable/disable recording functionality in live streams')
ON CONFLICT (key) DO NOTHING;





