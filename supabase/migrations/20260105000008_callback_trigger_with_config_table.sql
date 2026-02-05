/*
  # Callback Trigger with Configuration Table
  
  This version uses a configuration table to store the service role key.
  This is more reliable than database settings.
*/

-- Create a configuration table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on config table
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow the trigger function (running as SECURITY DEFINER) to read config
-- The function runs as the creator (postgres), so it can bypass RLS
-- But we'll also allow authenticated reads for admin management
DROP POLICY IF EXISTS "Service role can read config" ON public.app_config;
CREATE POLICY "Service role can read config"
  ON public.app_config
  FOR SELECT
  TO service_role, postgres
  USING (true);

-- Insert the service role key (you'll need to update this with your actual key)
-- Get it from: Supabase Dashboard → Settings → API → service_role key
INSERT INTO public.app_config (key, value)
VALUES ('service_role_key', 'YOUR_SERVICE_ROLE_KEY_HERE')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

-- Drop and recreate the trigger function
DROP FUNCTION IF EXISTS notify_callback_request() CASCADE;

CREATE OR REPLACE FUNCTION notify_callback_request()
RETURNS TRIGGER AS $$
DECLARE
  base_url TEXT := 'https://ckkpbsstympysqagslju.supabase.co'; -- Your project URL
  service_role_key TEXT;
  function_url TEXT;
BEGIN
  -- Get service role key from config table
  SELECT value INTO service_role_key
  FROM public.app_config
  WHERE key = 'service_role_key';

  -- If not found, skip notification but allow INSERT to succeed
  IF service_role_key IS NULL OR service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
    RAISE WARNING 'Callback notification skipped: service_role_key not configured in app_config table. INSERT will still succeed.';
    RETURN NEW;
  END IF;

  -- Construct the function URL
  function_url := base_url || '/functions/v1/send-callback-notification';

  -- Call the notification function (fire and forget)
  -- Wrap in exception handler so INSERT doesn't fail if notification fails
  BEGIN
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'phone_number', NEW.phone_number,
        'email', NEW.email,
        'user_id', NEW.user_id,
        'request_id', NEW.id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the INSERT
    RAISE WARNING 'Failed to send callback notification: %. INSERT will still succeed.', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_new_callback_request ON callback_requests;

-- Recreate the trigger
CREATE TRIGGER on_new_callback_request
AFTER INSERT ON callback_requests
FOR EACH ROW
EXECUTE FUNCTION notify_callback_request();

-- IMPORTANT: After running this migration, update the service role key:
-- UPDATE public.app_config SET value = 'your-actual-service-role-key' WHERE key = 'service_role_key';
--
-- To get your service role key:
-- 1. Go to Supabase Dashboard
-- 2. Settings → API
-- 3. Copy the "service_role" key (keep it secret!)

