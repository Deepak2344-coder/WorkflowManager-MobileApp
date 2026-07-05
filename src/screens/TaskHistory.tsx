import { View, FlatList, Text, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import TaskCard from "../components/TaskCard";
import SearchFilterBar from "../components/SearchFilterBar";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_team_id: string;
  created_by: string;
  claimed_by: string | null;
  started_by: string | null;
  completed_at: string | null;
  deadline: string | null;
  remarks: string | null;
  response_remark: string | null;
  created_at: string | null;
  teams: { name: string };
  claimed_by_member?: { full_name: string } | null;
  started_by_member?: { full_name: string }[] | null;
  created_by_member?: { full_name: string } | null;
}

interface TeamMember {
  member_id: string;
  team_id: string;
  members: { email: string; full_name: string } | null;
}

export default function TaskHistory() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskAssigneesMap, setTaskAssigneesMap] = useState<Record<string, string[]>>({});
  const [allTeamMembers, setAllTeamMembers] = useState<Record<string, TeamMember[]>>({});
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (filterDate) {
      const target = filterDate.toDateString();
      list = list.filter((t) => t.created_at && new Date(t.created_at).toDateString() === target);
    }
    return list;
  }, [tasks, searchText, filterDate]);

  const fetchHistory = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, status, assigned_team_id, created_by, claimed_by, started_by, completed_at, deadline, remarks, response_remark, created_at, teams(name), claimed_by_member:members!claimed_by(full_name), started_by_member:members!started_by(full_name), created_by_member:members!created_by(full_name)")
      .eq("status", "done")
      .order("created_at", { ascending: false });
    const taskList = (data ?? []) as Task[];
    setTasks(taskList);

    const teamIds = [...new Set(taskList.map((t: Task) => t.assigned_team_id))];
    if (teamIds.length > 0) {
      const [{ data: teamData }, { data: assigneeData }] = await Promise.all([
        supabase.from("team_members").select("member_id, team_id, members(email, full_name)").in("team_id", teamIds),
        supabase.from("task_assignees").select("task_id, member_id").in("task_id", taskList.map((t: Task) => t.id)),
      ]);
      const membersByTeam: Record<string, TeamMember[]> = {};
      for (const m of (teamData ?? []) as TeamMember[]) {
        if (!membersByTeam[m.team_id]) membersByTeam[m.team_id] = [];
        membersByTeam[m.team_id].push(m);
      }
      setAllTeamMembers(membersByTeam);
      const map: Record<string, string[]> = {};
      for (const a of (assigneeData ?? []) as { task_id: string; member_id: string }[]) {
        if (!map[a.task_id]) map[a.task_id] = [];
        map[a.task_id].push(a.member_id);
      }
      setTaskAssigneesMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <SearchFilterBar searchPlaceholder="Search completed tasks..." onSearchChange={setSearchText} filterDate={filterDate} onDateChange={setFilterDate} />
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const members = allTeamMembers[item.assigned_team_id] || [];
          const ids = taskAssigneesMap[item.id];
          const assigneeNames = ids ? ids.map((mid: string) => members.find((m) => m.member_id === mid)?.members?.full_name || mid).filter(Boolean) : undefined;
          return (
            <TaskCard
              title={item.title}
              description={item.description}
              status={item.status}
              teamName={item.teams?.name ?? "Unknown"}
              deadline={item.deadline}
              remarks={item.remarks}
              responseRemark={item.response_remark}
              claimedByName={(item as any).claimed_by_member?.full_name}
              createdByName={(item as any).created_by_member?.full_name}
              startedByName={(item as any).started_by_member?.[0]?.full_name}
              completedAt={item.completed_at}
              assigneeNames={assigneeNames}
            />
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No completed tasks yet</Text>}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchHistory} />}
        contentContainerStyle={tasks.length === 0 ? styles.emptyContainer : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  empty: { textAlign: "center", color: "#6B7280", fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: "center" },
});
