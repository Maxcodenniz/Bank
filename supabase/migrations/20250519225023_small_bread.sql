/*
  # Add viewer count to events table
  
  1. Changes
    - Add viewer_count column to events table
    - Set default value to 0
    - Update existing rows
    
  2. Notes
    - Column tracks real-time viewer count for live streams
    - Non-negative integer values only
*/

-- Add viewer_count column with check constraint
ALTER TABLE events
ADD COLUMN viewer_count INTEGER DEFAULT 0 CHECK (viewer_count >= 0);

-- Update existing rows to have 0 viewers
UPDATE events
SET viewer_count = 0
WHERE viewer_count IS NULL;