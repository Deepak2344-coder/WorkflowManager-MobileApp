import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface Props {
  message: string;
  type?: "error" | "success";
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, type = "error", onDismiss }: Props) {
  const bgColor = type === "success" ? "#D1FAE5" : "#FEE2E2";
  const textColor = type === "success" ? "#065F46" : "#991B1B";
  return (
    <View style={[styles.banner, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.dismiss}>
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
