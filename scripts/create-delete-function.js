const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY — must be set in environment");
  process.exit(1);
}
if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL — must be set in environment");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const sql = `
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM public.push_tokens WHERE user_id = auth.uid();
  DELETE FROM public.task_updates WHERE updated_by = auth.uid();
  UPDATE public.tasks SET claimed_by = NULL WHERE claimed_by = auth.uid();
  DELETE FROM public.team_members WHERE member_id = auth.uid();
  DELETE FROM public.join_requests WHERE user_id = auth.uid();
  DELETE FROM public.team_requests WHERE requested_by = auth.uid();
  DELETE FROM public.tasks WHERE created_by = auth.uid();
  DELETE FROM public.members WHERE id = auth.uid();
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
`;

(async () => {
  const { data, error } = await supabase.rpc("exec_sql", { query: sql }).single();
  if (error) {
    console.error("Error creating function:", error.message);
    process.exit(1);
  }
  console.log("Function created successfully");
})();
