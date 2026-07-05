import { useState } from "react";
import { View, Text, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { supabase } from "../lib/supabase";
import Button from "../components/Button";

interface Props {
  onComplete: () => void;
}

export default function UsernamePrompt({ onComplete }: Props) {
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = username.trim();
    if (!trimmed) { Alert.alert("Required", "Please enter a username."); return; }
    setSaving(true);
    const { error } = await supabase.from("members").update({ full_name: trimmed }).eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    onComplete();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>Choose a username to get started.</Text>
      <TextInput
        style={styles.input}
        placeholder="Username"
        placeholderTextColor="#9CA3AF"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Button title="Continue" onPress={handleSave} loading={saving} disabled={saving} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F9FAFB" },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 15, textAlign: "center", color: "#6B7280", marginBottom: 24 },
  input: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 10, padding: 14, fontSize: 16,
    color: "#111827", backgroundColor: "#fff", marginBottom: 16,
  },
});
