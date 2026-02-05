/*
  # Complete DREEMYSTAR Schema Setup
  
  1. New Tables
    - profiles (user profiles with roles including super_admin)
    - events (live events/concerts)
    - tickets (purchased tickets)
    - categories (event categories including Magraheb)
    - event_categories (junction table)
    - live_viewers (unique device tracking for viewer counts)
    - notifications (in-app notification system)
    - advertisements (banner ads with size requirements)
    
  2. Security
    - Enable RLS on all tables
    - Dennis (f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8) is protected super admin
    - Super admin can manage all photos and users
    - Only super admin can delete users and change roles
    - Ticket-gated access policies for streams
    
  3. Features
    - Device fingerprinting for unique viewer counts
    - 15-minute notification system for events
    - Banner image validation (1200px, 16:9 ratio)
    - Event start-time restrictions (5 min before for artists)
*/

-- Create profiles table with super_admin role
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  profile_photo TEXT,
  bio TEXT,
  user_type TEXT CHECK (user_type IN ('fan', 'artist', 'admin', 'super_admin')) DEFAULT 'fan',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  artist_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER NOT NULL, -- in minutes
  price DECIMAL DEFAULT 1.00,
  image_url TEXT,
  banner_url TEXT,
  stream_url TEXT,
  channel_name TEXT,
  status TEXT CHECK (status IN ('upcoming', 'live', 'ended')) DEFAULT 'upcoming',
  viewer_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  purchase_date TIMESTAMPTZ DEFAULT now(),
  status TEXT CHECK (status IN ('active', 'used', 'refunded')) DEFAULT 'active',
  stripe_payment_id TEXT,
  stripe_session_id TEXT
);

-- Create categories table with Magraheb
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  icon TEXT,
  parent_id UUID REFERENCES categories(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create event_categories junction table
CREATE TABLE IF NOT EXISTS event_categories (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, category_id)
);

-- Create live_viewers table for unique device tracking
CREATE TABLE IF NOT EXISTS live_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, device_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('event_starting', 'event_cancelled', 'system')) DEFAULT 'event_starting',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create advertisements table with image requirements
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  width INTEGER NOT NULL CHECK (width >= 1200),
  height INTEGER NOT NULL,
  aspect_ratio DECIMAL GENERATED ALWAYS AS (ROUND((width::DECIMAL / height::DECIMAL), 2)) STORED,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (ROUND((width::DECIMAL / height::DECIMAL), 2) = 1.78) -- 16:9 ratio
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PROFILES POLICIES
-- ========================================

-- Everyone can view public profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    -- Prevent non-super-admins from changing their own role
    (user_type = (SELECT user_type FROM profiles WHERE id = auth.uid()) OR
     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin'))
  );

-- Super admin can update any profile EXCEPT Dennis's role
CREATE POLICY "Super admin can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin') AND
    -- Dennis cannot have his role changed by anyone
    (id != 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid OR
     user_type = 'super_admin')
  );

-- Prevent deletion of Dennis (super admin)
CREATE POLICY "Super admin Dennis cannot be deleted"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    id != 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
  );

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND user_type = 'fan');

-- ========================================
-- EVENTS POLICIES
-- ========================================

-- Everyone can view events
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

-- Artists and admins can create events
CREATE POLICY "Artists can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type IN ('artist', 'admin', 'super_admin')
    )
  );

-- Artists can update their own events, admins can update all
CREATE POLICY "Artists can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    artist_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin')
    )
  );

-- Only super admin can delete events
CREATE POLICY "Super admin can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type = 'super_admin'
    )
  );

-- ========================================
-- TICKETS POLICIES
-- ========================================

-- Users can view their own tickets, admins can view all
CREATE POLICY "Users can view own tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin'))
  );

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
  ON tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin'))
  );

-- Users can purchase tickets
CREATE POLICY "Users can purchase tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ========================================
-- LIVE VIEWERS POLICIES
-- ========================================

-- Anyone can view viewer counts
CREATE POLICY "Viewer counts are public"
  ON live_viewers FOR SELECT
  USING (true);

-- Authenticated users can join as viewers
CREATE POLICY "Users can join as viewers"
  ON live_viewers FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must have a ticket for the event OR be admin OR be the artist
    EXISTS (
      SELECT 1 FROM tickets
      WHERE user_id = auth.uid() AND event_id = live_viewers.event_id AND status = 'active'
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin')
    ) OR
    EXISTS (
      SELECT 1 FROM events
      WHERE id = live_viewers.event_id AND artist_id = auth.uid()
    )
  );

-- Users can update their own viewer record
CREATE POLICY "Users can update own viewer record"
  ON live_viewers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can remove themselves from viewers
CREATE POLICY "Users can remove own viewer record"
  ON live_viewers FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ========================================
