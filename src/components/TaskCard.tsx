import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from "react-native";

interface TaskCardProps {
  title: string;
  description: string | null;
  status: string;
  teamName: string;
  remarks?: string | null;
  deadline?: string | null;
  claimedByName?: string | null;
  createdByName?: string | null;
  startedByName?: string | null;
  completedAt?: string | null;
  assigneeNames?: string[];
  acceptedAt?: string | null;
  acceptedByName?: string | null;
  rejectedBy?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: string | null;
  createdAt?: string | null;
  onOpen?: () => void;
  onReassign?: () => void;
  actionButtons?: React.ReactNode;
}

const statusColors: Record<string, string> = {
  pending: "#F59E0B",
  in_progress: "#3B82F6",
  done: "#10B981",
  rejected: "#EF4444",
};

const statusLabels: Record<string, string> = {
  pending: "Waiting for acceptance",
  in_progress: "In Progress",
  done: "Done",
  rejected: "Rejected",
};

export default function TaskCard({ title, description, status, teamName, remarks, deadline, claimedByName, createdByName, startedByName, completedAt, assigneeNames, acceptedAt, acceptedByName, rejectedBy, rejectedByName, rejectedAt, createdAt, onOpen, onReassign, actionButtons }: TaskCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  const openDetail = () => {
    onOpen?.();
    setShowDetail(true);
  };

  return (
    <>
      <TouchableOpacity style={styles.card} onPress={openDetail} activeOpacity={0.7}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={[styles.badge, { backgroundColor: statusColors[status] || "#6B7280" }]}>
            <Text style={styles.badgeText}>{statusLabels[status] || status.replace("_", " ")}</Text>
          </View>
        </View>
        <Text style={styles.teamName} numberOfLines={1}>{teamName}</Text>
        {createdByName && <Text style={styles.createdBy}>Assigned by {createdByName}</Text>}
        {deadline && (
          <Text style={styles.deadline}>Due {new Date(deadline).toLocaleDateString()} {new Date(deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
        )}
      </TouchableOpacity>

      {actionButtons && (
        <View style={styles.actionsRow}>
          {actionButtons}
        </View>
      )}

      <Modal visible={showDetail} transparent animationType="fade" onRequestClose={() => setShowDetail(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowDetail(false)}>
          <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailCenter}>
            <View style={styles.detailModal} onStartShouldSetResponder={() => true}>
              <Text style={styles.detailTitle}>{title}</Text>
              <View style={[styles.detailBadge, { backgroundColor: statusColors[status] || "#6B7280" }]}>
                <Text style={styles.detailBadgeText}>{statusLabels[status] || status.replace("_", " ")}</Text>
              </View>
              <Text style={styles.detailTeam}>{teamName}</Text>
              {createdByName && <Text style={styles.detailCreatedBy}>Assigned by {createdByName}</Text>}
              {createdAt && (
                <Text style={styles.detailDate}>Assigned {new Date(createdAt).toLocaleDateString()} {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              )}
              {deadline && (
                <Text style={styles.detailDeadline}>Deadline: {new Date(deadline).toLocaleDateString()} {new Date(deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
              )}
              {completedAt ? <Text style={styles.detailCompleted}>Completed {new Date(completedAt).toLocaleDateString()} {new Date(completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text> : null}
              {assigneeNames && assigneeNames.length > 0 ? <Text style={styles.detailAssignees}>Assigned to: {assigneeNames.join(", ")}</Text> : null}
              {claimedByName ? <Text style={styles.detailClaimed}>Claimed by {claimedByName}</Text> : null}
              {acceptedAt ? <Text style={styles.detailDate}>Accepted {new Date(acceptedAt).toLocaleDateString()} {new Date(acceptedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text> : null}
              {acceptedByName ? <Text style={styles.detailClaimed}>Accepted by {acceptedByName}</Text> : null}
              {startedByName && status !== "done" ? <Text style={styles.detailWorking}>Working on it: {startedByName}</Text> : null}
              {startedByName && status === "done" ? <Text style={styles.detailWorked}>Worked on by {startedByName}</Text> : null}
              {rejectedByName ? <Text style={styles.detailRejected}>Rejected by {rejectedByName}</Text> : null}
              {rejectedAt ? <Text style={styles.detailDate}>Rejected {new Date(rejectedAt).toLocaleDateString()} {new Date(rejectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text> : null}
              {description ? <Text style={styles.detailSectionLabel}>Description</Text> : null}
              {description ? <Text style={styles.detailText}>{description}</Text> : null}
              {remarks ? <Text style={styles.detailSectionLabel}>Remarks</Text> : null}
              {remarks ? <Text style={styles.detailText}>{remarks}</Text> : null}
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowDetail(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
              {status === "rejected" && onReassign && (
                <TouchableOpacity style={styles.reassignBtn} onPress={() => { setShowDetail(false); onReassign(); }}>
                  <Text style={styles.reassignBtnText}>Re-assign</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  title: { fontSize: 16, fontWeight: "600", color: "#111827", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  teamName: { fontSize: 13, color: "#6B7280", marginBottom: 2 },
  createdBy: { fontSize: 12, color: "#6B7280", marginBottom: 2 },
  deadline: { fontSize: 12, color: "#9CA3AF", textAlign: "right", marginTop: 2 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center" },
  detailScroll: { flex: 1 },
  detailCenter: { justifyContent: "center", padding: 24, flexGrow: 1 },
  detailModal: {
    backgroundColor: "#fff", borderRadius: 16, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 8,
  },
  detailTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
  detailBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  detailBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  detailTeam: { fontSize: 14, color: "#6B7280", marginBottom: 4 },
  detailCompleted: { fontSize: 13, color: "#10B981", marginBottom: 4, fontWeight: "600" },
  detailAssignees: { fontSize: 13, color: "#374151", marginBottom: 4, fontWeight: "500" },
  detailClaimed: { fontSize: 13, color: "#8B5CF6", marginBottom: 4, fontWeight: "500" },
  detailWorking: { fontSize: 13, color: "#F59E0B", marginBottom: 8, fontWeight: "500" },
  detailWorked: { fontSize: 13, color: "#10B981", marginBottom: 8, fontWeight: "500" },
  detailDeadline: { fontSize: 13, color: "#DC2626", marginBottom: 12, fontStyle: "italic" },
  detailCreatedBy: { fontSize: 13, color: "#6B7280", marginBottom: 6, fontStyle: "italic" },
  detailDate: { fontSize: 13, color: "#6B7280", marginBottom: 4, fontWeight: "500" },
  detailRejected: { fontSize: 13, color: "#EF4444", marginBottom: 4, fontWeight: "500" },
  detailSectionLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginTop: 12, marginBottom: 4 },
  detailText: { fontSize: 15, color: "#4B5563", lineHeight: 22 },
  closeBtn: { marginTop: 20, alignItems: "center", paddingVertical: 10 },
  closeBtnText: { fontSize: 16, color: "#2563EB", fontWeight: "600" },
  reassignBtn: { marginTop: 8, alignItems: "center", paddingVertical: 12, backgroundColor: "#F59E0B", borderRadius: 10 },
  reassignBtnText: { fontSize: 16, color: "#fff", fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 0, paddingHorizontal: 16, paddingBottom: 10 },
});
