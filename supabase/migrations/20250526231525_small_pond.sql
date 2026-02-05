-- Create function to notify admins of new callback requests
CREATE OR REPLACE FUNCTION notify_callback_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the notification function
  PERFORM net.http_post(
    url := 'https://' || current_setting('custom.base_url') || '/functions/v1/send-callback-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('custom.service_role_key')
    ),
    body := jsonb_build_object(
      'phone_number', NEW.phone_number
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new callback requests
CREATE TRIGGER on_new_callback_request
AFTER INSERT ON callback_requests
FOR EACH ROW
EXECUTE PROCEDURE notify_callback_request();