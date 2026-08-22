import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from "react-native";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ visible, title, message, confirmLabel = "Confirm", loading = false, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.confirmBtnText}>{confirmLabel}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 24, maxWidth: 400, alignSelf: "center", width: "100%" },
  title: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 12 },
  message: { fontSize: 15, color: "#6B7280", lineHeight: 22, marginBottom: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: "#D1D5DB" },
  cancelBtnText: { fontSize: 15, color: "#374151", fontWeight: "600" },
  confirmBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#DC2626", minWidth: 100, alignItems: "center" },
  confirmBtnText: { fontSize: 15, color: "#fff", fontWeight: "700" },
});
