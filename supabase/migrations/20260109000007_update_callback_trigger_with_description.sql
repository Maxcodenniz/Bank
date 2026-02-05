/*
  # Update Callback Request Trigger to Include Description
  
  Updates the trigger function to pass the description field to the notification function.
  This ensures the description is included in email notifications.
*/

-- Drop and recreate the trigger function to include description
DROP FUNCTION IF EXISTS notify_callback_request() CASCADE;

CREATE OR REPLACE FUNCTION notify_callback_request()
RETURNS TRIGGER AS $$
DECLARE
  base_url TEXT;
  service_role_key TEXT;
  function_url TEXT;
BEGIN
  -- Try to get base URL from custom setting
  BEGIN
    base_url := current_setting('custom.base_url', true);
  EXCEPTION WHEN OTHERS THEN
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

  -- Call the notification function with all fields including description
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
        'request_id', NEW.id,
        'description', NEW.description
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


