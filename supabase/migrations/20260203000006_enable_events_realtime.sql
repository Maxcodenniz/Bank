-- Enable real-time replication for events table
-- So that like_count and viewer_count updates are broadcast to all subscribers (viewers + streamer)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
      AND tablename = 'events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE events;
    END IF;
  END IF;
END $$;
