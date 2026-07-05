import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RATE_LIMIT_WINDOW = 10_000;
const rateMap = new Map<string, number>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const last = rateMap.get(key);
  if (last && now - last < RATE_LIMIT_WINDOW) return false;
  rateMap.set(key, now);
  return true;
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("no auth", { status: 401 });
    const token = authHeader.replace("Bearer ", "");

    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(clientIp)) return new Response("rate limited", { status: 429 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return new Response("unauthorized", { status: 401 });

    const { action, payload } = await req.json();

    if (action === "delete_account") {
      if (user.id !== payload.userId) return new Response("forbidden", { status: 403 });

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

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "remove_member") {
      await supabase.from("team_members").delete()
        .eq("member_id", payload.memberId)
        .eq("team_id", payload.teamId);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "clear_all_tasks") {
      await supabase.from("task_assignees").delete().neq("task_id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("task_updates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "delete_notice") {
      const { data: notice } = await supabase.from("notices").select("created_by").eq("id", payload.noticeId).single();
      if (!notice || notice.created_by !== user.id) return new Response("forbidden", { status: 403 });
      await supabase.from("notice_views").delete().eq("notice_id", payload.noticeId);
      await supabase.from("notices").delete().eq("id", payload.noticeId);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (action === "delete_update") {
      const { data: update } = await supabase.from("task_updates").select("posted_by").eq("id", payload.updateId).single();
      if (!update || update.posted_by !== user.id) return new Response("forbidden", { status: 403 });
      await supabase.from("update_views").delete().eq("update_id", payload.updateId);
      await supabase.from("task_updates").delete().eq("id", payload.updateId);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("unknown action", { status: 400 });
  } catch (e: any) {
    console.error("admin function error:", e.message, e.stack);
    return new Response(e.message, { status: 500 });
  }
});
