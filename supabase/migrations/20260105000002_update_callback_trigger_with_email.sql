/*
  # Update Callback Request Trigger to Include Email
  
  1. Changes
    - Update trigger function to pass email, user_id, and request_id to notification function
*/

-- Drop and recreate the trigger function
DROP FUNCTION IF EXISTS notify_callback_request() CASCADE;

CREATE OR REPLACE FUNCTION notify_callback_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the notification function with email, user_id, and request_id
  PERFORM net.http_post(
    url := 'https://' || current_setting('custom.base_url') || '/functions/v1/send-callback-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('custom.service_role_key')
    ),
    body := jsonb_build_object(
      'phone_number', NEW.phone_number,
      'email', NEW.email,
      'user_id', NEW.user_id,
      'request_id', NEW.id
    )
  );

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

