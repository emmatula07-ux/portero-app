import { useEffect, useState } from "react";
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

  useEffect(() => {
    ensureNotificationChannels();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkResident(userId: string) {
      const { data } = await supabase
        .from("residents")
        .select("id")
        .eq("profile_id", userId)
        .eq("active", true)
        .limit(1);
      if (!cancelled) setHasResident((data?.length ?? 0) > 0);
    }
    if (session?.user) {
      setLoading(false);
      checkResident(session.user.id);
    } else {
      setLoading(false);
      setHasResident(false);
    }
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) return null;

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
