import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_PROJECT_REF = process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — copy .env.example to .env and fill in your values");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

async function callAdmin(action: string, payload: Record<string, unknown>): Promise<{ error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { error: "Not authenticated" };
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { error: body || `HTTP ${res.status}` };
    }
    return {};
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deleteAuthUser(userId: string): Promise<{ error?: string }> {
  return callAdmin("delete_account", { userId });
}

export async function removeTeamMember(memberId: string, teamId: string): Promise<{ error?: string }> {
  return callAdmin("remove_member", { memberId, teamId });
}

export async function clearAllTasks(): Promise<{ error?: string }> {
  return callAdmin("clear_all_tasks", {});
}

export async function deleteNotice(noticeId: string): Promise<{ error?: string }> {
  return callAdmin("delete_notice", { noticeId });
}

export async function deleteUpdate(updateId: string): Promise<{ error?: string }> {
  return callAdmin("delete_update", { updateId });
}

export async function deleteTeam(teamId: string): Promise<{ error?: string }> {
  return callAdmin("delete_team", { teamId });
}
