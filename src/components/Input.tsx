import { TextInput, StyleSheet } from "react-native";

interface InputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
}

export default function Input({ placeholder, value, onChangeText, secureTextEntry, autoCapitalize, keyboardType }: InputProps) {
  return (
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      value={value}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize ?? "none"}
      keyboardType={keyboardType ?? "default"}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#F3F4F6",
    padding: 16,
    borderRadius: 10,
    fontSize: 16,
    color: "#111827",
  },
});
