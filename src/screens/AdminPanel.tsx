import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Platform } from "react-native";
import { supabase, removeTeamMember } from "../lib/supabase";
import Button from "../components/Button";

interface TeamRequest {
  id: string;
  requested_by: string;
  team_name: string;
  status: string;
  created_at: string | null;
  members: { email: string; full_name: string } | null;
}

interface TeamMember {
  member_id: string;
  members: { email: string; full_name: string } | null;
}

interface TeamWithMembers {
  id: string;
  name: string;
  team_members: TeamMember[];
}

export default function AdminPanel() {
  const [teamRequests, setTeamRequests] = useState<TeamRequest[]>([]);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const [tr, teamsRes, membersRes, teamMembersRes] = await Promise.all([
      supabase.from("team_requests").select("id, requested_by, team_name, status, created_at, members!inner(email, full_name)").eq("status", "pending").order("created_at"),
      supabase.from("teams").select("id, name").order("name"),
      supabase.from("members").select("id, email, full_name"),
      supabase.from("team_members").select("member_id, team_id"),
    ]);
    if (!tr.error) setTeamRequests((tr.data ?? []) as unknown as TeamRequest[]);
    if (!teamsRes.error && !teamMembersRes.error) {
      const membersMap = new Map((membersRes.data ?? []).map((m: any) => [m.id, { email: m.email, full_name: m.full_name }]));
      const teamsWithMembers: TeamWithMembers[] = (teamsRes.data ?? []).map((team: any) => ({
        id: team.id,
        name: team.name,
        team_members: (teamMembersRes.data ?? [])
          .filter((tm: any) => tm.team_id === team.id)
          .map((tm: any) => ({ member_id: tm.member_id, members: membersMap.get(tm.member_id) ?? null })),
      }));
      setTeams(teamsWithMembers);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const approveTeam = async (id: string, teamName: string) => {
    const request = teamRequests.find((r) => r.id === id);
    if (!request) return Alert.alert("Error", "Request not found");

    const { error: reqErr } = await supabase.from("team_requests").update({ status: "approved" }).eq("id", id);
    if (reqErr) return Alert.alert("Update Error", reqErr.message);

    const { data: newTeam, error: createErr } = await supabase.from("teams").insert({ name: teamName }).select("id").single();
    if (createErr) return Alert.alert("Team Create Error", createErr.message);

    const { error: memberErr } = await supabase.from("team_members").insert({ member_id: request.requested_by, team_id: newTeam.id });
    if (memberErr) return Alert.alert("Member Add Error", memberErr.message);

    Alert.alert("Approved", `Team "${teamName}" created and member added.`);
    fetchAll();
  };

  const rejectTeam = async (id: string) => {
    const { error } = await supabase.from("team_requests").update({ status: "rejected" }).eq("id", id);
    if (error) Alert.alert("Error", error.message); else fetchAll();
  };

  const removeMember = async (memberId: string, teamId: string) => {
    Alert.alert("Remove Member", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          const { error } = await removeTeamMember(memberId, teamId);
          if (error) return Alert.alert("Remove Error", error);
          fetchAll();
        },
      },
    ]);
  };

  if (Platform.OS !== "web") {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Admin panel is only available on web</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={styles.heading}>Admin Panel</Text>
      <Button title="Refresh" onPress={fetchAll} variant="secondary" />

      <Text style={styles.sectionTitle}>Team Creation Requests ({teamRequests.length})</Text>
      {teamRequests.length === 0 && <Text style={styles.emptyText}>No pending requests</Text>}
      {teamRequests.map((req) => (
        <View key={req.id} style={styles.card}>
          <Text style={styles.cardTitle}>{req.team_name}</Text>
          <Text style={styles.cardSub}>Requested by: {req.members?.email || "Unknown"}</Text>
          <View style={styles.row}>
            <Button title="Approve" onPress={() => approveTeam(req.id, req.team_name)} variant="primary" />
            <Button title="Reject" onPress={() => rejectTeam(req.id)} variant="danger" />
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Teams & Members</Text>
      {teams.map((team) => (
        <View key={team.id} style={styles.card}>
          <Text style={styles.cardTitle}>{team.name}</Text>
          {(!team.team_members || team.team_members.length === 0) && (
            <Text style={styles.emptyText}>No members</Text>
          )}
          {team.team_members?.map((tm) => (
            <View key={tm.member_id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{tm.members?.full_name || "Unknown"}</Text>
                <Text style={styles.memberEmail}>{tm.members?.email || tm.member_id}</Text>
              </View>
              <Button title="Remove" onPress={() => removeMember(tm.member_id, team.id)} variant="danger" />
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: { fontSize: 28, fontWeight: "700", color: "#111827", marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: "#111827", marginTop: 24, marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  cardSub: { fontSize: 13, color: "#6B7280", marginTop: 2, marginBottom: 10 },
  row: { flexDirection: "row", gap: 10 },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 6,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  memberEmail: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  emptyText: { fontSize: 14, color: "#9CA3AF", marginVertical: 4 },
});
