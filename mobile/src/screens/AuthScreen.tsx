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

type Mode = "password" | "otp";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loginWithPassword() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
  }

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
        {mode === "password"
          ? "Ingresá con tu email y contraseña"
          : step === "email"
          ? "Ingresá tu email para recibir un código"
          : "Ingresá el código recibido"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="tu@email.com"
        placeholderTextColor="#71717a"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      {mode === "password" ? (
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#71717a"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      ) : step === "code" ? (
        <TextInput
          style={styles.input}
          placeholder="Código de 6 dígitos"
          placeholderTextColor="#71717a"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={styles.button}
        onPress={
          mode === "password"
            ? loginWithPassword
            : step === "email"
            ? sendCode
            : verifyCode
        }
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? "Esperando…"
            : mode === "password"
            ? "Ingresar"
            : step === "email"
            ? "Enviar código"
            : "Verificar"}
        </Text>
      </TouchableOpacity>

      {mode === "password" ? (
        <TouchableOpacity onPress={() => setMode("otp")}>
          <Text style={styles.link}>Ingresar con código</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => {
            setMode("password");
            setStep("email");
            setCode("");
          }}
        >
          <Text style={styles.link}>Volver a contraseña</Text>
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
    marginBottom: 12,
  },
  error: { color: "#f87171", marginTop: 4 },
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
