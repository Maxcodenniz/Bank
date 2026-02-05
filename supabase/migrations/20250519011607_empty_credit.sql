/*
  # Add bio column to profiles table
  
  1. Changes
    - Add bio column to profiles table for user biographies
    
  2. Notes
    - Column is nullable since not all users may want to add a bio
    - No RLS changes needed as existing profile policies will cover this column
*/

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio TEXT;