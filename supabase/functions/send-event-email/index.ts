import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import sgMail from "npm:@sendgrid/mail@8.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const handleError = (error: any, status = 500) => {
  console.error("Error in send-event-email function:", error);
  
  let errorMessage = "An unexpected error occurred";
  let errorDetails = error.message;

  if (error.response?.body?.errors?.[0]?.message) {
    errorDetails = error.response.body.errors[0].message;
  } else if (error instanceof TypeError && error.message.includes("fetch")) {
    errorMessage = "Network error while sending email";
    errorDetails = "Please check your network connection and try again";
  }

  return new Response(
    JSON.stringify({ 
      error: errorMessage,
      details: errorDetails
    }),
    { 
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    }
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, eventTitle, streamUrl, startTime, duration } = await req.json();

    if (!email || !eventTitle || !streamUrl || !startTime || !duration) {
      return handleError(new Error("Missing required parameters"), 400);
    }

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    if (!SENDGRID_API_KEY) {
      return handleError(new Error("SendGrid API key not configured"));
    }

    sgMail.setApiKey(SENDGRID_API_KEY);

    const formattedDate = new Date(startTime).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const emailContent = `
      <h2>Your Event is Scheduled!</h2>
      <p>Hello,</p>
      <p>Your event "${eventTitle}" has been scheduled successfully.</p>
      <p><strong>Event Details:</strong></p>
      <ul>
        <li>Date and Time: ${formattedDate}</li>
        <li>Duration: ${duration} minutes</li>
      </ul>
      <p>When it's time for your event, click the link below to start streaming:</p>
      <p><a href="${streamUrl}">${streamUrl}</a></p>
      <p>Please save this link - you'll need it to access your streaming studio.</p>
      <p>Best regards,<br>DREEMYSTAR Team</p>
    `;

    const msg = {
      to: email,
      from: Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@dreemystar.com",
      subject: `Event Scheduled: ${eventTitle}`,
      html: emailContent,
    };

    try {
      await sgMail.send(msg);
    } catch (sendGridError) {
      return handleError(sendGridError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    return handleError(error);
  }
});