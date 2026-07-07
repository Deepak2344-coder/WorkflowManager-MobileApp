import { useEffect, useState } from "react";
import { View, FlatList, Text, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";

interface Team {
  id: string;
  name: string;
}

export default function CommonDashboard() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTasksOverview, setActiveTasksOverview] = useState<{ id: string; assigned_team_id: string; status: string }[]>([]);
  const [teamUpdatesOverview, setTeamUpdatesOverview] = useState<{ id: string; assigned_team_id: string }[]>([]);

  const teamPending: Record<string, number> = {};
  const teamInProgress: Record<string, number> = {};
  const teamRejected: Record<string, number> = {};
  for (const t of activeTasksOverview) {
    const tid = t.assigned_team_id;
    if (t.status === "in_progress") teamInProgress[tid] = (teamInProgress[tid] || 0) + 1;
    if (t.status === "pending") teamPending[tid] = (teamPending[tid] || 0) + 1;
    if (t.status === "rejected") teamRejected[tid] = (teamRejected[tid] || 0) + 1;
  }

  const fetchOverview = async () => {
    if (!user?.id) return;
    const { data: taskData } = await supabase
      .from("tasks").select("id, assigned_team_id, status").neq("status", "done");
    setActiveTasksOverview((taskData ?? []) as { id: string; assigned_team_id: string; status: string }[]);
    const { data: updatesData } = await supabase
      .from("task_updates").select("id, team_id");
    setTeamUpdatesOverview((updatesData ?? []).map((u: any) => ({ id: u.id, assigned_team_id: u.team_id })));
  };

  const fetchTeams = async () => {
    setLoading(true);
    const { data } = await supabase.from("teams").select("id, name").order("name");
    setTeams((data ?? []) as Team[]);
    await fetchOverview();
    setLoading(false);
  };

  useEffect(() => { fetchTeams(); }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>All Teams</Text>
      <FlatList
        data={teams}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const pending = teamPending[item.id] || 0;
          const inProg = teamInProgress[item.id] || 0;
          const rejected = teamRejected[item.id] || 0;
          return (
            <TouchableOpacity
              style={styles.teamCard}
              onPress={() => navigation.navigate("TeamTaskDetail", { teamId: item.id, teamName: item.name })}
            >
              <View>
                <Text style={styles.teamName}>{item.name}</Text>
                <View style={styles.teamCardMeta}>
                  {pending > 0 && <Text style={styles.teamCardMetaText}>{pending} pending acceptance</Text>}
                  {inProg > 0 && <Text style={styles.teamCardMetaText}>{inProg} in progress</Text>}
                  {rejected > 0 && <Text style={[styles.teamCardMetaText, { color: "#EF4444" }]}>{rejected} rejected</Text>}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No teams yet</Text> : null}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTeams} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  pageTitle: { fontSize: 24, fontWeight: "700", color: "#111827", padding: 16, paddingBottom: 0 },

  teamCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 80,
  },
  teamName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  teamCardMeta: { flexDirection: "row", gap: 12, marginTop: 6 },
  teamCardMetaText: { fontSize: 12, color: "#6B7280" },
  chevron: { fontSize: 20, color: "#9CA3AF" },

  empty: { textAlign: "center", color: "#6B7280", fontSize: 16, marginTop: 40 },
});
