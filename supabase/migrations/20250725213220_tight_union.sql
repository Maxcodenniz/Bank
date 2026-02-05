/*
  # Add video_url column to events table

  1. Changes
    - Add `video_url` column to `events` table
    - Column is nullable (TEXT type) to store recorded video URLs
    - Not all events will have recorded videos, so nullable is appropriate

  2. Security
    - No RLS changes needed as events table already has proper policies
    - Column inherits existing table permissions
*/

-- Add video_url column to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE events ADD COLUMN video_url text;
  END IF;
END $$;