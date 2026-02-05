import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { RtcTokenBuilder, RtcRole } from "npm:agora-token@2.0.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("🔧 Agora Token Service Starting...");

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed. Use POST request." }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    const channelName = body?.channelName ?? null;
    const role = body?.role ?? "publisher";
    const expireTime = Number(body?.expireTime ?? 3600);
    const uid = body?.uid ?? null;
    const account = body?.account ?? null;

    if (!channelName || typeof channelName !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid parameter: channelName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const AGORA_APP_ID = Deno.env.get("AGORA_APP_ID") || Deno.env.get("VITE_AGORA_APP_ID");
    const AGORA_APP_CERTIFICATE = Deno.env.get("AGORA_APP_CERTIFICATE") || Deno.env.get("VITE_AGORA_APP_CERTIFICATE");

    console.log("Environment check:", {
      hasAppId: !!AGORA_APP_ID,
      hasCertificate: !!AGORA_APP_CERTIFICATE,
      channelName,
      role,
      uidProvided: uid !== null,
      accountProvided: account !== null,
    });

    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      return new Response(JSON.stringify({ error: "AGORA_APP_ID or AGORA_APP_CERTIFICATE not set in env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (AGORA_APP_ID.length < 10 || AGORA_APP_CERTIFICATE.length < 10) {
      console.warn("AGORA keys look unusually short — verify environment variables.");
    }

    const agoraRole = (role === "publisher" || role === "host") ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + Math.max(60, expireTime);

    let token: string;

    if (account && typeof account === "string") {
      token = RtcTokenBuilder.buildTokenWithAccount(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        account,
        agoraRole,
        privilegeExpireTime
      );
      console.log("✅ Token generated with Account", { channelName, account, role });
    } else if (uid !== null && (typeof uid === "number" || !Number.isNaN(Number(uid)))) {
      const numericUid = Number(uid);
      token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        numericUid,
        agoraRole,
        privilegeExpireTime
      );
      console.log("✅ Token generated with UID", { channelName, uid: numericUid, role });
    } else {
      token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        0,
        agoraRole,
        privilegeExpireTime
      );
      console.log("⚠️ Token generated for UID 0 (recommended: send uid from client).", { channelName, role });
    }

    const payload = { token, appId: AGORA_APP_ID, ttl: privilegeExpireTime };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ Token generation error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
