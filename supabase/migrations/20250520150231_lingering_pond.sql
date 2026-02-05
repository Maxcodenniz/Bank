/*
  # Add notification fields to profiles table
  
  1. Changes
    - Add email field for notifications
    - Add phone field for SMS notifications
    - Add notification preference field
    - Add indexes for efficient querying
    
  2. Notes
    - Email and phone are optional
    - Notification preference defaults to email
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS notification_preference TEXT DEFAULT 'email' CHECK (notification_preference IN ('email', 'phone'));

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);