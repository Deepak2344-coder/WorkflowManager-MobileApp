import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { supabase } from "../lib/supabase";
import Button from "../components/Button";
import Input from "../components/Input";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async () => {
    if (loading) return;
    setLoading(true);
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert("Error", error.message);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>Gameliminals</Text>
      <Text style={styles.subtitle}>{isSignUp ? "Create Account" : "Sign In"}</Text>
      <View style={styles.form}>
        <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button title={isSignUp ? "Sign Up" : "Sign In"} onPress={handleAuth} loading={loading} />
        <Button
          title={isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          onPress={() => setIsSignUp(!isSignUp)}
          variant="secondary"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F9FAFB" },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center", color: "#111827", marginBottom: 4 },
  subtitle: { fontSize: 16, textAlign: "center", color: "#6B7280", marginBottom: 32 },
  form: { gap: 14 },
});
