-- Create function to handle profile creation from user metadata when email is confirmed
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
BEGIN
  -- Only process when email is confirmed (email_confirmed_at changes from NULL to a timestamp)
  IF NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at) THEN
    
    -- Check if profile already exists
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
      
      -- Extract pending_profile from raw_user_meta_data
      profile_data := NEW.raw_user_meta_data->'pending_profile';
      
      -- If pending_profile exists, create the profile
      IF profile_data IS NOT NULL THEN
        -- Extract values from JSONB
        profile_username := profile_data->>'username';
        profile_full_name := profile_data->>'full_name';
        profile_user_type := COALESCE(profile_data->>'user_type', 'fan');
        profile_artist_type := profile_data->>'artist_type';
        profile_country := profile_data->>'country';
        profile_region := profile_data->>'region';
        
        -- Validate user_type
        IF profile_user_type NOT IN ('fan', 'artist') THEN
          profile_user_type := 'fan';
        END IF;
        
        -- Validate region
        IF profile_region IS NOT NULL AND profile_region NOT IN ('African', 'European', 'American', 'Asian', 'Maghreb', 'Other') THEN
          profile_region := 'Other';
        END IF;
        
        -- Handle genres array
        IF profile_data->'genres' IS NOT NULL AND jsonb_typeof(profile_data->'genres') = 'array' THEN
          SELECT ARRAY(SELECT jsonb_array_elements_text(profile_data->'genres')) INTO profile_genres;
        ELSE
          profile_genres := NULL;
        END IF;
        
        -- Insert profile
        INSERT INTO public.profiles (
          id,
          username,
          full_name,
          user_type,
          artist_type,
          genres,
          country,
          region,
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
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING; -- Don't error if profile already exists
        
        RAISE NOTICE 'Profile created for user % with type %', NEW.id, profile_user_type;
      ELSE
        -- No pending_profile in metadata - create default fan profile
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

-- Create trigger that fires when email_confirmed_at is updated
DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL AND (OLD.email_confirmed_at IS NULL OR OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at))
  EXECUTE FUNCTION public.handle_new_user();
