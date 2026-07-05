import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
}

export default function Button({ title, onPress, variant = "primary", loading, disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { padding: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: "#2563EB" },
  secondary: { backgroundColor: "#6B7280" },
  danger: { backgroundColor: "#DC2626" },
  disabled: { opacity: 0.5 },
  text: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
