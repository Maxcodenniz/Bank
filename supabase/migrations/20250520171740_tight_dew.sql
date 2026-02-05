/*
  # Add notification preferences to profiles
  
  1. Changes
    - Add email and phone columns for contact info
    - Add notification preference column
    - Create indexes for efficient lookups
    
  2. Notes
    - Email and phone are nullable since users may not provide both
    - Default notification preference is email
*/

-- Add notification-related columns if they don't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS notification_preference TEXT DEFAULT 'email'
  CHECK (notification_preference IN ('email', 'phone'));

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);