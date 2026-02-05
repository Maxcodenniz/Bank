-- Add live stream notification configs for different user types
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('live_notifications_fans_enabled', 'true'::jsonb, 'Enable/disable live stream notifications for fans'),
  ('live_notifications_artists_enabled', 'true'::jsonb, 'Enable/disable live stream notifications for artists'),
  ('live_notifications_admins_enabled', 'true'::jsonb, 'Enable/disable live stream notifications for admins')
ON CONFLICT (key) DO NOTHING;



