-- Create second admin user in auth.users
INSERT INTO auth.users (
  id,
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
  gen_random_uuid(),
  'admin2@dreemystar.com',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated'
) ON CONFLICT DO NOTHING
RETURNING id;

-- Create admin profile
INSERT INTO public.profiles (
  id,
  username,
  full_name,
  user_type,
  created_at,
  updated_at
)
SELECT 
  id,
  'admin2',
  'Second Administrator',
  'admin',
  now(),
  now()
FROM auth.users
WHERE email = 'admin2@dreemystar.com'
ON CONFLICT DO NOTHING;