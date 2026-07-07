import { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from "react-native";
import { useProfile } from "../hooks/useProfile";
import { useAuth } from "../context/AuthContext";
import { supabase, deleteNotice } from "../lib/supabase";
import Button from "../components/Button";
import { notify } from "../hooks/usePushNotifications";
import SearchFilterBar from "../components/SearchFilterBar";

interface JoinRequest {
  id: string;
  user_id: string;
  team_id: string;
  status: string;
  created_at: string | null;
  teams: { name: string } | null;
  members: { email: string; full_name: string } | null;
}

interface Notice {
  id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  creator?: { full_name: string } | null;
}

export default function Dashboard() {
  const { profile, loading } = useProfile();
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [viewedNoticeIds, setViewedNoticeIds] = useState<Set<string>>(new Set());
  const [fetchingNotices, setFetchingNotices] = useState(true);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [showAddNotice, setShowAddNotice] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [sendingNotice, setSendingNotice] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const filteredNotices = useMemo(() => {
    let list = notices;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q));
    }
    if (filterDate) {
      const target = filterDate.toDateString();
      list = list.filter((n) => new Date(n.created_at).toDateString() === target);
    }
    return list;
  }, [notices, searchText, filterDate]);

  const unseenCount = notices.filter((n) => !viewedNoticeIds.has(n.id)).length;

  const fetchNotices = async () => {
    setFetchingNotices(true);
    const { data } = await supabase.from("notices").select("id, title, content, created_by, created_at, creator:members!created_by(full_name)").order("created_at", { ascending: false });
    setNotices((data ?? []) as Notice[]);
    if (user?.id) {
      const { data: views } = await supabase.from("notice_views").select("notice_id").eq("member_id", user.id);
      setViewedNoticeIds(new Set((views ?? []).map((r: { notice_id: string }) => r.notice_id)));
    }
    setFetchingNotices(false);
  };

  useEffect(() => { fetchNotices(); fetchJoinRequests(); }, []);

  const fetchJoinRequests = async () => {
    if (!user?.id) return;
    setJoinRequestsLoading(true);
    const { data: myTeams } = await supabase.from("teams").select("id").eq("admin_id", user.id);
    const myTeamIds = (myTeams ?? []).map((t: { id: string }) => t.id);
    if (myTeamIds.length === 0) { setJoinRequests([]); setJoinRequestsLoading(false); return; }
    const { data } = await supabase
      .from("join_requests")
      .select("id, user_id, team_id, status, created_at, members!inner(full_name, email), teams!inner(name)")
      .in("team_id", myTeamIds)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setJoinRequests((data ?? []) as JoinRequest[]);
    setJoinRequestsLoading(false);
  };

  const approveJoin = async (req: JoinRequest) => {
    setApprovingId(req.id);
    await supabase.from("team_members").insert({ member_id: req.user_id, team_id: req.team_id });
    await supabase.from("join_requests").update({ status: "approved" }).eq("id", req.id);
    notify("request_approved", req.id, req.team_id);
    setApprovingId(null);
    fetchJoinRequests();
  };

  const rejectJoin = async (req: JoinRequest) => {
    setApprovingId(req.id);
    await supabase.from("join_requests").update({ status: "rejected" }).eq("id", req.id);
    notify("request_rejected", req.id, req.team_id);
    setApprovingId(null);
    fetchJoinRequests();
  };

  const markNoticeSeen = async (noticeId: string) => {
    if (!user?.id || viewedNoticeIds.has(noticeId)) return;
    setViewedNoticeIds((prev) => new Set(prev).add(noticeId));
    await supabase.from("notice_views").upsert({ notice_id: noticeId, member_id: user.id }, { onConflict: "notice_id,member_id" });
  };

  const addNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) return Alert.alert("Error", "Enter title and content");
    if (!user?.id) return;
    setSendingNotice(true);
    const { data: newNotice, error } = await supabase.from("notices").insert({ title: noticeTitle.trim(), content: noticeContent.trim(), created_by: user.id }).select("id").single();
    setSendingNotice(false);
    if (error) return Alert.alert("Error", error.message);
    setNoticeTitle("");
    setNoticeContent("");
    setShowAddNotice(false);
    fetchNotices();
    if (newNotice) notify("notice", newNotice.id);
  };

  const confirmDeleteNotice = (noticeId: string) => {
    Alert.alert("Delete Notice", "Are you sure you want to delete this notice?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        const { error } = await deleteNotice(noticeId);
        if (error) return Alert.alert("Error", error);
        setSelectedNotice(null);
        fetchNotices();
      }},
    ]);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredNotices}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View style={styles.welcomeCard}>
              <Text style={styles.welcomeTitle}>Welcome{profile?.full_name ? `, ${profile?.full_name?.split(" ")[0]}` : ""}!</Text>
              <Text style={styles.welcomeDesc}>Use the ☰ menu to view your profile, create a team, or manage your account.</Text>
            </View>

            {joinRequests.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Join Requests</Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{joinRequests.length}</Text>
                  </View>
                </View>
                {joinRequests.map((req) => (
                  <View key={req.id} style={styles.joinCard}>
                    <View style={styles.joinCardInfo}>
                      <Text style={styles.joinTeamName}>{req.teams?.name || "Team"}</Text>
                      <Text style={styles.joinUserName}>{req.members?.full_name || req.members?.email || "Unknown"}</Text>
                      <Text style={styles.joinDate}>{new Date(req.created_at || "").toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.joinActions}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => approveJoin(req)}
                        disabled={approvingId === req.id}
                      >
                        <Text style={styles.approveBtnText}>{approvingId === req.id ? "..." : "Approve"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => rejectJoin(req)}
                        disabled={approvingId === req.id}
                      >
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            <SearchFilterBar searchPlaceholder="Search notices..." onSearchChange={setSearchText} filterDate={filterDate} onDateChange={setFilterDate} />
            <View style={styles.noticesHeader}>
              <Text style={styles.noticesTitle}>Notices</Text>
              {unseenCount > 0 && (
                <View style={styles.unseenBadge}>
                  <Text style={styles.unseenBadgeText}>{unseenCount}</Text>
                </View>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isUnseen = !viewedNoticeIds.has(item.id);
          return (
            <TouchableOpacity
              style={styles.noticeCard}
              onPress={() => { setSelectedNotice(item); markNoticeSeen(item.id); }}
              activeOpacity={0.7}
            >
              <View style={styles.noticeRow}>
                <Text style={styles.noticeTitle} numberOfLines={1}>{item.title}</Text>
                {isUnseen && <View style={styles.noticeDot} />}
              </View>
              <Text style={styles.noticePreview} numberOfLines={2}>{item.content}</Text>
              <Text style={styles.noticeDate}>by {item.creator?.full_name || "Unknown"} · {new Date(item.created_at).toLocaleDateString()}</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={fetchingNotices ? null : <Text style={styles.empty}>No notices yet</Text>}
        refreshing={fetchingNotices}
        onRefresh={fetchNotices}
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddNotice(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={!!selectedNotice} transparent animationType="fade" onRequestClose={() => setSelectedNotice(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelectedNotice(null)}>
          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailCenter}>
            <View style={styles.detailModal} onStartShouldSetResponder={() => true}>
              <Text style={styles.detailTitle}>{selectedNotice?.title}</Text>
              <Text style={styles.detailDate}>by {selectedNotice?.creator?.full_name || "Unknown"} · {selectedNotice ? new Date(selectedNotice.created_at).toLocaleDateString() : ""}</Text>
              <Text style={styles.detailContent}>{selectedNotice?.content}</Text>
              <View style={styles.detailActions}>
                {selectedNotice?.created_by === user?.id && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => selectedNotice && confirmDeleteNotice(selectedNotice.id)}>
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedNotice(null)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showAddNotice} transparent animationType="fade" onRequestClose={() => setShowAddNotice(false)}>
        <ScrollView style={styles.overlay} contentContainerStyle={styles.modalCenter}>
          <View style={styles.addModal}>
            <Text style={styles.modalTitle}>Add Notice</Text>
            <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#9CA3AF" value={noticeTitle} onChangeText={setNoticeTitle} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Content" placeholderTextColor="#9CA3AF" value={noticeContent} onChangeText={setNoticeContent} multiline />
            <View style={styles.addActions}>
              <Button title="Cancel" onPress={() => setShowAddNotice(false)} variant="secondary" />
              <Button title="Post" onPress={addNotice} loading={sendingNotice} variant="primary" />
            </View>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  listContent: { padding: 16, paddingBottom: 80 },

  welcomeCard: { backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  welcomeTitle: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 6 },
  welcomeDesc: { fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 20 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  pendingBadge: { backgroundColor: "#F59E0B", minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  pendingBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  joinCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  joinCardInfo: { marginBottom: 12 },
  joinTeamName: { fontSize: 15, fontWeight: "700", color: "#2563EB", marginBottom: 2 },
  joinUserName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  joinDate: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  joinActions: { flexDirection: "row", gap: 10 },
  approveBtn: { flex: 1, backgroundColor: "#10B981", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  approveBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  rejectBtn: { flex: 1, backgroundColor: "#EF4444", borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  rejectBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  noticesHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 8 },
  noticesTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  unseenBadge: { backgroundColor: "#DC2626", minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  unseenBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  noticeCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  noticeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  noticeTitle: { fontSize: 16, fontWeight: "600", color: "#111827", flex: 1 },
  noticeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#DC2626" },
  noticePreview: { fontSize: 14, color: "#6B7280", lineHeight: 20 },
  noticeDate: { fontSize: 12, color: "#9CA3AF", marginTop: 6 },

  empty: { textAlign: "center", color: "#9CA3AF", fontSize: 15, marginTop: 20 },

  fab: { position: "absolute", bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: "#2563EB", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 30 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  detailScroll: { flex: 1 },
  detailCenter: { justifyContent: "center", padding: 24, flexGrow: 1 },
  detailModal: { backgroundColor: "#fff", borderRadius: 16, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  detailTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 4 },
  detailDate: { fontSize: 13, color: "#9CA3AF", marginBottom: 12 },
  detailContent: { fontSize: 15, color: "#374151", lineHeight: 24 },
  detailActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  deleteBtn: { paddingVertical: 10 },
  deleteBtnText: { fontSize: 16, color: "#DC2626", fontWeight: "600" },
  closeBtn: { paddingVertical: 10 },
  closeBtnText: { fontSize: 16, color: "#2563EB", fontWeight: "600" },

  modalCenter: { justifyContent: "center", padding: 24, flexGrow: 1 },
  addModal: { backgroundColor: "#fff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 16 },
  input: { backgroundColor: "#F3F4F6", padding: 14, borderRadius: 10, fontSize: 15, color: "#111827", marginBottom: 10 },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  addActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
});
