import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT_WINDOW = 5_000;
const rateMap = new Map<string, number>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const last = rateMap.get(key);
  if (last && now - last < RATE_LIMIT_WINDOW) return false;
  rateMap.set(key, now);
  return true;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function textResponse(text: string, status: number) {
  return new Response(text, {
    status,
    headers: { ...CORS_HEADERS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) return textResponse("rate limited", 429);

    const { type, record_id, team_id } = await req.json();
    console.log("notify called:", { type, record_id, team_id });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!saRaw) {
      console.error("FCM_SERVICE_ACCOUNT not set");
      return textResponse("no secret", 500);
    }

    let sa: any;
    try {
      sa = JSON.parse(saRaw);
    } catch (e) {
      console.error("FCM_SERVICE_ACCOUNT parse error:", e.message);
      return textResponse("bad secret", 500);
    }

    let memberIds: string[] | null = null;

    if (team_id) {
      const { data: members } = await supabase
        .from("team_members")
        .select("member_id")
        .eq("team_id", team_id);
      memberIds = (members ?? []).map((m: { member_id: string }) => m.member_id);
      if (memberIds.length === 0) {
        console.log("no members in team", team_id);
        return jsonResponse({ sent: 0, failed: 0 }, 200);
      }
    }

    let query = supabase.from("push_tokens").select("member_id, token");
    if (memberIds) {
      query = query.in("member_id", memberIds);
    }
    const { data: pushTokens, error: ptErr } = await query;

    if (ptErr) {
      console.error("push_tokens query error:", ptErr);
      return textResponse("db error", 500);
    }
    if (!pushTokens || pushTokens.length === 0) {
      console.log("no push tokens found");
      return jsonResponse({ sent: 0, failed: 0 }, 200);
    }
    console.log("push tokens found:", pushTokens.length);

    let title = "";
    let body = "";
    let data: Record<string, string> = { type, record_id };

    if (type === "notice") {
      const { data: notice, error: nErr } = await supabase
        .from("notices")
        .select("title, content")
        .eq("id", record_id)
        .single();
      if (nErr) console.error("notice fetch error:", nErr);
      title = "New Notice";
      body = notice?.title || "A new notice was posted";
    } else if (type === "update") {
      const { data: update, error: uErr } = await supabase
        .from("task_updates")
        .select("title")
        .eq("id", record_id)
        .single();
      if (uErr) console.error("update fetch error:", uErr);
      title = "New Update";
      body = update?.title || "A new update was posted";
    } else if (type === "task") {
      const { data: task, error: tErr } = await supabase
        .from("tasks")
        .select("title, description")
        .eq("id", record_id)
        .single();
      if (tErr) console.error("task fetch error:", tErr);
      title = "New Task Assigned";
      body = task?.title || "A new task was assigned";
    }

    const privateKey = sa.private_key;
    const raw = privateKey
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\r/g, "")
      .replace(/\n/g, "")
      .trim();
    const rawBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      "pkcs8",
      rawBytes,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const header = { alg: "RS256", typ: "JWT" };
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const b64url = (obj: unknown) => {
      const json = JSON.stringify(obj);
      const encoded = btoa(json);
      return encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    };

    const message = `${b64url(header)}.${b64url(jwtPayload)}`;
    const signature = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      new TextEncoder().encode(message)
    );
    const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const assertion = `${message}.${sigB64}`;

    console.log("requesting FCM access token...");
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("FCM OAuth error:", JSON.stringify(tokenData));
      return jsonResponse({ error: "oauth_error", detail: tokenData.error_description || tokenData.error }, 500);
    }
    const fcmToken = tokenData.access_token;
    console.log("got FCM access token");

    const projectId = sa.project_id;
    let sent = 0;
    let failed = 0;
    const errorDetails: string[] = [];

    for (const pt of pushTokens) {
      if (!pt.token) continue;
      try {
        const fcmRes = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${fcmToken}`,
            },
            body: JSON.stringify({
              message: {
                token: pt.token,
                notification: { title, body },
                data,
                android: {
                  priority: "HIGH",
                  notification: {
                    channel_id: "default",
                    sound: "default",
                  },
                },
              },
            }),
          }
        );
        if (fcmRes.ok) {
          sent++;
        } else {
          const errBody = await fcmRes.text();
          console.error("FCM send error for", pt.member_id, ":", fcmRes.status, errBody);
          if (errorDetails.length < 3) errorDetails.push(`HTTP ${fcmRes.status}: ${errBody.slice(0, 200)}`);
          failed++;
        }
      } catch (e: any) {
        console.error("FCM send exception for", pt.member_id, ":", e.message);
        if (errorDetails.length < 3) errorDetails.push(e.message);
        failed++;
      }
    }

    console.log(`FCM results: ${sent} sent, ${failed} failed`);
    return jsonResponse({ sent, failed, errors: errorDetails }, 200);
  } catch (e: any) {
    console.error("notify function error:", e.message, e.stack);
    return textResponse(e.message, 500);
  }
});
