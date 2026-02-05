/*
  # Add Email to Callback Requests
  
  1. Changes
    - Add email column to callback_requests table
    - Email is required for sending confirmation to users
*/

-- Add email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'callback_requests' 
    AND column_name = 'email'
  ) THEN
    ALTER TABLE callback_requests 
    ADD COLUMN email TEXT;
  END IF;
END $$;







