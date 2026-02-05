/*
  # Add Advertisement Home Visibility Config
  
  1. Changes
    - Add configuration flag to control advertisement visibility on home page
    - Default value is true (advertisements enabled by default)
  
  2. Security
    - Only super admins can update this config (via existing RLS policies)
*/

-- Add advertisement home visibility config
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('advertisements_home_enabled', 'true'::jsonb, 'Enable/disable advertisements on the home page')
ON CONFLICT (key) DO NOTHING;



