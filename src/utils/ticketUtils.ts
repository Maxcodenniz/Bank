import { supabase } from '../lib/supabaseClient';

/**
 * Extract error message from Supabase function error response
 * @param error - The error object from supabase.functions.invoke()
 * @returns string - The extracted error message
 */
export function extractFunctionError(error: any): string {
  // Default error message
  let errorMessage = 'Failed to create checkout session. Please try again.';
  
  // Check error.context for response body (Supabase functions error structure)
  if (error.context?.body) {
    try {
      const errorBody = typeof error.context.body === 'string' 
        ? JSON.parse(error.context.body) 
        : error.context.body;
      if (errorBody?.error) {
        errorMessage = errorBody.error;
      }
    } catch (e) {
      console.warn('Could not parse error body:', e);
    }
  }
  
  // Also check error.context.message or error.context.data
  if (error.context?.message && errorMessage.includes('Failed to create checkout session')) {
    errorMessage = error.context.message;
  }
  if (error.context?.data?.error && errorMessage.includes('Failed to create checkout session')) {
    errorMessage = error.context.data.error;
  }
  
  // Handle specific error types
  if (error.message) {
    if (error.message.includes('Function not found') || error.message.includes('Failed to send')) {
      errorMessage = 'Payment service is temporarily unavailable. Please try again later or contact support.';
    } else if (errorMessage.includes('Failed to create checkout session') && !errorMessage.includes(error.message)) {
      // Only use error.message if we haven't found a better message from the body
      if (!error.context?.body) {
        errorMessage = error.message;
      }
    }
  }
  
  return errorMessage;
}

/**
 * Check if a user has an active ticket for an event
 * @param eventId - The event ID to check
 * @param userId - The user ID (optional, for logged-in users)
 * @param email - The email address (optional, for guest users)
 * @returns Promise<boolean> - True if user has an active ticket
 */
export async function hasActiveTicket(
  eventId: string,
  userId?: string | null,
  email?: string | null
): Promise<boolean> {
  try {
    console.log('🔍 Checking for active ticket:', { eventId, userId, email });
    
    if (userId) {
      // Check by user ID for logged-in users
      const { data, error } = await supabase
        .from('tickets')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      console.log('🔍 Ticket check result (by user ID):', { data, error, hasTicket: !!data });

      if (error) {
        console.error('❌ Error checking ticket by user ID:', error);
        return false;
      }

      return !!data;
    } else if (email) {
      // Check by email for guest users
      const normalizedEmail = email.toLowerCase().trim();
      const { data, error } = await supabase
        .from('tickets')
        .select('id')
        .eq('event_id', eventId)
        .ilike('email', normalizedEmail)
        .eq('status', 'active')
        .maybeSingle();

      console.log('🔍 Ticket check result (by email):', { data, error, hasTicket: !!data });

      if (error) {
        console.error('❌ Error checking ticket by email:', error);
        return false;
      }

      return !!data;
    }

    return false;
  } catch (error) {
    console.error('Error in hasActiveTicket:', error);
    return false;
  }
}

/**
 * Check if a user has active tickets for multiple events
 * @param eventIds - Array of event IDs to check
 * @param userId - The user ID (optional, for logged-in users)
 * @param email - The email address (optional, for guest users)
 * @returns Promise<string[]> - Array of event IDs that the user already has tickets for
 */
export async function getEventsWithTickets(
  eventIds: string[],
  userId?: string | null,
  email?: string | null
): Promise<string[]> {
  try {
    if (eventIds.length === 0) return [];

    if (userId) {
      // Check by user ID for logged-in users
      const { data, error } = await supabase
        .from('tickets')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) {
        console.error('Error checking tickets by user ID:', error);
        return [];
      }

      return data?.map(t => t.event_id) || [];
    } else if (email) {
      // Check by email for guest users
      const normalizedEmail = email.toLowerCase().trim();
      const { data, error } = await supabase
        .from('tickets')
        .select('event_id')
        .in('event_id', eventIds)
        .ilike('email', normalizedEmail)
        .eq('status', 'active');

      if (error) {
        console.error('Error checking tickets by email:', error);
        return [];
      }

      return data?.map(t => t.event_id) || [];
    }

    return [];
  } catch (error) {
    console.error('Error in getEventsWithTickets:', error);
    return [];
  }
}

