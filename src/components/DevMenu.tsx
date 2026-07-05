import { useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert, ActivityIndicator } from "react-native";
import { clearAllTasks } from "../lib/supabase";

export default function DevMenu() {
  const [devVisible, setDevVisible] = useState(false);
  const [clearing, setClearing] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTripleTap = () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      setDevVisible(true);
    } else {
      tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 600);
    }
  };

  const handleClearAll = () => {
    Alert.alert("Clear All Tasks", "This will permanently delete ALL tasks across the app.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All", style: "destructive",
        onPress: async () => {
          setClearing(true);
          const { error } = await clearAllTasks();
          setClearing(false);
          setDevVisible(false);
          if (error) return Alert.alert("Error", error);
          Alert.alert("Done", "All tasks have been cleared.");
        },
      },
    ]);
  };

  return (
    <>
      <TouchableOpacity onPress={handleTripleTap} activeOpacity={1}>
        <Text style={styles.title}>Dashboard</Text>
      </TouchableOpacity>

      <Modal visible={devVisible} transparent animationType="fade" onRequestClose={() => setDevVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDevVisible(false)}>
          <View style={styles.menu} onStartShouldSetResponder={() => true}>
            <Text style={styles.menuTitle}>Dev Menu</Text>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleClearAll} disabled={clearing}>
              {clearing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.dangerBtnText}>Clear All</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>Clears all tasks from every tab</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setDevVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  menu: { backgroundColor: "#fff", borderRadius: 16, padding: 24, minWidth: 260, alignItems: "center" },
  menuTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 16 },
  dangerBtn: { backgroundColor: "#DC2626", paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, width: "100%", alignItems: "center" },
  dangerBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 12, color: "#9CA3AF", marginTop: 6, marginBottom: 16 },
  closeBtn: { paddingVertical: 8 },
  closeText: { fontSize: 15, color: "#6B7280", fontWeight: "500" },
});
