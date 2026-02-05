-- Add suspended column to profiles (super_admin can suspend/activate artist accounts)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.suspended IS 'When true, account is suspended (e.g. by super_admin).';

-- Add artist management communication config: when enabled, super admin can use Communication section to send in-app notifications to artists
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('artist_management_communication_enabled', 'true'::jsonb, 'Enable Communication section in Artist Management (send in-app notifications to artists)')
ON CONFLICT (key) DO NOTHING;

-- Update update_app_config to include description for artist_management_communication_enabled
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
  has_description BOOLEAN;
  record_exists BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.user_type = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can update app config';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config' 
    AND column_name = 'description'
  ) INTO has_description;

  SELECT EXISTS (
    SELECT 1 FROM public.app_config WHERE key = config_key
  ) INTO record_exists;

  config_description := CASE config_key
    WHEN 'artist_login_enabled' THEN 'Enable/disable artist signup option'
    WHEN 'live_chat_enabled' THEN 'Enable/disable chat in live events'
    WHEN 'recording_enabled' THEN 'Enable/disable event recording feature'
    WHEN 'artist_recordings_visible' THEN 'Control visibility of recordings to artists'
    WHEN 'advertisements_home_enabled' THEN 'Enable/disable advertisements on the Home page'
    WHEN 'visitor_counter_visible' THEN 'Enable/disable visitor counter visibility in the navbar'
    WHEN 'visitor_count_base' THEN 'Base/starting number for visitor counter'
    WHEN 'gift_enabled' THEN 'Enable/disable the gift button in live events'
    WHEN 'creator_studio_analytics_enabled' THEN 'Enable/disable analytics tab in Creator Studio'
    WHEN 'platform_revenue_percentage' THEN 'Percentage of revenue kept by platform for maintenance (0-100)'
    WHEN 'artist_revenue_percentage' THEN 'Percentage of revenue paid to artist after live event (0-100)'
    WHEN 'live_event_notifications_enabled' THEN 'Enable/disable in-app notifications when live events start'
    WHEN 'live_event_email_notify_admins' THEN 'Send email notifications to admins when live events start'
    WHEN 'live_event_email_notify_artists' THEN 'Send email notifications to artists when live events start'
    WHEN 'live_event_email_notify_fans' THEN 'Send email notifications to fans (regular users) when live events start'
    WHEN 'event_scheduled_phone_notify_followers' THEN 'Send phone notifications to users following an artist when that artist schedules an event'
    WHEN 'event_scheduled_phone_notify_all' THEN 'Send phone notifications to all users when any artist schedules an event'
    WHEN 'live_event_started_phone_notify_followers' THEN 'Send phone notifications to users following an artist when that artist starts a live event'
    WHEN 'live_event_started_phone_notify_all' THEN 'Send phone notifications to all users when any artist starts a live event'
    WHEN 'auth_gate_enabled' THEN 'Show sign-in/sign-up pop-up when a guest clicks anywhere on the site'
    WHEN 'artist_management_communication_enabled' THEN 'Enable Communication section in Artist Management (send in-app notifications to artists)'
    ELSE 'Application configuration'
  END;

  IF record_exists THEN
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
    IF has_description THEN
      INSERT INTO public.app_config (key, value, description)
      VALUES (config_key, config_value::jsonb, config_description);
    ELSE
      INSERT INTO public.app_config (key, value)
      VALUES (config_key, config_value::jsonb);
    END IF;
  END IF;
END;
$$;
