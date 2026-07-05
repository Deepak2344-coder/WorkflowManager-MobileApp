import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { supabase, deleteAuthUser } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";

export default function HamburgerMenu() {
  const { user } = useAuth();
  const { profile, teams } = useProfile();
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<"menu" | "profile" | "createTeam" | "changeUsername">("menu");
  const [newName, setNewName] = useState("");
  const [updating, setUpdating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const changeUsername = async () => {
    if (!newName.trim() || !user?.id) return Alert.alert("Error", "Enter a name");
    setUpdating(true);
    const { error } = await supabase.from("members").update({ full_name: newName.trim() }).eq("id", user.id);
    setUpdating(false);
    if (error) return Alert.alert("Error", error.message);
    Alert.alert("Done", "Username updated");
    setNewName("");
    setView("menu");
  };

  const requestCreateTeam = async () => {
    if (!teamName.trim() || !profile) return Alert.alert("Error", "Enter a team name");
    setSending(true);
    const { error } = await supabase.from("team_requests").insert({ requested_by: profile.id, team_name: teamName.trim() });
    setSending(false);
    if (error) return Alert.alert("Error", error.message);
    Alert.alert("Request Sent", "Your team creation request has been sent to the admin.");
    setTeamName("");
    setView("menu");
  };

  const handleSignOut = () => {
    setVisible(false);
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    setVisible(false);
    Alert.alert("Delete Account", `This will permanently delete ${user?.email || "this account"} and all associated data. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete Permanently", style: "destructive",
        onPress: async () => {
          if (!user?.id) return;
          setDeleting(true);
          const { error } = await deleteAuthUser(user.id);
          if (error) { setDeleting(false); return Alert.alert("Error", error); }
          supabase.auth.signOut();
        },
      },
    ]);
  };

  const close = () => { setVisible(false); setView("menu"); };

  if (deleting) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#DC2626" />
        <Text style={styles.loadingText}>Deleting account...</Text>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.hamburger}>
        <Text style={styles.hamburgerText}>☰</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={close}>
          <View style={styles.menu} onStartShouldSetResponder={() => true}>
            {view === "profile" && (
              <>
                <TouchableOpacity onPress={() => setView("menu")} style={styles.backRow}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <View style={styles.profileCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(profile?.full_name || profile?.email || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.profileName}>{profile?.full_name || "Update your name"}</Text>
                  <Text style={styles.profileEmail}>{profile?.email}</Text>
                </View>
                {teams.length > 0 && (
                  <View style={styles.teamsSection}>
                    <Text style={styles.teamsLabel}>Teams</Text>
                    {teams.map((t) => (
                      <Text key={t.team_id} style={styles.teamBadge}>Team: {t.teams?.name}</Text>
                    ))}
                  </View>
                )}
              </>
            )}

            {view === "createTeam" && (
              <>
                <TouchableOpacity onPress={() => setView("menu")} style={styles.backRow}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.subTitle}>Create a Team</Text>
                <Text style={styles.subDesc}>Request a new team. Admin will review and approve it.</Text>
                <TextInput style={styles.input} placeholder="Team name" placeholderTextColor="#9CA3AF" value={teamName} onChangeText={setTeamName} />
                <TouchableOpacity style={styles.actionBtn} onPress={requestCreateTeam} disabled={sending}>
                  <Text style={styles.actionBtnText}>{sending ? "Sending..." : "Send Request"}</Text>
                </TouchableOpacity>
              </>
            )}

            {view === "changeUsername" && (
              <>
                <TouchableOpacity onPress={() => setView("menu")} style={styles.backRow}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.subTitle}>Change Username</Text>
                <TextInput style={styles.input} placeholder="Enter new username" placeholderTextColor="#9CA3AF" value={newName} onChangeText={setNewName} autoFocus />
                <TouchableOpacity style={styles.actionBtn} onPress={changeUsername} disabled={updating}>
                  <Text style={styles.actionBtnText}>{updating ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
              </>
            )}

            {view === "menu" && (
              <>
                <Text style={styles.menuTitle}>Menu</Text>
                <TouchableOpacity style={styles.menuItem} onPress={() => setView("profile")}>
                  <Text style={styles.menuItemText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => setView("createTeam")}>
                  <Text style={styles.menuItemText}>Create Team</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => setView("changeUsername")}>
                  <Text style={styles.menuItemText}>Change Username</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleSignOut}>
                  <Text style={[styles.menuItemText, { color: "#DC2626" }]}>Sign Out</Text>
                </TouchableOpacity>
                <View style={styles.separator} />
                <TouchableOpacity style={styles.menuItem} onPress={handleDeleteAccount}>
                  <Text style={[styles.menuItemText, { color: "#DC2626", fontWeight: "700" }]}>Delete Account</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hamburger: { marginRight: 16, padding: 4 },
  hamburgerText: { fontSize: 24, color: "#111827" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-start", alignItems: "flex-end" },
  menu: {
    backgroundColor: "#fff",
    marginTop: 80,
    marginRight: 12,
    borderRadius: 12,
    padding: 16,
    minWidth: 240,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  menuTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", paddingBottom: 8 },
  menuItem: { paddingVertical: 12 },
  menuItemText: { fontSize: 16, color: "#374151", fontWeight: "500" },
  separator: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 4 },
  loadingOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#6B7280" },

  backRow: { marginBottom: 10 },
  backText: { fontSize: 15, color: "#2563EB", fontWeight: "500" },

  subTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 6 },
  subDesc: { fontSize: 13, color: "#6B7280", marginBottom: 12 },
  input: { backgroundColor: "#F3F4F6", padding: 12, borderRadius: 8, fontSize: 15, color: "#111827", marginBottom: 12 },
  actionBtn: { backgroundColor: "#2563EB", paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  profileCard: { alignItems: "center", paddingVertical: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center", marginBottom: 8 },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  profileName: { fontSize: 17, fontWeight: "700", color: "#111827" },
  profileEmail: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  teamsSection: { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 12, marginTop: 4 },
  teamsLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  teamBadge: {
    backgroundColor: "#DBEAFE", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10,
    fontSize: 13, color: "#2563EB", fontWeight: "600", overflow: "hidden", marginBottom: 4,
  },
});
