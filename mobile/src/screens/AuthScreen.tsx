import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { supabase } from "../lib/supabase";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verifyCode() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Portero Inteligente</Text>
      <Text style={styles.subtitle}>
        {step === "email" ? "Ingresá tu email para iniciar sesión" : "Ingresá el código recibido"}
      </Text>

      {step === "email" ? (
        <TextInput
          style={styles.input}
          placeholder="tu@email.com"
          placeholderTextColor="#71717a"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Código de 6 dígitos"
          placeholderTextColor="#71717a"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
        />
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.button}
        onPress={step === "email" ? sendCode : verifyCode}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Esperando…" : step === "email" ? "Enviar código" : "Verificar"}
        </Text>
      </TouchableOpacity>

      {step === "code" && (
        <TouchableOpacity onPress={() => setStep("email")}>
          <Text style={styles.link}>Cambiar email</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
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
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { color: "#60a5fa", textAlign: "center", marginTop: 16 },
});
