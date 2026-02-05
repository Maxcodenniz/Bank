/*
  # Add Artist Revenue Percentage
  
  This migration adds a revenue_percentage column to the profiles table
  to allow setting individual revenue percentages for each artist.
  
  1. Changes
    - Add revenue_percentage column to profiles table (nullable DECIMAL)
    - When set, this overrides the global artist_revenue_percentage config
    - When NULL, uses the global artist_revenue_percentage from app_config
*/

-- Add revenue_percentage column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS revenue_percentage DECIMAL(5,2) 
  CHECK (revenue_percentage IS NULL OR (revenue_percentage >= 0 AND revenue_percentage <= 100));

-- Add comment
COMMENT ON COLUMN profiles.revenue_percentage IS 
  'Artist-specific revenue percentage (0-100). When NULL, uses global artist_revenue_percentage from app_config.';

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_revenue_percentage ON profiles(revenue_percentage) 
  WHERE revenue_percentage IS NOT NULL;
