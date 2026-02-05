import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { WebSocket } from "npm:ws@8.13.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { streamKey, eventId } = await req.json();

    // Connect to OBS WebSocket (default port 4455)
    const ws = new WebSocket('ws://localhost:4455');

    return new Promise((resolve) => {
      ws.on('open', () => {
        // Authenticate with OBS (if needed)
        ws.send(JSON.stringify({
          "op": 6,
          "d": {
            "eventSubscriptions": 33
          }
        }));

        // Set up stream settings
        ws.send(JSON.stringify({
          "op": 8,
          "d": {
            "requestType": "SetStreamSettings",
            "requestData": {
              "type": "rtmp",
              "settings": {
                "server": "rtmp://stream.dreemystar.com/live",
                "key": streamKey
              }
            }
          }
        }));

        // Start streaming
        ws.send(JSON.stringify({
          "op": 8,
          "d": {
            "requestType": "StartStream",
            "requestData": {}
          }
        }));

        resolve(new Response(
          JSON.stringify({ connected: true }),
          { 
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        ));

        ws.close();
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        resolve(new Response(
          JSON.stringify({ error: "Failed to connect to OBS" }),
          { 
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        ));
      });
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});