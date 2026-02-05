/*
  # Add Maghreb to Region Constraint
  
  This migration updates the region check constraint in the profiles table
  to include 'Maghreb' as a valid region option.
  
  1. Changes
    - Drop existing region check constraint
    - Recreate constraint with 'Maghreb' included
    - Valid regions: 'African', 'European', 'American', 'Asian', 'Maghreb', 'Other'
*/

-- Drop the existing region constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_region_check;

-- Recreate the constraint with Maghreb included
ALTER TABLE profiles
ADD CONSTRAINT profiles_region_check 
CHECK (region IS NULL OR region IN ('African', 'European', 'American', 'Asian', 'Maghreb', 'Other'));

COMMENT ON CONSTRAINT profiles_region_check ON profiles IS 
  'Ensures region is one of: African, European, American, Asian, Maghreb, or Other (or NULL for non-artists)';
