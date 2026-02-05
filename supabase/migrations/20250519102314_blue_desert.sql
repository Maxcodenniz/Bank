/*
  # Fix admin user setup
  
  1. Changes
    - Remove existing admin user and profile
    - Allow creation through sign-up form
    
  2. Notes
    - Handles foreign key constraints properly
    - New admin should sign up with:
      Email: admin@dreemystar.com
      Password: Admin123!
*/

-- Remove existing admin data in correct order
DELETE FROM public.profiles WHERE username = 'admin';
DELETE FROM auth.users WHERE email = 'admin@dreemystar.com';

-- The admin user will be created through the sign-up form
-- Email: admin@dreemystar.com
-- Password: Admin123!