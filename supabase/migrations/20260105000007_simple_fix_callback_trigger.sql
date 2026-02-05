/*
  # Simple Fix for Callback Request Trigger
  
  This version hardcodes the project URL and makes the trigger resilient to errors.
  The INSERT will succeed even if the notification fails.
  
  To update the service role key, you'll need to set it as a database setting:
  ALTER DATABASE postgres SET custom.service_role_key = 'your-key-here';
*/

-- Drop and recreate the trigger function
DROP FUNCTION IF EXISTS notify_callback_request() CASCADE;

CREATE OR REPLACE FUNCTION notify_callback_request()
RETURNS TRIGGER AS $$
DECLARE
  base_url TEXT := 'https://ckkpbsstympysqagslju.supabase.co'; -- Your project URL
  service_role_key TEXT;
  function_url TEXT;
BEGIN
  -- Try to get service role key from custom setting
  BEGIN
    service_role_key := current_setting('custom.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    -- If not set, skip notification but allow INSERT to succeed
    RAISE WARNING 'Callback notification skipped: service_role_key not configured. INSERT will still succeed.';
    RETURN NEW;
  END;

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
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_new_callback_request ON callback_requests;

-- Recreate the trigger
CREATE TRIGGER on_new_callback_request
AFTER INSERT ON callback_requests
FOR EACH ROW
EXECUTE FUNCTION notify_callback_request();

-- Instructions for setting the service role key:
-- Run this in Supabase SQL Editor (replace with your actual service role key):
-- ALTER DATABASE postgres SET custom.service_role_key = 'your-service-role-key-here';
--
-- To get your service role key:
-- 1. Go to Supabase Dashboard
-- 2. Settings → API
-- 3. Copy the "service_role" key (keep it secret!)