-- NOTIFICATIONS POLICIES
-- ========================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can mark their notifications as read
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ========================================
-- CATEGORIES POLICIES
-- ========================================

-- Everyone can view categories
CREATE POLICY "Categories are viewable by everyone"
  ON categories FOR SELECT
  USING (true);

-- Admins can manage categories
CREATE POLICY "Admins can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin'))
  );

CREATE POLICY "Admins can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin'))
  );

CREATE POLICY "Admins can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin'))
  );

-- ========================================
-- EVENT CATEGORIES POLICIES
-- ========================================

CREATE POLICY "Event categories are viewable by everyone"
  ON event_categories FOR SELECT
  USING (true);

CREATE POLICY "Artists can manage event categories"
  ON event_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN profiles p ON p.id = auth.uid()
      WHERE e.id = event_id AND (e.artist_id = auth.uid() OR p.user_type IN ('admin', 'super_admin'))
    )
  );

-- ========================================
-- ADVERTISEMENTS POLICIES
-- ========================================

-- Everyone can view active advertisements
CREATE POLICY "Active advertisements are viewable by everyone"
  ON advertisements FOR SELECT
  USING (active = true OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin')
  ));

-- Only super admin can manage advertisements
CREATE POLICY "Super admin can insert advertisements"
  ON advertisements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
  );

CREATE POLICY "Super admin can update advertisements"
  ON advertisements FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
  );

CREATE POLICY "Super admin can delete advertisements"
  ON advertisements FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
  );

-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update viewer count
CREATE OR REPLACE FUNCTION update_event_viewer_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE events
  SET viewer_count = (
    SELECT COUNT(DISTINCT device_id)
    FROM live_viewers
    WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    AND last_seen > now() - interval '30 seconds'
  )
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to update viewer count
CREATE TRIGGER update_viewer_count_on_join
  AFTER INSERT OR UPDATE OR DELETE ON live_viewers
  FOR EACH ROW
  EXECUTE FUNCTION update_event_viewer_count();

-- Function to check if user can start stream
CREATE OR REPLACE FUNCTION can_start_stream(event_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  event_start TIMESTAMPTZ;
  user_role TEXT;
  event_artist UUID;
BEGIN
  -- Get event details
  SELECT start_time, artist_id INTO event_start, event_artist
  FROM events WHERE id = event_uuid;
  
  -- Get user role
  SELECT user_type INTO user_role
  FROM profiles WHERE id = auth.uid();
  
  -- Super admin can always start
  IF user_role = 'super_admin' THEN
    RETURN true;
  END IF;
  
  -- Admin can always start
  IF user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Artist can start 5 minutes before event
  IF user_role = 'artist' AND event_artist = auth.uid() THEN
    RETURN event_start <= now() + interval '5 minutes';
  END IF;
  
  RETURN false;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- ========================================
-- INITIAL DATA
-- ========================================

-- Insert categories including Magraheb
INSERT INTO categories (name, type, icon) VALUES
  ('African', 'region', '🌍'),
  ('European', 'region', '🇪🇺'),
  ('Asian', 'region', '🌏'),
  ('American', 'region', '🌎'),
  ('Magraheb', 'region', '🌙'),
  ('Music', 'type', '🎵'),
  ('Comedy', 'type', '😂'),
  ('Talk Show', 'type', '🎤'),
  ('Pop', 'genre', '🎧'),
  ('Afrobeats', 'genre', '🥁'),
  ('Rock', 'genre', '🎸'),
  ('Hip Hop', 'genre', '🎤'),
  ('Stand-up Comedy', 'genre', '🎭'),
  ('Jazz', 'genre', '🎷')
ON CONFLICT (name) DO NOTHING;

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('advertisements', 'advertisements', true)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- STORAGE POLICIES
-- ========================================

-- Profile photos (avatars)
CREATE POLICY "Users can upload their own profile photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can update their own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete their own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'avatars' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Cover photos
CREATE POLICY "Users can upload their own cover photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'covers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can update their own cover photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'covers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete their own cover photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles' AND
  (storage.foldername(name))[1] = 'covers' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Super admin can manage ALL photos
CREATE POLICY "Super admin can upload any photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
);

CREATE POLICY "Super admin can update any photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
);

CREATE POLICY "Super admin can delete any photo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
);

-- Public read access to profile photos
CREATE POLICY "Profile photos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'profiles');

-- Event images
CREATE POLICY "Artists can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'events' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('artist', 'admin', 'super_admin'))
);

CREATE POLICY "Public can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'events');

-- Advertisements
CREATE POLICY "Super admin can upload advertisements"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'advertisements' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'super_admin')
);

CREATE POLICY "Public can view advertisements"
ON storage.objects FOR SELECT
USING (bucket_id = 'advertisements');