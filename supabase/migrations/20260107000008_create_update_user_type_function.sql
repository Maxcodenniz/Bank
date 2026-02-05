-- Create RPC function for super admins to update user types
-- This bypasses RLS issues and ensures proper permission checking
CREATE OR REPLACE FUNCTION update_user_type(
  target_user_id UUID,
  new_user_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_type TEXT;
  target_user_type TEXT;
BEGIN
  -- Get current user's type
  SELECT user_type INTO current_user_type
  FROM public.profiles
  WHERE id = auth.uid();

  -- Get target user's current type
  SELECT user_type INTO target_user_type
  FROM public.profiles
  WHERE id = target_user_id;

  -- Check if current user is super admin (by user_type or protected ID)
  IF NOT (
    current_user_type = 'super_admin' 
    OR auth.uid() = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid
  ) THEN
    RAISE EXCEPTION 'Only super admins can update user types';
  END IF;

  -- Prevent changing the protected super admin's role
  IF target_user_id = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8'::uuid THEN
    RAISE EXCEPTION 'Cannot modify the protected super admin role';
  END IF;

  -- Validate new_user_type
  IF new_user_type NOT IN ('fan', 'artist', 'global_admin', 'super_admin') THEN
    RAISE EXCEPTION 'Invalid user type: %', new_user_type;
  END IF;

  -- Update the user type
  UPDATE public.profiles
  SET user_type = new_user_type,
      updated_at = NOW()
  WHERE id = target_user_id;

  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_type(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION update_user_type IS 
  'Allows super admins to update user types. Bypasses RLS for proper permission checking.';



