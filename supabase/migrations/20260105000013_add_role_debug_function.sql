/*
  # Add Role Debug Function
  
  This function helps debug what role is being used for requests
*/

-- Create function to get current request role
CREATE OR REPLACE FUNCTION public.get_request_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_claims JSONB;
BEGIN
  -- Try to get role from JWT claims
  BEGIN
    v_claims := current_setting('request.jwt.claims', true)::jsonb;
    v_role := v_claims->>'role';
    
    IF v_role IS NULL THEN
      -- If no role in claims, check if we're using anon key
      -- Anon requests should have role = 'anon' or no role set
      v_role := COALESCE(v_role, 'anon');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- If setting doesn't exist, we're likely anon
    v_role := 'anon';
  END;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_request_role() TO anon, authenticated;

-- Create a test function that shows role and attempts insert
CREATE OR REPLACE FUNCTION public.test_callback_insert_debug(
  p_phone_number TEXT,
  p_email TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get current role
  v_role := public.get_request_role();
  
  -- Get user ID if authenticated
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;
  
  -- Try to insert
  BEGIN
    INSERT INTO public.callback_requests (phone_number, email, user_id)
    VALUES (p_phone_number, p_email, v_user_id);
    
    v_result := jsonb_build_object(
      'success', true,
      'role', v_role,
      'user_id', v_user_id,
      'message', 'Insert successful'
    );
  EXCEPTION WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'role', v_role,
      'user_id', v_user_id,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
  END;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.test_callback_insert_debug(TEXT, TEXT) TO anon, authenticated;






