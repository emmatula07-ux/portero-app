import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { claimInvitation } from "../lib/api";
import { supabase } from "../lib/supabase";

export default function ClaimScreen({ onClaimed }: { onClaimed: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function claim() {
    setError("");
    setLoading(true);
    const { error } = await claimInvitation(code.trim());
    setLoading(false);
    if (error) setError(error);
    else onClaimed();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Asociá tu unidad</Text>
      <Text style={styles.subtitle}>
        Ingresá el código de invitación que te dio la administración.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Código de invitación"
        placeholderTextColor="#71717a"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={claim} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Asociando…" : "Asociar"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => supabase.auth.signOut()}>
        <Text style={styles.link}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", justifyContent: "center", padding: 24 },
  title: { color: "#fff", fontSize: 26, fontWeight: "700", textAlign: "center" },
  subtitle: { color: "#a1a1aa", textAlign: "center", marginTop: 8, marginBottom: 24 },
  input: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    fontSize: 16,
  },
  error: { color: "#f87171", marginTop: 12 },
  button: { backgroundColor: "#2563eb", borderRadius: 12, padding: 16, marginTop: 16, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { color: "#60a5fa", textAlign: "center", marginTop: 16 },
});
