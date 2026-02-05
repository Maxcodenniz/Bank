/*
  # Add Description to Callback Requests
  
  1. Changes
    - Add description column to callback_requests table
    - Description is required to reduce spam submissions
    - Users must provide at least a few lines describing their request
  
  2. Security
    - No changes to RLS policies needed
*/

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'callback_requests' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE callback_requests 
    ADD COLUMN description TEXT;
  END IF;
END $$;



