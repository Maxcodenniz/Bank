-- Clean up any duplicate app_config records
-- Keep only the most recent record for each key

-- First, identify duplicates
DO $$
DECLARE
  duplicate_key TEXT;
BEGIN
  -- Find keys with multiple records
  FOR duplicate_key IN 
    SELECT key 
    FROM public.app_config 
    GROUP BY key 
    HAVING COUNT(*) > 1
  LOOP
    -- Delete all but the most recent record for this key
    DELETE FROM public.app_config
    WHERE key = duplicate_key
    AND id NOT IN (
      SELECT id 
      FROM public.app_config 
      WHERE key = duplicate_key 
      ORDER BY updated_at DESC, created_at DESC 
      LIMIT 1
    );
    
    RAISE NOTICE 'Cleaned up duplicates for key: %', duplicate_key;
  END LOOP;
END $$;

-- Ensure we have the default records
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('artist_login_enabled', 'true'::jsonb, 'Enable/disable artist signup option'),
  ('live_chat_enabled', 'true'::jsonb, 'Enable/disable chat in live events')
ON CONFLICT (key) DO NOTHING;





