-- Allow artists to view rows in favorite_artists where they are the artist (their followers)
CREATE POLICY "Artists can view their followers"
  ON favorite_artists
  FOR SELECT
  TO authenticated
  USING (artist_id = auth.uid());
