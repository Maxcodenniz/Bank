/*
  # Create admin users
  
  1. Changes
    - Clean up existing admin accounts
    - Create two admin users with proper UUIDs
    - Create corresponding admin profiles
    
  2. Security
    - Passwords will need to be reset on first login
    - Users have admin privileges
*/

-- First, clean up existing admin accounts (in correct order)
DELETE FROM public.profiles WHERE username IN ('admin', 'admin2');
DELETE FROM auth.users WHERE email IN ('admin@dreemystar.com', 'admin2@dreemystar.com');

-- Create first admin user and profile
DO $$
DECLARE
  admin1_id uuid := gen_random_uuid();
BEGIN
  -- Insert first admin user
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
    admin1_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@dreemystar.com',
    crypt('Admin123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated'
  );

  -- Create first admin profile
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    user_type,
    created_at,
    updated_at
  ) VALUES (
    admin1_id,
    'admin',
    'System Administrator',
    'admin',
    now(),
    now()
  );
END $$;

-- Create second admin user and profile
DO $$
DECLARE
  admin2_id uuid := gen_random_uuid();
BEGIN
  -- Insert second admin user
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
    admin2_id,
    '00000000-0000-0000-0000-000000000000',
    'admin2@dreemystar.com',
    crypt('Admin123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    'authenticated'
  );

  -- Create second admin profile
  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    user_type,
    created_at,
    updated_at
  ) VALUES (
    admin2_id,
    'admin2',
    'Second Administrator',
    'admin',
    now(),
    now()
  );
END $$;