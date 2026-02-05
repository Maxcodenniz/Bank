/*
  # Test RLS Policy with a Helper Function
  
  This creates a function that can be called to test if the RLS policy works
  from the client side.
*/

-- Create a function that returns the current role
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::json->>'role';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function that tests the callback insert (for debugging)
CREATE OR REPLACE FUNCTION public.test_callback_insert(
  p_phone_number TEXT,
  p_email TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_role TEXT;
  v_result JSONB;
BEGIN
  -- Get current role
  SELECT get_current_role() INTO v_role;
  
  -- Try to insert
  BEGIN
    INSERT INTO public.callback_requests (phone_number, email, user_id)
    VALUES (p_phone_number, p_email, p_user_id);
    
    v_result := jsonb_build_object(
      'success', true,
      'role', v_role,
      'message', 'Insert successful'
    );
  EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'role', v_role,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
  END;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_current_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.test_callback_insert(TEXT, TEXT, UUID) TO anon, authenticated;






