import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_team_id: string;
  created_by: string;
  claimed_by: string | null;
  created_at: string | null;
  teams: { name: string };
}

export function useTasks(teamId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    let query = supabase
      .from("tasks")
      .select("id, title, description, status, assigned_team_id, created_by, claimed_by, created_at, teams(name)")
      .order("created_at", { ascending: false });

    if (teamId) query = query.eq("assigned_team_id", teamId);

    const { data } = await query;
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  };

  useEffect(() => { fetchTasks(); }, [teamId]);

  return { tasks, loading, refetch: fetchTasks };
}
