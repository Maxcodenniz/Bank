/*
  # Add insert policy for profiles table
  
  1. Changes
    - Add policy to allow users to insert their own profile
    
  2. Security
    - Users can only create their own profile
    - Profile ID must match their auth ID
*/

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);