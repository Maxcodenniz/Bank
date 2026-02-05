-- Add payment info visibility config
INSERT INTO public.app_config (key, value, description)
VALUES 
  ('payment_info_visible', 'true'::jsonb, 'Enable/disable payment information section for artists')
ON CONFLICT (key) DO NOTHING;




