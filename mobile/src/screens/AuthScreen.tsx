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
import { validateInvitation, registerWithInvitation } from "../lib/api";

type Mode = "login" | "signup" | "forgot";
type SignupStep = "code" | "credentials";

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [signupStep, setSignupStep] = useState<SignupStep>("code");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function login() {
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
  }

  async function submitCode() {
    setError("");
    setLoading(true);
    const { error } = await validateInvitation(inviteCode.trim());
    setLoading(false);
    if (error) setError(error);
    else setSignupStep("credentials");
  }

  async function register() {
    setError("");
    setLoading(true);
    const { error: regError } = await registerWithInvitation({
      token: inviteCode.trim(),
      email: email.trim(),
      password,
    });
    if (regError) {
      setLoading(false);
      setError(regError);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
  }

  async function forgot() {
    setError("");
    setInfo("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) setError(error.message);
    else setInfo("Te enviamos un mail para recuperar tu contraseña.");
  }

  const title =
    mode === "login"
      ? "Ingresar"
      : mode === "signup"
      ? signupStep === "code"
        ? "Registro"
        : "Crear tu cuenta"
      : "Recuperar contraseña";

  const subtitle =
    mode === "login"
      ? "Ingresá con tu email y contraseña."
      : mode === "signup"
      ? signupStep === "code"
        ? "Ingresá el código de invitación que te dio la administración."
        : "Definí tu email y contraseña."
      : "Te enviamos un mail para recuperar tu contraseña.";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Portero Inteligente</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      {mode === "login" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor="#71717a"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#71717a"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={login} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Ingresando…" : "Ingresar"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setError("");
              setMode("signup");
              setSignupStep("code");
            }}
          >
            <Text style={styles.link}>Registrarse</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setError("");
              setMode("forgot");
            }}
          >
            <Text style={styles.linkMuted}>Olvidé mi contraseña</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === "signup" && signupStep === "code" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Código de invitación"
            placeholderTextColor="#71717a"
            autoCapitalize="characters"
            value={inviteCode}
            onChangeText={setInviteCode}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={submitCode} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Validando…" : "Continuar"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setError("");
              setMode("login");
            }}
          >
            <Text style={styles.link}>Volver al ingreso</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === "signup" && signupStep === "credentials" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor="#71717a"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña (mín. 6 caracteres)"
            placeholderTextColor="#71717a"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={register} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Registrando…" : "Registrarme"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setError("");
              setSignupStep("code");
            }}
          >
            <Text style={styles.link}>Volver al código</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === "forgot" && (
        <>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            placeholderTextColor="#71717a"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}
          <TouchableOpacity style={styles.button} onPress={forgot} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? "Enviando…" : "Enviar mail de recuperación"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setError("");
              setInfo("");
              setMode("login");
            }}
          >
            <Text style={styles.link}>Volver al ingreso</Text>
          </TouchableOpacity>
        </>
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
  info: { color: "#34d399", marginTop: 4 },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { color: "#60a5fa", textAlign: "center", marginTop: 16 },
  linkMuted: { color: "#a1a1aa", textAlign: "center", marginTop: 12 },
});
