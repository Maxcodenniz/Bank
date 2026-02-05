-- Super Admin only: reset functions for Analytics & Logs
-- These RPCs allow super admins to reset Total Revenue, Total Tickets,
-- Successful Logins, Failed Logins, Logouts, and Recent Activity (auth_logs).

-- 1) Reset Total Revenue & Total Tickets: delete all tickets
CREATE OR REPLACE FUNCTION reset_analytics_tickets()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can reset tickets';
  END IF;

  WITH deleted AS (
    DELETE FROM public.tickets
    WHERE true
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO deleted_count FROM deleted;

  RETURN jsonb_build_object('success', true, 'deleted_tickets', deleted_count);
END;
$$;

-- 2) Reset Successful Logins: delete auth_logs where action = 'login_success'
CREATE OR REPLACE FUNCTION reset_auth_logs_successful_logins()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can reset auth logs';
  END IF;

  WITH deleted AS (
    DELETE FROM public.auth_logs WHERE action = 'login_success' RETURNING id
  )
  SELECT COUNT(*)::INT INTO deleted_count FROM deleted;

  RETURN jsonb_build_object('success', true, 'deleted', deleted_count);
END;
$$;

-- 3) Reset Failed Logins
CREATE OR REPLACE FUNCTION reset_auth_logs_failed_logins()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can reset auth logs';
  END IF;

  WITH deleted AS (
    DELETE FROM public.auth_logs WHERE action = 'login_failed' RETURNING id
  )
  SELECT COUNT(*)::INT INTO deleted_count FROM deleted;

  RETURN jsonb_build_object('success', true, 'deleted', deleted_count);
END;
$$;

-- 4) Reset Logouts
CREATE OR REPLACE FUNCTION reset_auth_logs_logouts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can reset auth logs';
  END IF;

  WITH deleted AS (
    DELETE FROM public.auth_logs WHERE action = 'logout' RETURNING id
  )
  SELECT COUNT(*)::INT INTO deleted_count FROM deleted;

  RETURN jsonb_build_object('success', true, 'deleted', deleted_count);
END;
$$;

-- 5) Reset Recent Activity: delete all auth_logs (clears auth-related activity)
CREATE OR REPLACE FUNCTION reset_auth_logs_recent_activity()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Only super admins can reset recent activity';
  END IF;

  WITH deleted AS (
    DELETE FROM public.auth_logs
    WHERE true
    RETURNING id
  )
  SELECT COUNT(*)::INT INTO deleted_count FROM deleted;

  RETURN jsonb_build_object('success', true, 'deleted', deleted_count);
END;
$$;

GRANT EXECUTE ON FUNCTION reset_analytics_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_auth_logs_successful_logins() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_auth_logs_failed_logins() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_auth_logs_logouts() TO authenticated;
GRANT EXECUTE ON FUNCTION reset_auth_logs_recent_activity() TO authenticated;
