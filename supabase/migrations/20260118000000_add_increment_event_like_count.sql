-- Allow clients to increment event like_count without direct events update
CREATE OR REPLACE FUNCTION increment_event_like_count(event_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE events
  SET like_count = COALESCE(like_count, 0) + 1
  WHERE id = event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_event_like_count(UUID) TO anon, authenticated;
