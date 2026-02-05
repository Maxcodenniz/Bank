import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  // Log all incoming requests for debugging
  console.info('📧 Resend webhook function called');
  console.info('📧 Request method:', req.method);
  console.info('📧 Request URL:', req.url);
  console.info('📧 Request headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.info('📧 Handling OPTIONS (CORS preflight)');
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Resend-Signature',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      console.warn('⚠️ Invalid method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get raw body for potential signature verification
    const rawBody = await req.text();
    console.info('📧 Request body length:', rawBody.length);
    
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.info('📧 Resend webhook received:', {
      type: event.type,
      createdAt: event.created_at,
      data: event.data
    });

    // Handle different Resend webhook event types
    switch (event.type) {
      case 'email.sent':
        console.info('✅ Email sent successfully:', {
          emailId: event.data?.email_id,
          to: event.data?.to,
          subject: event.data?.subject
        });
        // You can update a database table here to track email status
        await handleEmailSent(event.data);
        break;

      case 'email.delivered':
        console.info('✅ Email delivered:', {
          emailId: event.data?.email_id,
          to: event.data?.to
        });
        await handleEmailDelivered(event.data);
        break;

      case 'email.delivery_delayed':
        console.warn('⚠️ Email delivery delayed:', {
          emailId: event.data?.email_id,
          to: event.data?.to,
          delayReason: event.data?.delay_reason
        });
        await handleEmailDelayed(event.data);
        break;

      case 'email.complained':
        console.warn('⚠️ Email complaint received:', {
          emailId: event.data?.email_id,
          to: event.data?.to
        });
        await handleEmailComplaint(event.data);
        break;

      case 'email.bounced':
        console.error('❌ Email bounced:', {
          emailId: event.data?.email_id,
          to: event.data?.to,
          bounceType: event.data?.bounce_type,
          bounceReason: event.data?.bounce_reason
        });
        await handleEmailBounced(event.data);
        break;

      case 'email.opened':
        console.info('📖 Email opened:', {
          emailId: event.data?.email_id,
          to: event.data?.to,
          openedAt: event.data?.opened_at
        });
        await handleEmailOpened(event.data);
        break;

      case 'email.clicked':
        console.info('🖱️ Email link clicked:', {
          emailId: event.data?.email_id,
          to: event.data?.to,
          link: event.data?.link
        });
        await handleEmailClicked(event.data);
        break;

      case 'email.unsubscribed':
        console.warn('📴 Email unsubscribed:', {
          emailId: event.data?.email_id,
          to: event.data?.to
        });
        await handleEmailUnsubscribed(event.data);
        break;

      default:
        console.info('ℹ️ Unknown Resend event type:', event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error: any) {
    console.error('❌ Error processing Resend webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

// Handler functions for different event types
async function handleEmailSent(data: any) {
  // Log email sent event
  // You can create a table to track email status if needed
  console.info('📧 Email sent event processed:', data.email_id);
}

async function handleEmailDelivered(data: any) {
  // Email was successfully delivered
  console.info('✅ Email delivered successfully:', data.email_id);
  
  // Optional: Update ticket or notification status in database
  // Example: Update a tickets table to mark email as delivered
  if (data.email_id) {
    // You could query tickets table by matching email and update status
    // This is just an example - adjust based on your schema
    console.info('📧 Email delivered to:', data.to);
  }
}

async function handleEmailDelayed(data: any) {
  // Email delivery is delayed
  console.warn('⚠️ Email delivery delayed:', {
    emailId: data.email_id,
    reason: data.delay_reason
  });
}

async function handleEmailComplaint(data: any) {
  // User marked email as spam
  console.warn('⚠️ Email complaint (spam):', data.email_id);
  
  // Optional: Update user preferences or mark email as problematic
}

async function handleEmailBounced(data: any) {
  // Email bounced (hard or soft bounce)
  console.error('❌ Email bounced:', {
    emailId: data.email_id,
    to: data.to,
    bounceType: data.bounce_type,
    reason: data.bounce_reason
  });
  
  // Optional: Update database to mark email as invalid
  // You might want to flag the email address as problematic
}

async function handleEmailOpened(data: any) {
  // User opened the email
  console.info('📖 Email opened:', {
    emailId: data.email_id,
    to: data.to,
    openedAt: data.opened_at
  });
  
  // Optional: Track engagement metrics
}

async function handleEmailClicked(data: any) {
  // User clicked a link in the email
  console.info('🖱️ Email link clicked:', {
    emailId: data.email_id,
    to: data.to,
    link: data.link
  });
  
  // Optional: Track which links are most popular
}

async function handleEmailUnsubscribed(data: any) {
  // User unsubscribed
  console.warn('📴 User unsubscribed:', {
    emailId: data.email_id,
    to: data.to
  });
  
  // Optional: Update user preferences in database
}

