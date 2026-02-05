/*
  # Add artist_recordings_visible config
  
  Adds a new feature flag to control visibility of "My Recordings" link in Artist Tools menu.
*/

-- Insert default config value (only if it doesn't exist)
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('artist_recordings_visible', 'true'::jsonb, 'Show or hide "My Recordings" link in Artist Tools menu')
ON CONFLICT (key) DO NOTHING;

