import { useEffect, useState, useMemo } from "react";
import { View, FlatList, Text, StyleSheet, RefreshControl, Alert, TouchableOpacity, Modal, TextInput, ScrollView, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { supabase, deleteUpdate } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useRoute, useNavigation } from "@react-navigation/native";
import TaskCard from "../components/TaskCard";
import Button from "../components/Button";
import { notify } from "../hooks/usePushNotifications";
import SearchFilterBar from "../components/SearchFilterBar";

interface Team {
  id: string;
  name: string;
}

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
  created_at: string | null;
  confirmed: boolean;
  deadline: string | null;
  remarks: string | null;
  response_remark: string | null;
  accepted_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  teams: { name: string };
  claimed_by_member?: { full_name: string } | null;
  started_by_member?: { full_name: string }[] | null;
  created_by_member?: { full_name: string } | null;
  rejected_by_member?: { full_name: string } | null;
}

interface TeamMember {
  member_id: string;
  members: { email: string; full_name: string } | null;
}

interface TaskUpdate {
  id: string;
  title: string;
  content: string;
  created_at: string | null;
  posted_by: string;
  members: { email: string; full_name: string } | null;
  task_id: string | null;
  tasks: { title: string } | null;
}

interface RouteParams {
  teamId: string;
  teamName: string;
}

