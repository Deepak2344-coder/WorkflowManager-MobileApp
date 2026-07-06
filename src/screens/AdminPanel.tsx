import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Platform, TouchableOpacity, Modal } from "react-native";
import { supabase, removeTeamMember, deleteTeam } from "../lib/supabase";
import Button from "../components/Button";
import ErrorBanner from "../components/ErrorBanner";

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
  const [confirmLabel, setConfirmLabel] = useState("Confirm");
  const [confirming, setConfirming] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [tr, teamsRes, membersRes, teamMembersRes] = await Promise.all([
      supabase.from("team_requests").select("id, requested_by, team_name, status, created_at").eq("status", "pending").order("created_at"),
      supabase.from("teams").select("id, name").order("name"),
      supabase.from("members").select("id, email, full_name"),
      supabase.from("team_members").select("member_id, team_id"),
    ]);
    if (!tr.error) {
      const membersMap = new Map((membersRes.data ?? []).map((m: any) => [m.id, { email: m.email, full_name: m.full_name }]));
      const requestsWithMember = (tr.data ?? []).map((r: any) => ({
        ...r,
        members: membersMap.get(r.requested_by) ?? null,
      }));
      setTeamRequests(requestsWithMember as unknown as TeamRequest[]);
    } else console.error("fetch team_requests error:", tr.error);
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

    setSuccessMessage(`Team "${teamName}" created and member added.`);
    fetchAll();
  };

  const rejectTeam = async (id: string) => {
    const { error } = await supabase.from("team_requests").update({ status: "rejected" }).eq("id", id);
    if (error) Alert.alert("Error", error.message); else fetchAll();
  };

  const removeMember = (memberId: string, teamId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmTitle("Remove Member");
    setConfirmMessage("Are you sure you want to remove this member from the team?");
    setConfirmLabel("Remove");
    setConfirmAction(() => async () => {
      const { error } = await removeTeamMember(memberId, teamId);
      if (error) { setErrorMessage(error); return; }
      setSuccessMessage("Member removed successfully");
      fetchAll();
    });
    setConfirmVisible(true);
  };

  const handleDeleteTeam = (teamId: string, teamName: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmTitle("Delete Team");
    setConfirmMessage(`Are you sure you want to permanently delete "${teamName}"?\n\nAll team members will be removed and all related tasks and updates will be deleted.`);
    setConfirmLabel("Delete");
    setConfirmAction(() => async () => {
      const { error } = await deleteTeam(teamId);
      if (error) { setErrorMessage(error); return; }
      setSuccessMessage("Team deleted successfully");
      fetchAll();
    });
    setConfirmVisible(true);
  };

  useEffect(() => {
    if (errorMessage || successMessage) {
      const timer = setTimeout(() => { setErrorMessage(null); setSuccessMessage(null); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, successMessage]);

  const runConfirm = async () => {
    if (!confirmAction) return;
    setConfirming(true);
    await confirmAction();
    setConfirming(false);
    setConfirmVisible(false);
    setConfirmAction(null);
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

      {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />}
      {successMessage && <ErrorBanner message={successMessage} type="success" onDismiss={() => setSuccessMessage(null)} />}

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
          <View style={styles.teamCardHeader}>
            <Text style={styles.cardTitle}>{team.name}</Text>
            <TouchableOpacity style={styles.deleteTeamBtn} onPress={() => handleDeleteTeam(team.id, team.name)}>
              <Text style={styles.deleteTeamBtnText}>Delete Team</Text>
            </TouchableOpacity>
          </View>
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

      <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setConfirmVisible(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.confirmTitle}>{confirmTitle}</Text>
            <Text style={styles.confirmMessage}>{confirmMessage}</Text>
            <View style={styles.confirmActions}>
              <Button title="Cancel" onPress={() => setConfirmVisible(false)} variant="secondary" />
              <Button title={confirmLabel} onPress={runConfirm} variant="danger" loading={confirming} />
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  teamCardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  deleteTeamBtn: {
    backgroundColor: "#DC2626", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  deleteTeamBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#fff", borderRadius: 16, padding: 24, maxWidth: 400, alignSelf: "center", width: "100%" },
  confirmTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 12 },
  confirmMessage: { fontSize: 15, color: "#6B7280", lineHeight: 22, marginBottom: 20 },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
});
