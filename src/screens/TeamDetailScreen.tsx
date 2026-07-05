import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ActivityIndicator, ScrollView, FlatList } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";

interface Member {
  member_id: string;
  members: {
    full_name: string;
    email: string;
  } | null;
}

interface RouteParams {
  teamId: string;
  teamName: string;
}

export default function TeamDetailScreen() {
  const { user } = useAuth();
  const route = useRoute<{ params: RouteParams }>();
  const navigation = useNavigation();
  const { teamId, teamName } = route.params;

  const [activeTab, setActiveTab] = useState<"tasks" | "updates">("tasks");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    const { data } = await supabase
      .from("team_members")
      .select("member_id, members(full_name, email)")
      .eq("team_id", teamId);
    setMembers((data ?? []) as Member[]);
    setLoadingMembers(false);
  };

  useEffect(() => { fetchMembers(); }, [teamId]);

  const handleLeaveTeam = async () => {
    Alert.alert("Leave Team", `Are you sure you want to leave "${teamName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave", style: "destructive",
        onPress: async () => {
          if (!user?.id) return;
          setLeaving(true);
          const { error } = await supabase
            .from("team_members")
            .delete()
            .eq("team_id", teamId)
            .eq("member_id", user.id);
          setLeaving(false);
          if (error) return Alert.alert("Error", error.message);
          navigation.goBack();
        },
      },
    ]);
  };

  const closeInfoModal = () => setShowInfoModal(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{teamName}</Text>
        <TouchableOpacity onPress={() => setShowInfoModal(true)} style={styles.infoBtn}>
          <Text style={styles.infoBtnText}>ℹ️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "tasks" && styles.tabActive]}
          onPress={() => setActiveTab("tasks")}
        >
          <Text style={[styles.tabText, activeTab === "tasks" && styles.tabTextActive]}>Assigned Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "updates" && styles.tabActive]}
          onPress={() => setActiveTab("updates")}
        >
          <Text style={[styles.tabText, activeTab === "updates" && styles.tabTextActive]}>Updates</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContent}>
        {activeTab === "tasks" ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No assigned tasks yet</Text>
            <Text style={styles.emptySubtext}>Tasks assigned to this team will appear here</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No updates yet</Text>
            <Text style={styles.emptySubtext}>Team updates will appear here</Text>
          </View>
        )}
      </View>

      <Modal visible={showInfoModal} transparent animationType="fade" onRequestClose={closeInfoModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeInfoModal}>
          <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalContent}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Team Members</Text>
                <TouchableOpacity onPress={closeInfoModal} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {loadingMembers ? (
                <ActivityIndicator style={styles.loading} size="large" />
              ) : members.length === 0 ? (
                <Text style={styles.emptyText}>No members</Text>
              ) : (
                <FlatList
                  data={members}
                  keyExtractor={(item) => item.member_id}
                  renderItem={({ item }) => (
                    <View style={styles.memberRow}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {(item.members?.full_name || item.members?.email || "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.members?.full_name || "Unknown"}</Text>
                        <Text style={styles.memberEmail}>{item.members?.email || ""}</Text>
                      </View>
                    </View>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}

              <View style={styles.modalFooter}>
                <Button
                  title="Exit Group"
                  onPress={handleLeaveTeam}
                  variant="danger"
                  loading={leaving}
                  fullWidth
                />
              </View>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 8 },
  backText: { fontSize: 24, color: "#2563EB", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827", flex: 1, textAlign: "center" },
  infoBtn: { padding: 8 },
  infoBtnText: { fontSize: 20 },

  tabBar: {
    flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#2563EB" },
  tabText: { fontSize: 15, fontWeight: "500", color: "#9CA3AF" },
  tabTextActive: { color: "#2563EB", fontWeight: "600" },

  tabContent: { flex: 1 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyText: { fontSize: 18, fontWeight: "600", color: "#374151", marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContainer: { flex: 1, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalContent: { padding: 24, paddingBottom: 40, flexGrow: 1 },
  modalCard: { backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 22, color: "#9CA3AF" },

  loading: { marginVertical: 20 },

  memberRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#2563EB",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  memberAvatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  memberEmail: { fontSize: 13, color: "#6B7280", marginTop: 1 },

  separator: { height: 1, backgroundColor: "#F3F4F6", marginLeft: 52 },

  modalFooter: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB" },
});