/*
  # Add test admin account
  
  1. Changes
    - Create test admin user in auth.users
    - Create corresponding admin profile
    
  2. Security
    - Sets known password for testing
    - Account has global_admin privileges
*/

-- Create test admin user in auth.users
DO $$
DECLARE
  test_admin_id uuid := gen_random_uuid();
BEGIN
  -- Insert test admin user
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  ) VALUES (
    test_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'testadmin@dreemystar.com',
    crypt('TestAdmin123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated'
  );

  -- Create test admin profile
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    user_type,
    created_at,
    updated_at
  ) VALUES (
    test_admin_id,
    'testadmin',
    'Test Administrator',
    'global_admin',
    now(),
    now()
  );
END $$;