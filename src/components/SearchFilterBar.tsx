import { useState } from "react";
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

interface Props {
  searchPlaceholder?: string;
  onSearchChange: (text: string) => void;
  filterDate: Date | null;
  onDateChange: (date: Date | null) => void;
}

export default function SearchFilterBar({ searchPlaceholder = "Search...", onSearchChange, filterDate, onDateChange }: Props) {
  const [showPicker, setShowPicker] = useState(false);

  const handlePickerChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (selected) onDateChange(selected);
  };

  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        placeholder={searchPlaceholder}
        placeholderTextColor="#9CA3AF"
        onChangeText={onSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
        <Text style={styles.dateBtnText}>{filterDate ? filterDate.toLocaleDateString() : "Date"}</Text>
      </TouchableOpacity>
      {filterDate && (
        <TouchableOpacity style={styles.clearBtn} onPress={() => onDateChange(null)}>
          <Text style={styles.clearBtnText}>✕</Text>
        </TouchableOpacity>
      )}
      {showPicker && (
        <DateTimePicker
          value={filterDate || new Date()}
          mode="date"
          display="default"
          onChange={handlePickerChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: "#111827", backgroundColor: "#fff",
  },
  dateBtn: {
    borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "#fff",
  },
  dateBtnText: { fontSize: 14, color: "#374151" },
  clearBtn: { padding: 6 },
  clearBtnText: { fontSize: 16, color: "#DC2626", fontWeight: "700" },
});
