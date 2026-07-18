import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  message: string;
  type?: "error" | "success";
  duration?: number;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, type = "error", duration = 4000, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const bgColor = type === "success" ? "#D1FAE5" : "#FEE2E2";
  const textColor = type === "success" ? "#065F46" : "#991B1B";

  useEffect(() => {
    if (onDismiss && duration > 0) {
      timerRef.current = setTimeout(onDismiss, duration);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.banner, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={() => { if (timerRef.current) clearTimeout(timerRef.current); onDismiss(); }} style={styles.dismiss}>
          <Text style={[styles.dismissText, { color: textColor }]}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  text: { flex: 1, fontSize: 14, fontWeight: "500" },
  dismiss: { marginLeft: 8, padding: 4 },
  dismissText: { fontSize: 16, fontWeight: "700" },
});
