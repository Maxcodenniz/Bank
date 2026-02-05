/*
  # Fix admin accounts setup
  
  1. Changes
    - Reset passwords for both admin accounts
    - Ensure admin profiles exist with correct user_type
    
  2. Security
    - Sets known passwords that can be used immediately
    - Maintains existing admin privileges
*/

-- Reset password for first admin
UPDATE auth.users 
SET encrypted_password = crypt('Admin123!', gen_salt('bf'))
WHERE email = 'admin@dreemystar.com';

-- Reset password for second admin
UPDATE auth.users 
SET encrypted_password = crypt('Admin123!', gen_salt('bf'))
WHERE email = 'admin2@dreemystar.com';

-- Ensure admin profiles exist with correct user_type
INSERT INTO public.profiles (id, username, full_name, user_type, created_at, updated_at)
SELECT 
  id,
  'admin',
  'System Administrator',
  'admin',
  now(),
  now()
FROM auth.users 
WHERE email = 'admin@dreemystar.com'
ON CONFLICT (id) DO UPDATE 
SET user_type = 'admin',
    updated_at = now();

INSERT INTO public.profiles (id, username, full_name, user_type, created_at, updated_at)
SELECT 
  id,
  'admin2',
  'Second Administrator',
  'admin',
  now(),
  now()
FROM auth.users 
WHERE email = 'admin2@dreemystar.com'
ON CONFLICT (id) DO UPDATE 
SET user_type = 'admin',
    updated_at = now();