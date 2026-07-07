import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ActivityIndicator, FlatList, TextInput } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { supabase, deleteUpdate } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { notify } from "../hooks/usePushNotifications";
import Button from "../components/Button";
import TaskCard from "../components/TaskCard";
import SearchFilterBar from "../components/SearchFilterBar";

interface Member {
  member_id: string;
  members: {
    full_name: string;
    email: string;
  } | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_by: string;
  claimed_by: string | null;
  completed_at: string | null;
  created_at: string | null;
  deadline: string | null;
  remarks: string | null;
  response_remark: string | null;
  accepted_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  created_by_member?: { full_name: string } | null;
  claimed_by_member?: { full_name: string } | null;
  rejected_by_member?: { full_name: string } | null;
}

interface TaskUpdate {
  id: string;
  title: string;
  content: string;
  created_at: string | null;
  posted_by: string;
  members: { full_name: string; email: string } | null;
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

  const [activeTab, setActiveTab] = useState<"tasks" | "previous" | "updates">("tasks");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [pendingAcceptTaskId, setPendingAcceptTaskId] = useState<string | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set());

  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [pendingRemarkTaskId, setPendingRemarkTaskId] = useState<string | null>(null);
  const [remarkActionType, setRemarkActionType] = useState<"reject" | "complete" | null>(null);
  const [remarkText, setRemarkText] = useState("");

  const [updates, setUpdates] = useState<TaskUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filterDate, setFilterDate] = useState<Date | null>(null);
  const [showAddUpdateModal, setShowAddUpdateModal] = useState(false);
  const [newUpdateTitle, setNewUpdateTitle] = useState("");
  const [newUpdateContent, setNewUpdateContent] = useState("");
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const [showUpdateDetailModal, setShowUpdateDetailModal] = useState(false);
  const [selectedUpdate, setSelectedUpdate] = useState<(TaskUpdate & { timeStr: string }) | null>(null);

  const [teamAdminId, setTeamAdminId] = useState<string | null>(null);
  const [showMemberActionModal, setShowMemberActionModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

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

  const fetchMembers = async () => {
    setLoadingMembers(true);
    const { data } = await supabase
      .from("team_members")
      .select("member_id, members(full_name, email)")
      .eq("team_id", teamId);
    setMembers((data ?? []) as Member[]);
    setLoadingMembers(false);
  };

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, status, created_by, claimed_by, completed_at, created_at, deadline, remarks, response_remark, accepted_at, rejected_by, rejected_at, created_by_member:members!created_by(full_name), claimed_by_member:members!claimed_by(full_name), rejected_by_member:members!rejected_by(full_name)")
      .eq("assigned_team_id", teamId)
      .order("created_at", { ascending: false });
    setTasks((data ?? []) as Task[]);
    setTasksLoading(false);
  }, [teamId]);

  const fetchUpdates = async () => {
    setUpdatesLoading(true);
    const { data } = await supabase
      .from("task_updates")
      .select("id, title, content, created_at, posted_by, members!inner(full_name, email)")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    setUpdates((data ?? []) as TaskUpdate[]);
    setUpdatesLoading(false);
  };

  const submitUpdate = async () => {
    if (!newUpdateTitle.trim() || !newUpdateContent.trim()) { Alert.alert("Error", "Title and description are required"); return; }
    if (!user?.id) return;
    setSendingUpdate(true);
    const { data: newUpdate, error } = await supabase.from("task_updates").insert({
      team_id: teamId,
      posted_by: user.id,
      title: newUpdateTitle.trim(),
      content: newUpdateContent.trim(),
    }).select("id").single();
    setSendingUpdate(false);
    if (error) { Alert.alert("Error", error.message); return; }
    if (newUpdate) notify("update", newUpdate.id, teamId);
    setShowAddUpdateModal(false);
    setNewUpdateTitle("");
    setNewUpdateContent("");
    fetchUpdates();
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

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const fetchTeamAdmin = async () => {
    const { data } = await supabase.from("teams").select("admin_id").eq("id", teamId).single();
    if (data) setTeamAdminId(data.admin_id);
  };

  const isAdmin = user?.id === teamAdminId;

  useEffect(() => { fetchMembers(); fetchTasks(); fetchUpdates(); fetchTeamAdmin(); }, [teamId, fetchTasks]);

  const openAcceptModal = (taskId: string) => {
    if (!user?.id) return;
    setPendingAcceptTaskId(taskId);
    setSelectedAssigneeIds(new Set([user.id]));
    setShowMemberSelect(true);
  };

  const toggleAssignee = (memberId: string) => {
    setSelectedAssigneeIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const confirmAccept = async () => {
    if (!user?.id || !pendingAcceptTaskId) return;
    if (selectedAssigneeIds.size === 0) return Alert.alert("Error", "Select at least one member");
    const { error } = await supabase
      .from("tasks")
      .update({ status: "in_progress", claimed_by: user.id, accepted_at: new Date().toISOString() })
      .eq("id", pendingAcceptTaskId);
    if (error) { Alert.alert("Error", error.message); return; }
    const assignees = [...selectedAssigneeIds].map((member_id) => ({ task_id: pendingAcceptTaskId, member_id }));
    const { error: assignErr } = await supabase.from("task_assignees").insert(assignees);
    if (assignErr) console.error("task_assignees insert error:", assignErr);
    setShowMemberSelect(false);
    setPendingAcceptTaskId(null);
    fetchTasks();
  };

  const openRejectModal = (taskId: string) => {
    setPendingRemarkTaskId(taskId);
    setRemarkActionType("reject");
    setRemarkText("");
    setShowRemarkModal(true);
  };

  const openCompleteModal = (taskId: string) => {
    setPendingRemarkTaskId(taskId);
    setRemarkActionType("complete");
    setRemarkText("");
    setShowRemarkModal(true);
  };

  const confirmRemark = async () => {
    if (!user?.id || !pendingRemarkTaskId || !remarkActionType) return;
    if (remarkActionType === "reject" && !remarkText.trim()) return Alert.alert("Error", "Remark is required when rejecting");
    const update: Record<string, any> = { response_remark: remarkText.trim() || null };
    if (remarkActionType === "reject") {
      update.status = "rejected";
      update.rejected_by = user.id;
      update.rejected_at = new Date().toISOString();
    } else {
      update.status = "done";
      update.completed_at = new Date().toISOString();
    }
    const { error } = await supabase.from("tasks").update(update).eq("id", pendingRemarkTaskId);
    if (error) return Alert.alert("Error", error.message);
    setShowRemarkModal(false);
    setPendingRemarkTaskId(null);
    setRemarkActionType(null);
    setRemarkText("");
    fetchTasks();
  };

  const handleLeaveTeam = async () => {
    Alert.alert("Leave Team", `Are you sure you want to leave "${teamName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave", style: "destructive",
        onPress: async () => {
          if (!user?.id) return;
          setLeaving(true);
          if (isAdmin) {
            await supabase.from("teams").update({ admin_id: null }).eq("id", teamId);
          }
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

  const currentTasks = tasks.filter(t => t.status !== "done");
  const doneTasks = tasks.filter(t => t.status === "done");

  const renderTaskItem = (item: Task) => (
    <TaskCard
      title={item.title}
      description={item.description}
      status={item.status}
      teamName={teamName}
      deadline={item.deadline}
      remarks={item.remarks}
      responseRemark={item.response_remark}
      createdByName={item.created_by_member?.full_name}
      claimedByName={item.claimed_by_member?.full_name}
      completedAt={item.completed_at}
      createdAt={item.created_at}
      acceptedAt={item.accepted_at}
      rejectedBy={item.rejected_by}
      rejectedByName={item.rejected_by_member?.full_name}
      rejectedAt={item.rejected_at}
      actionButtons={
        item.status === "pending" ? (
          <>
            <TouchableOpacity style={styles.acceptBtn} onPress={() => openAcceptModal(item.id)}>
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => openRejectModal(item.id)}>
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </>
        ) : item.status === "in_progress" ? (
          <TouchableOpacity style={styles.completeBtn} onPress={() => openCompleteModal(item.id)}>
            <Text style={styles.completeBtnText}>Mark as Completed</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );

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
        <TouchableOpacity style={[styles.tab, activeTab === "tasks" && styles.tabActive]} onPress={() => setActiveTab("tasks")}>
          <Text style={[styles.tabText, activeTab === "tasks" && styles.tabTextActive]}>Assigned Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "previous" && styles.tabActive]} onPress={() => setActiveTab("previous")}>
          <Text style={[styles.tabText, activeTab === "previous" && styles.tabTextActive]}>Previous Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "updates" && styles.tabActive]} onPress={() => setActiveTab("updates")}>
          <Text style={[styles.tabText, activeTab === "updates" && styles.tabTextActive]}>Updates</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContent}>
        {activeTab === "tasks" ? (
          tasksLoading ? (
            <ActivityIndicator style={styles.loading} size="large" />
          ) : currentTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No tasks assigned yet</Text>
              <Text style={styles.emptySubtext}>Tasks assigned to this team will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={currentTasks}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderTaskItem(item)}
              contentContainerStyle={styles.listContent}
            />
          )
        ) : activeTab === "previous" ? (
          tasksLoading ? (
            <ActivityIndicator style={styles.loading} size="large" />
          ) : doneTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No previous tasks</Text>
              <Text style={styles.emptySubtext}>Completed tasks will appear here</Text>
            </View>
          ) : (
            <FlatList
              data={doneTasks}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TaskCard
                  title={item.title}
                  description={item.description}
                  status={item.status}
                  teamName={teamName}
                  deadline={item.deadline}
                  remarks={item.remarks}
                  responseRemark={item.response_remark}
                  createdByName={item.created_by_member?.full_name}
                  claimedByName={item.claimed_by_member?.full_name}
                  completedAt={item.completed_at}
                  createdAt={item.created_at}
                  acceptedAt={item.accepted_at}
                  rejectedBy={item.rejected_by}
                  rejectedByName={item.rejected_by_member?.full_name}
                  rejectedAt={item.rejected_at}
                />
              )}
              contentContainerStyle={styles.listContent}
            />
          )
        ) : (
          <View style={{ flex: 1 }}>
            <SearchFilterBar searchPlaceholder="Search updates..." onSearchChange={setSearchText} filterDate={filterDate} onDateChange={setFilterDate} />
            {updatesLoading ? (
              <ActivityIndicator style={styles.loading} size="large" />
            ) : (
              <FlatList
                data={filteredUpdates}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isOwner = user?.id === item.posted_by;
                  return (
                  <TouchableOpacity
                    style={styles.updateCard}
                    onPress={() => {
                      setSelectedUpdate({ ...item, timeStr: formatTime(item.created_at) });
                      setShowUpdateDetailModal(true);
                    }}
                    onLongPress={isOwner ? () => confirmDeleteUpdate(item.id) : undefined}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.updateCardTitle}>{item.title}</Text>
                      <Text style={styles.updateCardContent} numberOfLines={2}>{item.content}</Text>
                      <Text style={styles.updateCardAuthor}>{item.members?.full_name || item.members?.email} · {formatTime(item.created_at)}</Text>
                    </View>
                  </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={styles.emptyText}>No updates yet</Text>}
                contentContainerStyle={filteredUpdates.length === 0 ? styles.emptyContainerStyle : styles.listContent}
              />
            )}
            <TouchableOpacity style={styles.fabBlue} onPress={() => setShowAddUpdateModal(true)} activeOpacity={0.8}>
              <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={showAddUpdateModal} transparent animationType="fade" onRequestClose={() => setShowAddUpdateModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAddUpdateModal(false)}>
          <View style={styles.modalContainerSmall}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Update</Text>
                <TouchableOpacity onPress={() => setShowAddUpdateModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Title *"
                placeholderTextColor="#9CA3AF"
                value={newUpdateTitle}
                onChangeText={setNewUpdateTitle}
              />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description *"
                placeholderTextColor="#9CA3AF"
                value={newUpdateContent}
                onChangeText={setNewUpdateContent}
                multiline
              />
              <View style={styles.modalFooter}>
                <Button title="Cancel" onPress={() => setShowAddUpdateModal(false)} variant="secondary" />
                <Button title="Post" onPress={submitUpdate} loading={sendingUpdate} variant="primary" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showUpdateDetailModal} transparent animationType="fade" onRequestClose={() => setShowUpdateDetailModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowUpdateDetailModal(false)}>
          <View style={styles.modalContainerSmall}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedUpdate?.title || "Update"}</Text>
                <TouchableOpacity onPress={() => setShowUpdateDetailModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
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
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showInfoModal} transparent animationType="fade" onRequestClose={closeInfoModal}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeInfoModal}>
          <View style={styles.modalContainer}>
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
                  renderItem={({ item }) => {
                    const isItemAdmin = item.member_id === teamAdminId;
                    const canManage = isAdmin && item.member_id !== user?.id;
                    return (
                      <TouchableOpacity
                        style={styles.memberRow}
                        onPress={canManage ? () => { setSelectedMember(item); setShowMemberActionModal(true); } : undefined}
                        activeOpacity={canManage ? 0.6 : 1}
                        disabled={!canManage}
                      >
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberAvatarText}>
                            {(item.members?.full_name || item.members?.email || "?").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <View style={styles.memberNameRow}>
                            <Text style={styles.memberName}>{item.members?.full_name || "Unknown"}</Text>
                            {isItemAdmin && <Text style={styles.adminBadge}> 👑</Text>}
                          </View>
                          <Text style={styles.memberEmail}>{item.members?.email || ""}</Text>
                        </View>
                        {canManage && <Text style={styles.memberActionChevron}>›</Text>}
                      </TouchableOpacity>
                    );
                  }}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              )}

              <View style={styles.modalFooter}>
                <Button title="Exit Group" onPress={handleLeaveTeam} variant="danger" loading={leaving} fullWidth />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showMemberActionModal} transparent animationType="fade" onRequestClose={() => setShowMemberActionModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMemberActionModal(false)}>
          <View style={styles.modalContainerSmall}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedMember?.members?.full_name || "Member"}</Text>
                <TouchableOpacity onPress={() => setShowMemberActionModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={async () => {
                  if (!selectedMember) return;
                  setShowMemberActionModal(false);
                  const { error } = await supabase.from("teams").update({ admin_id: selectedMember.member_id }).eq("id", teamId);
                  if (error) { Alert.alert("Error", error.message); return; }
                  setTeamAdminId(selectedMember.member_id);
                  fetchMembers();
                }}
              >
                <Text style={styles.actionRowIcon}>👑</Text>
                <View style={styles.actionRowInfo}>
                  <Text style={styles.actionRowLabel}>Make Admin</Text>
                  <Text style={styles.actionRowDesc}>Transfer admin privileges to this member</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.actionDivider} />
              <TouchableOpacity
                style={styles.actionRow}
                onPress={async () => {
                  if (!selectedMember) return;
                  setShowMemberActionModal(false);
                  const { error } = await supabase.from("team_members").delete()
                    .eq("member_id", selectedMember.member_id).eq("team_id", teamId);
                  if (error) { Alert.alert("Error", error.message); return; }
                  fetchMembers();
                }}
              >
                <Text style={styles.actionRowIconDanger}>✕</Text>
                <View style={styles.actionRowInfo}>
                  <Text style={styles.actionRowLabelDanger}>Remove from Group</Text>
                  <Text style={styles.actionRowDesc}>Remove this member from the team</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showMemberSelect} transparent animationType="fade" onRequestClose={() => setShowMemberSelect(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMemberSelect(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assign Team Members</Text>
                <TouchableOpacity onPress={() => setShowMemberSelect(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>Select members to work on this task</Text>
              <FlatList
                data={members}
                keyExtractor={(item) => item.member_id}
                renderItem={({ item }) => {
                  const checked = selectedAssigneeIds.has(item.member_id);
                  return (
                    <TouchableOpacity style={styles.checkRow} onPress={() => toggleAssignee(item.member_id)} activeOpacity={0.7}>
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {(item.members?.full_name || item.members?.email || "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{item.members?.full_name || "Unknown"}</Text>
                        <Text style={styles.memberEmail}>{item.members?.email || ""}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
              <View style={styles.modalFooter}>
                <Button title="Cancel" onPress={() => setShowMemberSelect(false)} variant="secondary" />
                <Button title="Confirm" onPress={confirmAccept} variant="primary" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showRemarkModal} transparent animationType="fade" onRequestClose={() => setShowRemarkModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowRemarkModal(false)}>
          <View style={styles.modalContainerSmall}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{remarkActionType === "reject" ? "Reject Task" : "Complete Task"}</Text>
                <TouchableOpacity onPress={() => setShowRemarkModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                {remarkActionType === "reject" ? "Please provide a reason for rejection (required)" : "Add a completion note (optional)"}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Remark..."
                placeholderTextColor="#9CA3AF"
                value={remarkText}
                onChangeText={setRemarkText}
                multiline
                autoFocus
              />
              {remarkActionType === "reject" && !remarkText.trim() && (
                <Text style={styles.validationText}>Remark is required</Text>
              )}
              <View style={styles.modalFooter}>
                <Button title="Cancel" onPress={() => setShowRemarkModal(false)} variant="secondary" />
                <Button title="Confirm" onPress={confirmRemark} variant={remarkActionType === "reject" ? "danger" : "primary"} />
              </View>
            </View>
          </View>
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

  loading: { marginVertical: 20 },
  listContent: { paddingTop: 8 },

  acceptBtn: {
    flex: 1, backgroundColor: "#10B981", borderRadius: 8, paddingVertical: 10,
    alignItems: "center", justifyContent: "center",
  },
  acceptBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  rejectBtn: {
    flex: 1, backgroundColor: "#EF4444", borderRadius: 8, paddingVertical: 10,
    alignItems: "center", justifyContent: "center",
  },
  rejectBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  completeBtn: {
    flex: 1, backgroundColor: "#10B981", borderRadius: 8, paddingVertical: 10,
    alignItems: "center", justifyContent: "center",
  },
  completeBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalContainer: { flex: 1, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalContainerSmall: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalCard: { backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalSubtitle: { fontSize: 14, color: "#6B7280", marginBottom: 16 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 22, color: "#9CA3AF" },

  checkRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: "#D1D5DB",
    marginRight: 12, justifyContent: "center", alignItems: "center",
  },
  checkboxChecked: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "700" },

  memberRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
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
  memberActionChevron: { fontSize: 22, color: "#9CA3AF", paddingLeft: 8 },

  actionRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 14,
  },
  actionRowIcon: { fontSize: 24, marginRight: 14, width: 32, textAlign: "center" },
  actionRowIconDanger: { fontSize: 20, marginRight: 14, width: 32, textAlign: "center", color: "#EF4444", fontWeight: "700" },
  actionRowInfo: { flex: 1 },
  actionRowLabel: { fontSize: 16, fontWeight: "600", color: "#111827" },
  actionRowLabelDanger: { fontSize: 16, fontWeight: "600", color: "#EF4444" },
  actionRowDesc: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  actionDivider: { height: 1, backgroundColor: "#F3F4F6" },

  separator: { height: 1, backgroundColor: "#F3F4F6", marginLeft: 52 },

  modalFooter: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#E5E7EB", flexDirection: "row", gap: 10, justifyContent: "flex-end" },

  input: { backgroundColor: "#F3F4F6", padding: 14, borderRadius: 10, fontSize: 15, color: "#111827", marginBottom: 10 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  validationText: { fontSize: 12, color: "#EF4444", marginTop: -6, marginBottom: 10 },

  updateCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 16, marginHorizontal: 16, marginVertical: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1,
  },
  updateCardTitle: { fontSize: 15, color: "#111827", fontWeight: "600", marginBottom: 4 },
  updateCardContent: { fontSize: 14, color: "#6B7280", lineHeight: 18 },
  updateCardAuthor: { fontSize: 12, color: "#9CA3AF", marginTop: 6 },
  fabBlue: {
    position: "absolute", bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28, backgroundColor: "#2563EB",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 30 },
  emptyContainerStyle: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  detailContent: { fontSize: 15, color: "#374151", lineHeight: 22, marginBottom: 16 },
  detailMeta: { fontSize: 13, color: "#6B7280", marginTop: 4 },
});
