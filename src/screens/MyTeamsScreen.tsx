import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  ActivityIndicator, Alert, ScrollView, RefreshControl,
} from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../hooks/useProfile";
import Button from "../components/Button";

interface Team {
  id: string;
  name: string;
  member_count: number;
}

export default function MyTeamsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const { refetchProfile } = useProfile();

  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [otherTeams, setOtherTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBrowseModal, setShowBrowseModal] = useState(false);

  const fetchMyTeams = useCallback(async (): Promise<Team[]> => {
    if (!user?.id) return [];
    const { data: membership, error: err1 } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("member_id", user.id);
    if (err1) { console.error("fetchMyTeams error:", err1); return []; }
    const ids = (membership ?? []).map((r) => r.team_id);
    if (ids.length === 0) { setMyTeams([]); return []; }
    const { data: teamNames } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", ids);
    const teamsData: Team[] = (teamNames ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      member_count: 0,
    }));
    setMyTeams(teamsData);
    return teamsData;
  }, [user?.id]);

  const fetchAllTeams = useCallback(async () => {
    const { data } = await supabase.from("teams").select("id, name").order("name");
    const teamsData = ((data ?? []) as { id: string; name: string }[]).map((t) => ({
      id: t.id,
      name: t.name,
      member_count: 0,
    }));
    setAllTeams(teamsData);
    return teamsData;
  }, []);

  const computeOtherTeams = useCallback((my: Team[], all: Team[]) => {
    const myIds = new Set(my.map((t) => t.id));
    setOtherTeams(all.filter((t) => !myIds.has(t.id)));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [my, all] = await Promise.all([fetchMyTeams(), fetchAllTeams()]);
      computeOtherTeams(my, all);
    } catch (e) {
      console.error("loadData error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchMyTeams, fetchAllTeams, computeOtherTeams]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleJoinTeam = async (teamId: string, teamName: string) => {
    if (!user?.id) return Alert.alert("Error", "Not authenticated");
    const { error } = await supabase
      .from("team_members")
      .insert({ member_id: user.id, team_id: teamId });
    if (error && error.code !== "23505") return Alert.alert("Error", error.message);
    setShowBrowseModal(false);
    await refetchProfile();
    loadData();
  };

  const handleRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  if (loading) {
    return <ActivityIndicator style={styles.loading} size="large" />;
  }

  const hasTeams = myTeams.length > 0;

  return (
    <View style={styles.container}>
      {!hasTeams ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Teams Yet</Text>
          <Text style={styles.emptyDesc}>Browse existing teams or create a new one</Text>
          <View style={styles.emptyActions}>
            <Button title="Browse Teams" onPress={() => setShowBrowseModal(true)} variant="primary" />
          </View>
        </View>
      ) : (
        <FlatList
          data={myTeams}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.teamCard}
              onPress={() => navigation.navigate("TeamDetail", { teamId: item.id, teamName: item.name })}
              activeOpacity={0.8}
            >
              <View style={styles.teamCardLeft}>
                <View style={styles.teamAvatar}>
                  <Text style={styles.teamAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{item.name}</Text>
                  <Text style={styles.teamMeta}>{item.member_count} member{item.member_count !== 1 ? "s" : ""}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Teams</Text>
              <Text style={styles.emptyDesc}>Browse teams to join</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowBrowseModal(true)} activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={showBrowseModal} transparent animationType="fade" onRequestClose={() => setShowBrowseModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowBrowseModal(false)}>
          <ScrollView style={styles.browseModal} contentContainerStyle={styles.browseModalContent}>
            <View style={styles.browseCard}>
              <View style={styles.browseHeader}>
                <Text style={styles.browseTitle}>Browse Teams</Text>
                <TouchableOpacity onPress={() => setShowBrowseModal(false)} style={styles.browseClose}>
                  <Text style={styles.browseCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {otherTeams.length === 0 ? (
                <View style={styles.browseEmpty}>
                  <Text style={styles.browseEmptyTitle}>No Other Teams</Text>
                  <Text style={styles.browseEmptyDesc}>
                    {hasTeams ? "You're already in all available teams" : "No teams exist yet"}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={otherTeams}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.browseTeamCard} onPress={() => handleJoinTeam(item.id, item.name)} activeOpacity={0.8}>
                      <View style={styles.browseTeamLeft}>
                        <View style={styles.browseTeamAvatar}>
                          <Text style={styles.browseTeamAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.browseTeamInfo}>
                          <Text style={styles.browseTeamName}>{item.name}</Text>
                          <Text style={styles.browseTeamMeta}>{item.member_count} member{item.member_count !== 1 ? "s" : ""}</Text>
                        </View>
                      </View>
                      <Text style={styles.browseJoinText}>Join</Text>
                    </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.browseListContent}
                />
              )}
            </View>
          </ScrollView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  listContent: { padding: 16, paddingBottom: 100 },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 8 },
  emptyDesc: { fontSize: 15, color: "#6B7280", textAlign: "center", marginBottom: 24 },
  emptyActions: { width: "80%", maxWidth: 280 },

  teamCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  teamCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  teamAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#2563EB",
    justifyContent: "center", alignItems: "center", marginRight: 14,
  },
  teamAvatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  teamInfo: { flex: 1 },
  teamName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  teamMeta: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  chevron: { fontSize: 22, color: "#9CA3AF" },

  fab: {
    position: "absolute", bottom: 28, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 30 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 },
  browseModal: { flex: 1, backgroundColor: "#fff", borderRadius: 16, maxHeight: "85%" },
  browseModalContent: { paddingBottom: 24 },
  browseCard: { padding: 20 },
  browseHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  browseTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  browseClose: { padding: 4 },
  browseCloseText: { fontSize: 22, color: "#9CA3AF" },

  browseEmpty: { paddingVertical: 32, alignItems: "center" },
  browseEmptyTitle: { fontSize: 18, fontWeight: "600", color: "#374151", marginBottom: 4 },
  browseEmptyDesc: { fontSize: 14, color: "#9CA3AF", textAlign: "center" },

  browseListContent: { paddingTop: 4 },
  browseTeamCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  browseTeamLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  browseTeamAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#DBEAFE",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  browseTeamAvatarText: { color: "#2563EB", fontSize: 16, fontWeight: "700" },
  browseTeamInfo: { flex: 1 },
  browseTeamName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  browseTeamMeta: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  browseJoinText: {
    fontSize: 14, fontWeight: "600", color: "#fff",
    backgroundColor: "#2563EB", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
});