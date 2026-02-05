-- Fix app_config table: Add missing description column if it doesn't exist
-- This should be run BEFORE the other migrations if the table already exists

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'app_config'
  ) THEN
    -- Table exists, check if description column is missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'app_config' 
      AND column_name = 'description'
    ) THEN
      ALTER TABLE public.app_config ADD COLUMN description TEXT;
    END IF;
    
    -- Ensure other columns exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'app_config' 
      AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.app_config ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'app_config' 
      AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.app_config ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;






