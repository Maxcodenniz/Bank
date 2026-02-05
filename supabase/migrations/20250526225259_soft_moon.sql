-- Create favorite_artists table
CREATE TABLE IF NOT EXISTS favorite_artists (
  user_id UUID REFERENCES profiles(id) NOT NULL,
  artist_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);

-- Enable RLS
ALTER TABLE favorite_artists ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own favorite artists"
  ON favorite_artists
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create function to notify users when their favorite artists schedule events
CREATE OR REPLACE FUNCTION notify_favorite_artists()
RETURNS TRIGGER AS $$
DECLARE
  artist_name TEXT;
  event_title TEXT;
  favorite_user RECORD;
  user_notification_preference TEXT;
  user_email TEXT;
  user_phone TEXT;
BEGIN
  -- Get artist name and event title
  SELECT full_name INTO artist_name FROM profiles WHERE id = NEW.artist_id;
  SELECT title INTO event_title FROM events WHERE id = NEW.id;

  -- Loop through favorite artists and send notifications
  FOR favorite_user IN 
    SELECT f.user_id, p.notification_preference, p.email, p.phone 
    FROM favorite_artists f 
    JOIN profiles p ON p.id = f.user_id 
    WHERE f.artist_id = NEW.artist_id
  LOOP
    -- Send email notification
    IF favorite_user.notification_preference = 'email' AND favorite_user.email IS NOT NULL THEN
      -- Implement email sending logic here (e.g., using SendGrid)
      RAISE NOTICE 'Sending email to % for event % by %', favorite_user.email, event_title, artist_name;
      PERFORM net.http_post(
        url := 'https://' || current_setting('custom.base_url') || '/functions/v1/send-event-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('custom.service_role_key')
        ),
        body := jsonb_build_object(
          'userId', favorite_user.user_id,
          'eventId', NEW.id,
          'notificationType', 'event_scheduled',
          'eventTitle', event_title
        )
      );
    END IF;

    -- Send SMS notification
    IF favorite_user.notification_preference = 'phone' AND favorite_user.phone IS NOT NULL THEN
      -- Implement SMS sending logic here (e.g., using Twilio)
      RAISE NOTICE 'Sending SMS to % for event % by %', favorite_user.phone, event_title, artist_name;
      PERFORM net.http_post(
        url := 'https://' || current_setting('custom.base_url') || '/functions/v1/send-event-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('custom.service_role_key')
        ),
        body := jsonb_build_object(
          'userId', favorite_user.user_id,
          'eventId', NEW.id,
          'notificationType', 'event_scheduled',
          'eventTitle', event_title
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the notification function
CREATE TRIGGER on_new_event
AFTER INSERT ON events
FOR EACH ROW
EXECUTE PROCEDURE notify_favorite_artists();