/*
  # Add artist profile fields
  
  1. Changes
    - Add genre, country, region fields to profiles table
    - Add artist_type field for distinguishing between music and comedy
    - Create genres table for predefined genres
    
  2. Security
    - Enable RLS on new table
    - Add policies for genre selection
*/

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS genres TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS region TEXT CHECK (region IN ('African', 'European', 'American', 'Asian', 'Other')),
ADD COLUMN IF NOT EXISTS artist_type TEXT CHECK (artist_type IN ('music', 'comedy'));

-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('music', 'comedy')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;

-- Add policies for genres
CREATE POLICY "Genres are viewable by everyone"
  ON genres FOR SELECT
  USING (true);

-- Insert default genres
INSERT INTO genres (name, category) VALUES
  -- Music genres
  ('Pop', 'music'),
  ('Rock', 'music'),
  ('Hip Hop', 'music'),
  ('Jazz', 'music'),
  ('Classical', 'music'),
  ('Electronic', 'music'),
  ('R&B', 'music'),
  ('Folk', 'music'),
  ('Country', 'music'),
  ('Blues', 'music'),
  ('Reggae', 'music'),
  ('Metal', 'music'),
  ('Funk', 'music'),
  ('Soul', 'music'),
  ('Disco', 'music'),
  ('Techno', 'music'),
  ('House', 'music'),
  ('Ambient', 'music'),
  ('Gospel', 'music'),
  ('Afrobeats', 'music'),
  
  -- Comedy genres
  ('Stand-up', 'comedy'),
  ('Improv', 'comedy'),
  ('Sketch', 'comedy'),
  ('Observational', 'comedy'),
  ('Political', 'comedy'),
  ('Musical Comedy', 'comedy'),
  ('Character Comedy', 'comedy'),
  ('Alternative', 'comedy'),
  ('Clean Comedy', 'comedy'),
  ('Dark Comedy', 'comedy')
ON CONFLICT (name) DO NOTHING;