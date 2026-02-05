import { supabase } from '../lib/supabaseClient';

export type AuthAction = 
  | 'login_success' 
  | 'login_failed' 
  | 'logout' 
  | 'password_reset_request' 
  | 'password_reset_success' 
  | 'account_locked' 
  | 'account_unlocked';

interface LogAuthEventParams {
  email: string;
  action: AuthAction;
  success: boolean;
  userId?: string | null;
  failureReason?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Log authentication events to the auth_logs table
 * This function can be called even for failed logins (when user_id is null)
 */
export async function logAuthEvent({
  email,
  action,
  success,
  userId = null,
  failureReason = null,
  metadata = {}
}: LogAuthEventParams): Promise<void> {
  try {
    // Get IP address and user agent
    const ipAddress = await getClientIP();
    const userAgent = navigator.userAgent;

    // Call the database function to insert the log
    // This function has SECURITY DEFINER so it can be called even for failed logins
    const { error } = await supabase.rpc('insert_auth_log', {
      p_email: email.toLowerCase().trim(),
      p_action: action,
      p_success: success,
      p_user_id: userId,
      p_ip_address: ipAddress,
      p_user_agent: userAgent,
      p_failure_reason: failureReason,
      p_metadata: metadata
    });

    if (error) {
      // Don't throw error - logging failures shouldn't break the app
      console.error('Failed to log auth event:', error);
    }
  } catch (err) {
    // Silently fail - don't break authentication flow if logging fails
    console.error('Error logging auth event:', err);
  }
}

/**
 * Get client IP address
 * In production, this would typically come from a server-side API
 * For now, we'll use a placeholder or try to get it from headers if available
 */
async function getClientIP(): Promise<string | null> {
  try {
    // Try to get IP from a service (optional)
    // For now, return null - IP can be captured server-side if needed
    return null;
  } catch {
    return null;
  }
}



