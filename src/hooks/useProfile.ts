import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

interface Profile {
  id: string;
  email: string;
  full_name: string;
}

export interface TeamMembership {
  team_id: string;
  teams: { name: string };
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data: p, error: profileErr } = await supabase.from("members").select("id, email, full_name").eq("id", user.id).single();
    if (profileErr) { setError(profileErr.message); setLoading(false); return; }
    setProfile(p);
    const { data: t, error: teamsErr } = await supabase.from("team_members").select("team_id, teams(name)").eq("member_id", user.id);
    if (teamsErr) { setError(teamsErr.message); setLoading(false); return; }
    setTeams((t ?? []) as TeamMembership[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  return { profile, teams, team: teams[0] ?? null, loading, error, refetchProfile: fetchProfile };
}
