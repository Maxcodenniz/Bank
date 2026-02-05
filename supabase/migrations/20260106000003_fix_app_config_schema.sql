-- Fix app_config table schema if description column is missing
-- This migration ensures the table has all required columns

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.app_config ADD COLUMN description TEXT;
  END IF;
END $$;

-- Ensure all other columns exist
DO $$ 
BEGIN
  -- Add created_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.app_config ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Add updated_at if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config' 
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.app_config ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Recreate trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_app_config_updated_at ON public.app_config;

CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_app_config_updated_at();






