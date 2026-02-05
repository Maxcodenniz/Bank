/*
  # Complete DREEMYSTAR Schema with Enhanced Viewer Tracking
  
  1. New Tables
    - profiles (user profiles with roles)
    - events (live events/concerts)
    - tickets (purchased tickets)
    - categories (event categories)
    - event_categories (junction table)
    - viewer_sessions (enhanced viewer tracking with session management)
    - notifications (in-app notifications)
    - advertisements (banner ads)
    
  2. Viewer Tracking Features
    - Device fingerprinting for unique viewer counts
    - Session management with join/leave tracking
    - Active/inactive status tracking
    - Automatic stale session cleanup
    - Real-time viewer count updates
    
  3. Security
    - RLS enabled on all tables
    - Public read access for viewer counts
    - Authenticated users can manage their sessions
*/

-- Create profiles table
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
  duration INTEGER NOT NULL,
  price DECIMAL DEFAULT 1.00,
  is_free BOOLEAN DEFAULT false,
  image_url TEXT,
  banner_url TEXT,
  stream_url TEXT,
  channel_name TEXT,
  status TEXT CHECK (status IN ('scheduled', 'upcoming', 'live', 'ended')) DEFAULT 'scheduled',
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

-- Create categories table
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

-- Create viewer_sessions table for enhanced tracking
CREATE TABLE IF NOT EXISTS viewer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now(),
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

-- Create advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  width INTEGER NOT NULL CHECK (width >= 1200),
  height INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles viewable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Events policies
CREATE POLICY "Events viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Artists create events" ON events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('artist', 'admin', 'super_admin')));
CREATE POLICY "Artists update own events" ON events FOR UPDATE TO authenticated
  USING (artist_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin')));

-- Tickets policies
CREATE POLICY "Users view own tickets" ON tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin')));
CREATE POLICY "Users purchase tickets" ON tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Viewer sessions policies (key for viewer counting)
CREATE POLICY "Viewer sessions readable by everyone" ON viewer_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create viewer sessions" ON viewer_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update viewer sessions" ON viewer_sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete viewer sessions" ON viewer_sessions FOR DELETE USING (true);

-- Categories policies
CREATE POLICY "Categories viewable by everyone" ON categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'super_admin')));

-- Event categories policies
CREATE POLICY "Event categories viewable" ON event_categories FOR SELECT USING (true);

-- Notifications policies
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System creates notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);

-- Advertisements policies
CREATE POLICY "Active ads viewable" ON advertisements FOR SELECT USING (active = true);

-- Functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Viewer tracking functions
CREATE OR REPLACE FUNCTION get_active_viewer_count(event_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT device_id)
    FROM viewer_sessions
    WHERE viewer_sessions.event_id = get_active_viewer_count.event_id
      AND is_active = true
      AND last_seen > now() - interval '2 minutes'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_stale_viewer_sessions(
  event_id UUID,
  stale_threshold INTEGER DEFAULT 120
)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE viewer_sessions
  SET is_active = false,
      left_at = COALESCE(left_at, now())
  WHERE viewer_sessions.event_id = cleanup_stale_viewer_sessions.event_id
    AND is_active = true
    AND last_seen < now() - (stale_threshold || ' seconds')::interval;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_event_viewer_count_from_sessions()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT device_id)
  INTO active_count
  FROM viewer_sessions
  WHERE event_id = COALESCE(NEW.event_id, OLD.event_id)
    AND is_active = true
    AND last_seen > now() - interval '2 minutes';
  
  UPDATE events
  SET viewer_count = active_count
  WHERE id = COALESCE(NEW.event_id, OLD.event_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_viewer_count_on_session_change
  AFTER INSERT OR UPDATE OR DELETE ON viewer_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_event_viewer_count_from_sessions();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_event_active ON viewer_sessions(event_id, is_active, last_seen);
CREATE INDEX IF NOT EXISTS idx_viewer_sessions_device ON viewer_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_tickets_user_event ON tickets(user_id, event_id);

-- Initial data
INSERT INTO categories (name, type, icon) VALUES
  ('African', 'region', '🌍'),
  ('European', 'region', '🇪🇺'),
  ('Asian', 'region', '🌏'),
  ('American', 'region', '🌎'),
  ('Magraheb', 'region', '🌙'),
  ('Music', 'type', '🎵'),
  ('Comedy', 'type', '😂'),
  ('Pop', 'genre', '🎧'),
  ('Rock', 'genre', '🎸'),
  ('Hip Hop', 'genre', '🎤'),
  ('Jazz', 'genre', '🎷')
ON CONFLICT (name) DO NOTHING;