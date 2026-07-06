import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RATE_LIMIT_WINDOW = 10_000;
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return textResponse("no auth", 401);
    const token = authHeader.replace("Bearer ", "");

    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) return textResponse("rate limited", 429);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return textResponse("unauthorized", 401);

    const { action, payload } = await req.json();

    if (action === "delete_account") {
      if (user.id !== payload.userId) return textResponse("forbidden", 403);

      await supabase.from("push_tokens").delete().eq("member_id", payload.userId);
      await supabase.from("task_updates").delete().eq("posted_by", payload.userId);
      await supabase.from("tasks").update({ claimed_by: null }).eq("claimed_by", payload.userId);
      await supabase.from("team_members").delete().eq("member_id", payload.userId);
      await supabase.from("join_requests").delete().eq("user_id", payload.userId);
      await supabase.from("team_requests").delete().eq("requested_by", payload.userId);
      await supabase.from("tasks").delete().eq("created_by", payload.userId);
      await supabase.from("members").delete().eq("id", payload.userId);

      const adminRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/auth/v1/admin/users/${payload.userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!adminRes.ok) console.error("auth delete error:", await adminRes.text());

      return jsonResponse({ ok: true }, 200);
    }

    if (action === "remove_member") {
      await supabase.from("team_members").delete()
        .eq("member_id", payload.memberId)
        .eq("team_id", payload.teamId);
      return jsonResponse({ ok: true }, 200);
    }

    if (action === "clear_all_tasks") {
      await supabase.from("task_assignees").delete().neq("task_id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("task_updates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return jsonResponse({ ok: true }, 200);
    }

    if (action === "delete_notice") {
      const { data: notice } = await supabase.from("notices").select("created_by").eq("id", payload.noticeId).single();
      if (!notice || notice.created_by !== user.id) return textResponse("forbidden", 403);
      await supabase.from("notice_views").delete().eq("notice_id", payload.noticeId);
      await supabase.from("notices").delete().eq("id", payload.noticeId);
      return jsonResponse({ ok: true }, 200);
    }

    if (action === "delete_update") {
      const { data: update } = await supabase.from("task_updates").select("posted_by").eq("id", payload.updateId).single();
      if (!update || update.posted_by !== user.id) return textResponse("forbidden", 403);
      await supabase.from("update_views").delete().eq("update_id", payload.updateId);
      await supabase.from("task_updates").delete().eq("id", payload.updateId);
      return jsonResponse({ ok: true }, 200);
    }

    if (action === "delete_team") {
      const teamId = payload.teamId as string;
      const { data: tasks } = await supabase.from("tasks").select("id").eq("assigned_team_id", teamId);
      const taskIds = (tasks ?? []).map((t: any) => t.id);
      if (taskIds.length > 0) {
        await supabase.from("task_assignees").delete().in("task_id", taskIds);
        await supabase.from("task_updates").delete().in("task_id", taskIds);
        await supabase.from("tasks").delete().in("id", taskIds);
      }
      await supabase.from("team_members").delete().eq("team_id", teamId);
      await supabase.from("teams").delete().eq("id", teamId);
      return jsonResponse({ ok: true }, 200);
    }

    return textResponse("unknown action", 400);
  } catch (e: any) {
    console.error("admin function error:", e.message, e.stack);
    return textResponse(e.message, 500);
  }
});
