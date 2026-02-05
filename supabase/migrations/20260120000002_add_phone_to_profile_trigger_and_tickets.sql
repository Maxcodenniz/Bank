-- Add phone to profile creation trigger and to tickets table

-- 1. Add phone column to tickets table (for purchase contact)
ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS phone TEXT;

COMMENT ON COLUMN tickets.phone IS 'Purchaser phone (E.164) for the ticket';

-- 2. Update handle_new_user to include phone from pending_profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  profile_data JSONB;
  profile_username TEXT;
  profile_full_name TEXT;
  profile_user_type TEXT;
  profile_artist_type TEXT;
  profile_genres TEXT[];
  profile_country TEXT;
  profile_region TEXT;
  profile_phone TEXT;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN

      profile_data := NEW.raw_user_meta_data->'pending_profile';

      IF profile_data IS NOT NULL THEN
        profile_username := profile_data->>'username';
        profile_full_name := profile_data->>'full_name';
        profile_user_type := COALESCE(profile_data->>'user_type', 'fan');
        profile_artist_type := profile_data->>'artist_type';
        profile_country := profile_data->>'country';
        profile_region := profile_data->>'region';
        profile_phone := profile_data->>'phone';

        IF profile_user_type NOT IN ('fan', 'artist') THEN
          profile_user_type := 'fan';
        END IF;

        IF profile_region IS NOT NULL AND profile_region NOT IN ('African', 'European', 'American', 'Asian', 'Maghreb', 'Other') THEN
          profile_region := 'Other';
        END IF;

        IF profile_data->'genres' IS NOT NULL AND jsonb_typeof(profile_data->'genres') = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(profile_data->'genres')) INTO profile_genres;
        ELSE
          profile_genres := NULL;
        END IF;

        INSERT INTO public.profiles (
          id,
          username,
          full_name,
          user_type,
          artist_type,
          genres,
          country,
          region,
          phone,
          created_at,
          updated_at
        ) VALUES (
          NEW.id,
          profile_username,
          profile_full_name,
          profile_user_type,
          profile_artist_type,
          profile_genres,
          profile_country,
          profile_region,
          profile_phone,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Profile created for user % with type %', NEW.id, profile_user_type;
      ELSE
        INSERT INTO public.profiles (
          id,
          username,
          full_name,
          user_type,
          created_at,
          updated_at
        ) VALUES (
          NEW.id,
          NULL,
          NULL,
          'fan',
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Default fan profile created for user %', NEW.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