export default function TeamTaskDetailScreen() {
  const { user } = useAuth();
  const route = useRoute<{ params: RouteParams }>();
  const navigation = useNavigation();
  const { teamId, teamName } = route.params;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"tasks" | "previous" | "members" | "updates">("tasks");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSubject, setAssignSubject] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignDeadline, setAssignDeadline] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [assignRemarks, setAssignRemarks] = useState("");
  const [sending, setSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [viewedTaskIds, setViewedTaskIds] = useState<Set<string>>(new Set());
  const [viewedUpdateIds, setViewedUpdateIds] = useState<Set<string>>(new Set());
  const [taskAssigneesMap, setTaskAssigneesMap] = useState<Record<string, string[]>>({});
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showUpdateDetailModal, setShowUpdateDetailModal] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<(TaskUpdate & { timeStr: string }) | null>(null);
  const [teamAdminId, setTeamAdminId] = useState<string | null>(null);

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

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

  const filteredUpdates = useMemo(() => {
    let list = updates;
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter((u) => u.title.toLowerCase().includes(q));
    }
    if (filterDate) {
      const target = filterDate.toDateString();
      list = list.filter((u) => u.created_at && new Date(u.created_at).toDateString() === target);
    }
    return list;
  }, [updates, searchText, filterDate]);

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, status, assigned_team_id, created_by, claimed_by, started_by, completed_at, created_at, confirmed, deadline, remarks, response_remark, accepted_at, rejected_by, rejected_at, teams!inner(name), claimed_by_member:members!claimed_by(full_name), started_by_member:members!started_by(full_name), created_by_member:members!created_by(full_name), rejected_by_member:members!rejected_by(full_name)")
      .eq("assigned_team_id", teamId)
      .order("created_at", { ascending: false });
    setTasks((data ?? []) as Task[]);
    setLoading(false);
  };

  const fetchTeamMembers = async () => {
    const { data } = await supabase.from("team_members").select("member_id, members(email, full_name)").eq("team_id", teamId);
    setTeamMembers((data ?? []) as TeamMember[]);
  };

  const fetchTeamAdmin = async () => {
    const { data } = await supabase.from("teams").select("admin_id").eq("id", teamId).single();
    if (data) setTeamAdminId(data.admin_id);
  };

  const fetchTaskAssignees = async () => {
    const { data: taskIds } = await supabase.from("tasks").select("id").eq("assigned_team_id", teamId);
    const ids = (taskIds ?? []).map((t: { id: string }) => t.id);
    if (ids.length === 0) { setTaskAssigneesMap({}); return; }
    const { data } = await supabase.from("task_assignees").select("task_id, member_id").in("task_id", ids);
    const map: Record<string, string[]> = {};
    for (const a of (data ?? []) as { task_id: string; member_id: string }[]) {
      if (!map[a.task_id]) map[a.task_id] = [];
      map[a.task_id].push(a.member_id);
    }
    setTaskAssigneesMap(map);
  };

  const fetchUpdates = async () => {
    setUpdatesLoading(true);
    const { data } = await supabase
      .from("task_updates")
      .select("id, title, content, created_at, posted_by, task_id, team_id, members!inner(email, full_name), tasks(title)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    setUpdates((data ?? []) as TaskUpdate[]);
    setUpdatesLoading(false);
  };

  const fetchViewedTasks = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("task_views").select("task_id").eq("member_id", user.id);
    setViewedTaskIds(new Set((data ?? []).map((r: { task_id: string }) => r.task_id)));
  };

  const fetchViewedUpdates = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("update_views").select("update_id").eq("member_id", user.id);
    setViewedUpdateIds(new Set((data ?? []).map((r: { update_id: string }) => r.update_id)));
  };

  useEffect(() => { fetchTasks(); fetchTeamMembers(); fetchTaskAssignees(); fetchUpdates(); fetchViewedTasks(); fetchViewedUpdates(); fetchTeamAdmin(); }, [teamId]);

  const markTaskSeen = async (taskId: string) => {
    if (!user?.id || viewedTaskIds.has(taskId)) return;
    setViewedTaskIds((prev) => new Set(prev).add(taskId));
    await supabase.from("task_views").upsert({ task_id: taskId, member_id: user.id }, { onConflict: "task_id,member_id" });
  };

  const markUpdateSeen = async (updateId: string) => {
    if (!user?.id || viewedUpdateIds.has(updateId)) return;
    setViewedUpdateIds((prev) => new Set(prev).add(updateId));
    await supabase.from("update_views").upsert({ update_id: updateId, member_id: user.id }, { onConflict: "update_id,member_id" });
  };

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (!selectedDate) return;
    if (Platform.OS === "android") {
      const newDate = assignDeadline ? new Date(assignDeadline) : new Date();
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setAssignDeadline(newDate);
      setShowTimePicker(true);
    } else {
      setAssignDeadline(selectedDate);
    }
  };

  const onTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (!selectedDate || !assignDeadline) return;
    const newDate = new Date(assignDeadline);
    newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
    setAssignDeadline(newDate);
  };

  const formatDeadline = (d: Date) => {
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const reassignTask = async (taskId: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("tasks")
      .update({ status: "pending", claimed_by: null, accepted_at: null, rejected_by: null, rejected_at: null })
      .eq("id", taskId);
    if (error) return Alert.alert("Error", error.message);
    notify("task", taskId, teamId);
    fetchTasks();
  };

  const assignTask = async () => {
    if (!assignSubject.trim()) return Alert.alert("Error", "Enter a subject");
    if (!user?.id) return Alert.alert("Error", "Not authenticated");
    setSending(true);
    try {
      const deadlineVal = assignDeadline ? assignDeadline.toISOString() : null;
      const { data: newTask, error } = await supabase.from("tasks").insert({
        title: assignSubject.trim(),
        description: assignDesc.trim() || null,
        deadline: deadlineVal,
        remarks: assignRemarks.trim() || null,
        assigned_team_id: teamId,
        created_by: user.id,
        status: "pending",
        confirmed: false,
      }).select("id").single();
      if (error) return Alert.alert("Error", error.message);
      Alert.alert("Assigned", "Task has been assigned to the team.");
      if (newTask) notify("task", newTask.id, teamId);
      setShowAssignModal(false);
      setAssignSubject("");
      setAssignDesc("");
      setAssignDeadline(null);
      setAssignRemarks("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const confirmDeleteUpdate = (updateId: string) => {
    Alert.alert("Delete Update", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        const { error } = await deleteUpdate(updateId);
        if (error) return Alert.alert("Error", error);
        fetchUpdates();
      }},
    ]);
  };

  const unseenTasks = tasks.filter(t => t.status !== "done" && !viewedTaskIds.has(t.id)).length;
  const unseenUpdates = updates.filter((u) => !viewedUpdateIds.has(u.id)).length;

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle}>{teamName}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.subTabBar}>
        <TouchableOpacity style={[styles.subTab, activeSubTab === "tasks" && styles.subTabActive]} onPress={() => setActiveSubTab("tasks")}>
          <Text style={[styles.subTabText, activeSubTab === "tasks" && styles.subTabTextActive]}>Tasks</Text>
          {unseenTasks > 0 && (
            <View style={[styles.subTabBadge, activeSubTab === "tasks" && styles.subTabBadgeActive]}>
              <Text style={styles.subTabBadgeText}>{unseenTasks}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, activeSubTab === "previous" && styles.subTabActive]} onPress={() => setActiveSubTab("previous")}>
          <Text style={[styles.subTabText, activeSubTab === "previous" && styles.subTabTextActive]}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, activeSubTab === "members" && styles.subTabActive]} onPress={() => setActiveSubTab("members")}>
          <Text style={[styles.subTabText, activeSubTab === "members" && styles.subTabTextActive]}>Members</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, activeSubTab === "updates" && styles.subTabActive]} onPress={() => setActiveSubTab("updates")}>
          <Text style={[styles.subTabText, activeSubTab === "updates" && styles.subTabTextActive]}>Updates</Text>
          {unseenUpdates > 0 && (
            <View style={[styles.subTabBadge, activeSubTab === "updates" && styles.subTabBadgeActive]}>
              <Text style={styles.subTabBadgeText}>{unseenUpdates}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeSubTab === "tasks" ? (
        <>
          <SearchFilterBar searchPlaceholder="Search tasks..." onSearchChange={setSearchText} filterDate={filterDate} onDateChange={setFilterDate} />
          <FlatList
            data={filteredTasks.filter(t => t.status !== "done")}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isTaskCreator = user?.id === item.created_by;
              return (
              <TaskCard title={item.title} description={item.description} status={item.status} teamName={teamName} remarks={item.remarks} responseRemark={item.response_remark} deadline={item.deadline} claimedByName={(item as any).claimed_by_member?.full_name} createdByName={(item as any).created_by_member?.full_name} startedByName={(item as any).started_by_member?.[0]?.full_name} completedAt={item.completed_at} createdAt={item.created_at} acceptedAt={item.accepted_at} rejectedBy={item.rejected_by} rejectedByName={(item as any).rejected_by_member?.full_name} rejectedAt={item.rejected_at} assigneeNames={(() => { const ids = taskAssigneesMap[item.id]; if (!ids) return undefined; return ids.map((mid: string) => teamMembers.find((m) => m.member_id === mid)?.members?.full_name || mid).filter(Boolean); })()} onOpen={() => markTaskSeen(item.id)} onReassign={isTaskCreator ? () => reassignTask(item.id) : undefined} />
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No active tasks for this team</Text>}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { fetchTasks(); fetchTaskAssignees(); }} />}
            contentContainerStyle={tasks.filter(t => t.status !== "done").length === 0 ? styles.emptyContainer : undefined}
          />
          <TouchableOpacity style={styles.fab} onPress={() => setShowAssignModal(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </>
      ) : activeSubTab === "previous" ? (
        <>
          <SearchFilterBar searchPlaceholder="Search completed tasks..." onSearchChange={setSearchText} filterDate={filterDate} onDateChange={setFilterDate} />
          <FlatList
            data={filteredTasks.filter(t => t.status === "done")}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TaskCard title={item.title} description={item.description} status={item.status} teamName={teamName} remarks={item.remarks} responseRemark={item.response_remark} deadline={item.deadline} claimedByName={(item as any).claimed_by_member?.full_name} createdByName={(item as any).created_by_member?.full_name} startedByName={(item as any).started_by_member?.[0]?.full_name} completedAt={item.completed_at} createdAt={item.created_at} acceptedAt={item.accepted_at} rejectedBy={item.rejected_by} rejectedByName={(item as any).rejected_by_member?.full_name} rejectedAt={item.rejected_at} assigneeNames={(() => { const ids = taskAssigneesMap[item.id]; if (!ids) return undefined; return ids.map((mid: string) => teamMembers.find((m) => m.member_id === mid)?.members?.full_name || mid).filter(Boolean); })()} />
            )}
            ListEmptyComponent={<Text style={styles.empty}>No completed tasks yet</Text>}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { fetchTasks(); fetchTaskAssignees(); }} />}
            contentContainerStyle={tasks.filter(t => t.status === "done").length === 0 ? styles.emptyContainer : undefined}
          />
        </>
      ) : activeSubTab === "members" ? (
        <FlatList
          data={teamMembers}
          keyExtractor={(item) => item.member_id}
          renderItem={({ item }) => {
            const isAdmin = item.member_id === teamAdminId;
            return (
              <View style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {(item.members?.full_name || item.members?.email || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{item.members?.full_name || "Unknown"}</Text>
                    {isAdmin && <Text style={styles.adminBadge}> 👑</Text>}
                  </View>
                  <Text style={styles.memberEmail}>{item.members?.email || ""}</Text>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={() => (
            <Text style={styles.memberCount}>{teamMembers.length} member{teamMembers.length !== 1 ? "s" : ""}</Text>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No members in this team</Text>}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <SearchFilterBar searchPlaceholder="Search updates..." onSearchChange={setSearchText} filterDate={filterDate} onDateChange={setFilterDate} />
          <FlatList
            data={filteredUpdates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isOwner = user?.id === item.posted_by;
              return (
              <TouchableOpacity style={styles.updateCard} onPress={() => { markUpdateSeen(item.id); setSelectedUpdate({ ...item, timeStr: formatTime(item.created_at) }); setShowUpdateDetailModal(true); }} onLongPress={isOwner ? () => confirmDeleteUpdate(item.id) : undefined} activeOpacity={0.7}>
                <View style={styles.updateCardRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.updateTask}>{item.title}</Text>
                    {item.tasks?.title && <Text style={styles.updateRelatedTask}>on {item.tasks.title}</Text>}
                    <Text style={styles.updateContent}>{item.content}</Text>
                    <Text style={styles.updateAuthor}>{item.members?.full_name || item.members?.email}</Text>
                  </View>
                  {isOwner && (
                    <TouchableOpacity onPress={() => confirmDeleteUpdate(item.id)} style={styles.updateDeleteBtn}>
                      <Text style={styles.updateDeleteText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No updates yet</Text>}
            refreshing={updatesLoading}
            contentContainerStyle={updates.length === 0 ? styles.emptyContainer : undefined}
          />
        </View>
      )}

      <Modal visible={showUpdateDetailModal} transparent animationType="fade" onRequestClose={() => setShowUpdateDetailModal(false)}>
        <ScrollView style={styles.modalOverlay} contentContainerStyle={styles.modalCenter}>
          <TouchableOpacity activeOpacity={1} onPress={() => setShowUpdateDetailModal(false)}>
            <View style={styles.assignModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedUpdate?.title || "Update"}</Text>
                <TouchableOpacity onPress={() => setShowUpdateDetailModal(false)} style={{ padding: 4 }}>
                  <Text style={{ fontSize: 22, color: "#9CA3AF" }}>✕</Text>
                </TouchableOpacity>
              </View>
              {selectedUpdate && (
                <>
                  <Text style={styles.detailContent}>{selectedUpdate.content}</Text>
                  <Text style={styles.detailMeta}>
                    Posted by {selectedUpdate.members?.full_name || selectedUpdate.members?.email || "Unknown"} · {selectedUpdate.timeStr}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      <Modal visible={showAssignModal} transparent animationType="fade" onRequestClose={() => setShowAssignModal(false)}>
        <ScrollView style={styles.modalOverlay} contentContainerStyle={styles.modalCenter}>
          <View style={styles.assignModal}>
            <Text style={styles.modalTitle}>Assign Task to {teamName}</Text>
            <TextInput style={styles.input} placeholder="Subject *" placeholderTextColor="#9CA3AF" value={assignSubject} onChangeText={setAssignSubject} />
            <TextInput style={[styles.input, styles.textArea]} placeholder="Description" placeholderTextColor="#9CA3AF" value={assignDesc} onChangeText={setAssignDesc} multiline />
            <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.datePickerLabel}>Deadline</Text>
              <Text style={styles.datePickerValue}>{assignDeadline ? formatDeadline(assignDeadline) : "Select date & time"}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker value={assignDeadline || new Date()} mode={Platform.OS === "ios" ? "datetime" : "date"} display="default" onChange={onDateChange} />
            )}
            {showTimePicker && Platform.OS === "android" && (
              <DateTimePicker value={assignDeadline || new Date()} mode="time" display="default" onChange={onTimeChange} />
            )}
            <TextInput style={[styles.input, styles.textArea]} placeholder="Remarks (optional)" placeholderTextColor="#9CA3AF" value={assignRemarks} onChangeText={setAssignRemarks} multiline />
            <View style={styles.assignActions}>
              <Button title="Cancel" onPress={() => setShowAssignModal(false)} variant="secondary" />
              <Button title="Assign" onPress={assignTask} loading={sending} variant="primary" />
            </View>
          </View>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },

  detailHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 16, color: "#2563EB", fontWeight: "500" },
  detailTitle: { fontSize: 18, fontWeight: "700", color: "#111827", flex: 1, textAlign: "center" },

  subTabBar: {
    flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  subTab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  subTabActive: { borderBottomWidth: 2, borderBottomColor: "#2563EB" },
  subTabText: { fontSize: 14, fontWeight: "500", color: "#9CA3AF" },
  subTabTextActive: { color: "#2563EB", fontWeight: "600" },
  subTabBadge: {
    position: "absolute", top: 4, right: 10,
    backgroundColor: "#9CA3AF", minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 4,
  },
  subTabBadgeActive: { backgroundColor: "#2563EB" },
  subTabBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  empty: { textAlign: "center", color: "#6B7280", fontSize: 16, marginTop: 20 },
  emptyContainer: { flex: 1, justifyContent: "center" },

  fab: {
    position: "absolute", bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#2563EB",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 30 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  modalCenter: { justifyContent: "center", padding: 24, flexGrow: 1 },
  assignModal: { backgroundColor: "#fff", borderRadius: 16, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  detailContent: { fontSize: 15, color: "#374151", lineHeight: 22, marginBottom: 16 },
  detailMeta: { fontSize: 13, color: "#6B7280", marginTop: 4 },
  input: { backgroundColor: "#F3F4F6", padding: 14, borderRadius: 10, fontSize: 15, color: "#111827", marginBottom: 10 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  assignActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  datePickerBtn: {
    backgroundColor: "#F3F4F6", padding: 14, borderRadius: 10, marginBottom: 10,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  datePickerLabel: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  datePickerValue: { fontSize: 15, color: "#111827", fontWeight: "600" },

  updateCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginHorizontal: 16, marginVertical: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  updateCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  updateTask: { fontSize: 15, color: "#111827", fontWeight: "600", marginBottom: 2 },
  updateRelatedTask: { fontSize: 12, color: "#2563EB", fontWeight: "500", marginBottom: 4 },
  updateContent: { fontSize: 15, color: "#111827", lineHeight: 20 },
  updateAuthor: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  updateDeleteBtn: { padding: 4 },
  updateDeleteText: { fontSize: 18, color: "#DC2626", fontWeight: "700" },

  memberRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12, backgroundColor: "#fff",
    paddingHorizontal: 16, marginBottom: 1,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#2563EB",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  memberAvatarText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: "row", alignItems: "center" },
  memberName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  adminBadge: { fontSize: 16 },
  memberEmail: { fontSize: 13, color: "#6B7280", marginTop: 1 },
  memberCount: { fontSize: 13, color: "#6B7280", paddingBottom: 8, paddingHorizontal: 16 },
});
