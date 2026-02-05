-- Allow artists to delete their own gallery media (and super_admin)
-- Table artist_media is assumed to exist (created elsewhere or manually)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'artist_media') THEN
    ALTER TABLE public.artist_media ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Artists delete own media" ON public.artist_media;
    CREATE POLICY "Artists delete own media"
      ON public.artist_media
      FOR DELETE
      TO authenticated
      USING (
        artist_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'super_admin')
      );
  END IF;
END $$;
