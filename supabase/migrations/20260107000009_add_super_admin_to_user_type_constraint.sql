-- Add super_admin to the user_type CHECK constraint
-- The constraint currently only allows: 'fan', 'artist', 'global_admin'
-- We need to add 'super_admin' to allow role promotions

-- Drop the existing constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_type_check;

-- Recreate with super_admin included
ALTER TABLE profiles 
ADD CONSTRAINT profiles_user_type_check 
CHECK (user_type = ANY (ARRAY['fan'::text, 'artist'::text, 'global_admin'::text, 'super_admin'::text]));

COMMENT ON CONSTRAINT profiles_user_type_check ON profiles IS 
  'Ensures user_type is one of: fan, artist, global_admin, or super_admin';



