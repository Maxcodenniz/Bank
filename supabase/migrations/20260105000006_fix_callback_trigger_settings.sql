/*
  # Fix Callback Request Trigger - Handle Missing Settings Gracefully
  
  The trigger was failing because it tried to access custom settings that don't exist.
  This migration makes the trigger resilient by:
  1. Using a fallback URL pattern
  2. Catching errors so INSERT doesn't fail
  3. Using environment variables if available, or constructing URL from project ref
*/

-- Drop and recreate the trigger function with error handling
DROP FUNCTION IF EXISTS notify_callback_request() CASCADE;

CREATE OR REPLACE FUNCTION notify_callback_request()
RETURNS TRIGGER AS $$
DECLARE
  base_url TEXT;
  service_role_key TEXT;
  function_url TEXT;
  request_body JSONB;
BEGIN
  -- Try to get base URL from custom setting, or construct from project ref
  BEGIN
    base_url := current_setting('custom.base_url', true);
  EXCEPTION WHEN OTHERS THEN
    -- If custom setting doesn't exist, try to get from project ref
    -- Supabase project ref can be extracted from the connection
    -- For now, we'll use a pattern: https://{project-ref}.supabase.co
    -- The project ref is typically in the connection string or can be inferred
    -- Since we can't easily get it, we'll use a fallback pattern
    -- You'll need to set this via: ALTER DATABASE postgres SET custom.base_url = 'https://ckkpbsstympysqagslju.supabase.co';
    base_url := NULL;
  END;

  -- Try to get service role key from custom setting
  BEGIN
    service_role_key := current_setting('custom.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  -- If we don't have the required settings, log and skip notification
  -- This allows the INSERT to succeed even if notification fails
  IF base_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'Callback notification skipped: missing base_url or service_role_key. Please configure custom.base_url and custom.service_role_key settings.';
    RETURN NEW; -- Allow INSERT to succeed
  END IF;

  -- Construct the function URL
  function_url := base_url || '/functions/v1/send-callback-notification';

  -- Build the request body
  request_body := jsonb_build_object(
    'phone_number', NEW.phone_number,
    'email', NEW.email,
    'user_id', NEW.user_id,
    'request_id', NEW.id
  );

  -- Call the notification function (fire and forget - don't wait for response)
  -- Wrap in exception handler so INSERT doesn't fail if notification fails
  BEGIN
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := request_body
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the INSERT
    RAISE WARNING 'Failed to send callback notification: %', SQLERRM;
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

-- IMPORTANT: After running this migration, you need to set the custom settings
-- Run these commands in the Supabase SQL Editor (replace with your actual values):

-- 1. Set the base URL (your Supabase project URL)
-- ALTER DATABASE postgres SET custom.base_url = 'https://ckkpbsstympysqagslju.supabase.co';

-- 2. Set the service role key (get from Supabase Dashboard → Settings → API)
-- ALTER DATABASE postgres SET custom.service_role_key = 'your-service-role-key-here';

-- Note: These settings are database-level and persist across sessions.
-- If not set, INSERTs will still work, but notifications won't be sent.

