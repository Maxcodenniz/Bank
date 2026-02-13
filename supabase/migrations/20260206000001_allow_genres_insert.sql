-- Allow artists to add new genres when creating account or editing profile.
-- INSERT is allowed for anon (signup) and authenticated so new genres are stored in DB.

CREATE POLICY "Anyone can insert genres"
  ON genres FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
