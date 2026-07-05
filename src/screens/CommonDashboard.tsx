import { useEffect, useState, useMemo } from "react";
import { View, FlatList, Text, StyleSheet, RefreshControl, ActivityIndicator, Alert, TouchableOpacity, Modal, TextInput, ScrollView, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { supabase, deleteUpdate } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
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
  teams: { name: string };
  claimed_by_member?: { full_name: string } | null;
  started_by_member?: { full_name: string }[] | null;
  created_by_member?: { full_name: string } | null;
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

export default function CommonDashboard() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"tasks" | "updates">("tasks");
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
  const [activeTasksOverview, setActiveTasksOverview] = useState<{ id: string; assigned_team_id: string; status: string; confirmed: boolean }[]>([]);
  const [teamUpdatesOverview, setTeamUpdatesOverview] = useState<{ id: string; assigned_team_id: string }[]>([]);
  const [taskAssigneesMap, setTaskAssigneesMap] = useState<Record<string, string[]>>({});
  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState<Date | null>(null);

  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) => t.confirmed);
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

  const teamUnseenTasks: Record<string, number> = {};
  const teamPendingAcceptance: Record<string, number> = {};
  const teamPending: Record<string, number> = {};
  const teamInProgress: Record<string, number> = {};
  for (const t of activeTasksOverview) {
    const tid = t.assigned_team_id;
    if (t.status === "in_progress") teamInProgress[tid] = (teamInProgress[tid] || 0) + 1;
    if (t.status === "pending" && t.confirmed) teamPending[tid] = (teamPending[tid] || 0) + 1;
    if (!t.confirmed) teamPendingAcceptance[tid] = (teamPendingAcceptance[tid] || 0) + 1;
    if (!viewedTaskIds.has(t.id)) teamUnseenTasks[tid] = (teamUnseenTasks[tid] || 0) + 1;
  }

  const teamUnseenUpdates: Record<string, number> = {};
  for (const u of teamUpdatesOverview) {
    if (!viewedUpdateIds.has(u.id)) {
      teamUnseenUpdates[u.assigned_team_id] = (teamUnseenUpdates[u.assigned_team_id] || 0) + 1;
    }
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  const fetchOverview = async () => {
    if (!user?.id) return;
    const { data: taskData } = await supabase
      .from("tasks").select("id, assigned_team_id, status, confirmed").neq("status", "done");
    setActiveTasksOverview((taskData ?? []) as { id: string; assigned_team_id: string; status: string; confirmed: boolean }[]);
    const { data: updatesData } = await supabase
      .from("task_updates").select("id, team_id");
    setTeamUpdatesOverview((updatesData ?? []).map((u: any) => ({ id: u.id, assigned_team_id: u.team_id })));
  };

  const fetchTeams = async () => {
    const { data } = await supabase.from("teams").select("id, name").order("name");
    setTeams((data ?? []) as Team[]);
    await fetchOverview();
  };

  const fetchTasks = async () => {
    setLoading(true);
    if (selectedTeamId) {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, description, status, assigned_team_id, created_by, claimed_by, started_by, completed_at, created_at, confirmed, deadline, remarks, teams!inner(name), claimed_by_member:members!claimed_by(full_name), started_by_member:members!started_by(full_name), created_by_member:members!created_by(full_name)")
        .eq("assigned_team_id", selectedTeamId)
        .eq("confirmed", true)
        .order("created_at", { ascending: false });
      setTasks((data ?? []) as Task[]);
    } else {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, description, status, assigned_team_id, created_by, claimed_by, started_by, completed_at, created_at, confirmed, deadline, remarks, teams(name), claimed_by_member:members!claimed_by(full_name), started_by_member:members!started_by(full_name), created_by_member:members!created_by(full_name)")
        .eq("confirmed", true)
        .order("created_at", { ascending: false });
      setTasks((data ?? []) as Task[]);
    }
    setLoading(false);
  };

  const fetchTeamMembers = async (teamId: string) => {
    const { data } = await supabase.from("team_members").select("member_id, members(email, full_name)").eq("team_id", teamId);
    setTeamMembers((data ?? []) as TeamMember[]);
  };

  useEffect(() => { fetchTeams(); }, []);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTasks();
      fetchTeamMembers(selectedTeamId);
      fetchTaskAssignees(selectedTeamId);
    } else {
      fetchTasks();
    }
  }, [selectedTeamId]);

  const fetchTaskAssignees = async (teamId: string) => {
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

  const fetchUpdates = async (teamId: string) => {
    setUpdatesLoading(true);
    const { data } = await supabase
      .from("task_updates")
      .select("id, title, content, created_at, posted_by, task_id, team_id, members!inner(email, full_name), tasks(title)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    setUpdates((data ?? []) as TaskUpdate[]);
    setUpdatesLoading(false);
  };

  const fetchViewedUpdates = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("update_views").select("update_id").eq("member_id", user.id);
    setViewedUpdateIds(new Set((data ?? []).map((r: { update_id: string }) => r.update_id)));
  };

  const confirmDeleteUpdate = (updateId: string) => {
    Alert.alert("Delete Update", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        const { error } = await deleteUpdate(updateId);
        if (error) return Alert.alert("Error", error);
        if (selectedTeamId) fetchUpdates(selectedTeamId);
        fetchOverview();
      }},
    ]);
  };

  const fetchViewedTasks = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from("task_views").select("task_id").eq("member_id", user.id);
    setViewedTaskIds(new Set((data ?? []).map((r: { task_id: string }) => r.task_id)));
  };

  useEffect(() => { if (selectedTeamId) fetchViewedTasks(); }, [selectedTeamId]);
  useEffect(() => { if (selectedTeamId) fetchViewedUpdates(); }, [selectedTeamId]);
  useEffect(() => { if (selectedTeamId) fetchUpdates(selectedTeamId); }, [selectedTeamId]);

  const markUpdateSeen = async (updateId: string) => {
    if (!user?.id || viewedUpdateIds.has(updateId)) return;
    setViewedUpdateIds((prev) => new Set(prev).add(updateId));
    await supabase.from("update_views").upsert({ update_id: updateId, member_id: user.id }, { onConflict: "update_id,member_id" });
    fetchOverview();
  };

  const markTaskSeen = async (taskId: string) => {
    if (!user?.id || viewedTaskIds.has(taskId)) return;
    setViewedTaskIds((prev) => new Set(prev).add(taskId));
    await supabase.from("task_views").upsert({ task_id: taskId, member_id: user.id }, { onConflict: "task_id,member_id" });
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

  const assignTask = async () => {
    if (!assignSubject.trim()) return Alert.alert("Error", "Enter a subject");
    if (!selectedTeamId) return;
    if (!user?.id) return Alert.alert("Error", "Not authenticated");
    setSending(true);
    try {
      const deadlineVal = assignDeadline ? assignDeadline.toISOString() : null;
      const { data: newTask, error } = await supabase.from("tasks").insert({
        title: assignSubject.trim(),
        description: assignDesc.trim() || null,
        deadline: deadlineVal,
        remarks: assignRemarks.trim() || null,
        assigned_team_id: selectedTeamId,
        created_by: user.id,
        status: "pending",
        confirmed: false,
      }).select("id").single();
      if (error) return Alert.alert("Error", error.message);
      Alert.alert("Assigned", "Task has been assigned to the team.");
      if (newTask) notify("task", newTask.id, selectedTeamId);
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

  if (!selectedTeamId) {
    if (loading) return <ActivityIndicator style={{ flex: 1 }} />;
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>All Teams</Text>
        <FlatList
          key="teamList"
          data={teams}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const pendingAcc = teamPendingAcceptance[item.id] || 0;
            const pend = teamPending[item.id] || 0;
            const inProg = teamInProgress[item.id] || 0;
            const unseen = teamUnseenTasks[item.id] || 0;
            const uUnseen = teamUnseenUpdates[item.id] || 0;
            return (
              <TouchableOpacity style={styles.teamGridCard} onPress={() => setSelectedTeamId(item.id)}>
                <View>
                  <View style={styles.teamCardRow}>
                    <Text style={styles.teamGridName}>{item.name}</Text>
                    {unseen > 0 && (
                      <View style={styles.teamCardBadge}>
                        <Text style={styles.teamCardBadgeText}>{unseen}</Text>
                      </View>
                    )}
                    {uUnseen > 0 && (
                      <View style={[styles.teamCardBadge, { backgroundColor: "#8B5CF6" }]}>
                        <Text style={styles.teamCardBadgeText}>{uUnseen}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.teamCardMeta}>
                    {pendingAcc > 0 && <Text style={styles.teamCardMetaText}>{pendingAcc} pending acceptance</Text>}
                    {pend > 0 && <Text style={styles.teamCardMetaText}>{pend} pending</Text>}
                    {inProg > 0 && <Text style={styles.teamCardMetaText}>{inProg} in progress</Text>}
                  </View>
                </View>
                <Text style={styles.teamGridArrow}>›</Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTeams} />}
        />
      </View>
    );
  }

  const confirmedTasks = tasks.filter((t) => t.confirmed);

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => setSelectedTeamId(null)} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.detailTitle}>{selectedTeam?.name}</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.subTabBar}>
        <TouchableOpacity style={[styles.subTab, activeSubTab === "tasks" && styles.subTabActive]} onPress={() => setActiveSubTab("tasks")}>
          <Text style={[styles.subTabText, activeSubTab === "tasks" && styles.subTabTextActive]}>Tasks</Text>
          {(() => { const unseen = confirmedTasks.filter(t => t.status !== "done" && !viewedTaskIds.has(t.id)).length; return unseen > 0 ? (
            <View style={[styles.subTabBadge, activeSubTab === "tasks" && styles.subTabBadgeActive]}>
              <Text style={styles.subTabBadgeText}>{unseen}</Text>
            </View>
          ) : null; })()}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.subTab, activeSubTab === "updates" && styles.subTabActive]} onPress={() => setActiveSubTab("updates")}>
          <Text style={[styles.subTabText, activeSubTab === "updates" && styles.subTabTextActive]}>Updates</Text>
          {(() => { const unseen = updates.filter((u) => !viewedUpdateIds.has(u.id)).length; return unseen > 0 ? (
            <View style={[styles.subTabBadge, activeSubTab === "updates" && styles.subTabBadgeActive]}>
              <Text style={styles.subTabBadgeText}>{unseen}</Text>
            </View>
          ) : null; })()}
        </TouchableOpacity>
      </View>

      {activeSubTab === "tasks" ? (
        <>
          <SearchFilterBar searchPlaceholder="Search tasks..." onSearchChange={setSearchText} filterDate={filterDate} onDateChange={setFilterDate} />
          <FlatList
            key="taskList"
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TaskCard title={item.title} description={item.description} status={item.status} teamName={selectedTeam?.name ?? ""} remarks={item.remarks} deadline={item.deadline} claimedByName={(item as any).claimed_by_member?.full_name} createdByName={(item as any).created_by_member?.full_name} startedByName={(item as any).started_by_member?.[0]?.full_name} completedAt={item.completed_at} assigneeNames={(() => { const ids = taskAssigneesMap[item.id]; if (!ids) return undefined; return ids.map((mid: string) => teamMembers.find((m) => m.member_id === mid)?.members?.full_name || mid).filter(Boolean); })()} onOpen={() => markTaskSeen(item.id)} />
            )}
            ListEmptyComponent={<Text style={styles.empty}>No confirmed tasks for this team</Text>}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { fetchTasks(); if (selectedTeamId) fetchTaskAssignees(selectedTeamId); }} />}
            contentContainerStyle={confirmedTasks.length === 0 ? styles.emptyContainer : undefined}
          />

          <TouchableOpacity style={styles.fab} onPress={() => setShowAssignModal(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <SearchFilterBar searchPlaceholder="Search updates..." onSearchChange={setSearchText} filterDate={filterDate} onDateChange={setFilterDate} />
          <FlatList
            data={filteredUpdates}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isOwner = user?.id === item.posted_by;
              return (
              <TouchableOpacity style={styles.updateCard} onPress={() => markUpdateSeen(item.id)} onLongPress={isOwner ? () => confirmDeleteUpdate(item.id) : undefined} activeOpacity={0.7}>
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

      <Modal visible={showAssignModal} transparent animationType="fade" onRequestClose={() => setShowAssignModal(false)}>
        <ScrollView style={styles.modalOverlay} contentContainerStyle={styles.modalCenter}>
          <View style={styles.assignModal}>
            <Text style={styles.modalTitle}>Assign Task to {selectedTeam?.name}</Text>
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
  pageTitle: { fontSize: 24, fontWeight: "700", color: "#111827", padding: 16, paddingBottom: 0 },

  teamGridCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    marginBottom: 10,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 80,
  },
  teamCardRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  teamCardMeta: { flexDirection: "row", gap: 12, marginTop: 6 },
  teamCardMetaText: { fontSize: 12, color: "#6B7280" },
  teamGridName: { fontSize: 16, fontWeight: "600", color: "#111827" },
  teamCardBadge: {
    backgroundColor: "#DC2626", minWidth: 20, height: 20, borderRadius: 10,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 5,
  },
  teamCardBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  teamGridArrow: { fontSize: 20, color: "#9CA3AF", textAlign: "right", marginTop: 8 },

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
  subTabText: { fontSize: 15, fontWeight: "500", color: "#9CA3AF" },
  subTabTextActive: { color: "#2563EB", fontWeight: "600" },
  subTabBadge: {
    position: "absolute", top: 4, right: 20,
    backgroundColor: "#9CA3AF", minWidth: 18, height: 18, borderRadius: 9,
    justifyContent: "center", alignItems: "center", paddingHorizontal: 4,
  },
  subTabBadgeActive: { backgroundColor: "#2563EB" },
  subTabBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  empty: { textAlign: "center", color: "#6B7280", fontSize: 16 },
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
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 16 },
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
});
