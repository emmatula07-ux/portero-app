import { useCallback, useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { ensureNotificationChannels } from "./src/lib/notifications";
import AuthScreen from "./src/screens/AuthScreen";
import ClaimScreen from "./src/screens/ClaimScreen";
import HomeScreen from "./src/screens/HomeScreen";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasResident, setHasResident] = useState(false);

  const applySession = useCallback(async (s: Session | null) => {
    setSession(s);
    if (s?.user) {
      const { data } = await supabase
        .from("residents")
        .select("id")
        .eq("profile_id", s.user.id)
        .eq("active", true)
        .limit(1);
      setHasResident((data?.length ?? 0) > 0);
    } else {
      setHasResident(false);
    }
  }, []);

  useEffect(() => {
    ensureNotificationChannels();

    let restored = false;

    supabase.auth.getSession().then(async ({ data }) => {
      await applySession(data.session);
      restored = true;
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!restored) return;
      applySession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, [applySession]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      {!session ? (
        <AuthScreen />
      ) : !hasResident ? (
        <ClaimScreen onClaimed={() => setHasResident(true)} />
      ) : (
        <HomeScreen session={session} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: "#09090b",
    justifyContent: "center",
    alignItems: "center",
  },
});
