import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { registerPushToken } from "../lib/notifications";
import { openAccess } from "../lib/api";

interface Resident {
  id: string;
  unit_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string | null;
}

interface Unit {
  id: string;
  display_name: string | null;
  unit_number: string | null;
  billing_status: "OK" | "WARNING" | "BLOCKED";
  debt_amount: number;
}

interface Visit {
  id: string;
  status: string;
  visitor_name: string | null;
  visitor_message: string | null;
  visitor_type: string;
  created_at: string;
  access_points: { name: string } | null;
}

interface AccessPoint {
  id: string;
  name: string;
}

const BILLING_STYLE: Record<string, { label: string; color: string }> = {
  OK: { label: "Expensas al día", color: "#16a34a" },
  WARNING: { label: "Expensas pendientes", color: "#f59e0b" },
  BLOCKED: { label: "Acceso bloqueado por deuda", color: "#ef4444" },
};

export default function HomeScreen({ session }: { session: Session }) {
  const [resident, setResident] = useState<Resident | null>(null);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [accesses, setAccesses] = useState<AccessPoint[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    const userId = session.user.id;
    const { data: residents } = await supabase
      .from("residents")
      .select("id, unit_id, first_name, last_name, display_name")
      .eq("profile_id", userId)
      .eq("active", true)
      .limit(1);

    const res = residents?.[0];
    if (!res) return;
    setResident(res);

    const { data: unitData } = await supabase
      .from("units")
      .select("id, display_name, unit_number, billing_status, debt_amount")
      .eq("id", res.unit_id)
      .single();
    if (unitData) setUnit(unitData);

    const { data: visitsData } = await supabase
      .from("visit_requests")
      .select("id, status, visitor_name, visitor_message, visitor_type, created_at, access_points(name)")
      .eq("unit_id", res.unit_id)
      .order("created_at", { ascending: false })
      .limit(20);
    setVisits((visitsData as unknown as Visit[]) ?? []);

    const { data: perms } = await supabase
      .from("access_permissions")
      .select("access_point_id, access_points(id, name)")
      .eq("unit_id", res.unit_id)
      .eq("granted", true);

    const points = (perms ?? [])
      .map((p) => p.access_points as unknown as AccessPoint)
      .filter((p): p is AccessPoint => Boolean(p?.id));
    setAccesses(points);
  }, [session.user.id]);

  useEffect(() => {
    load();
    registerPushToken(session.user.id);
  }, [load, session.user.id]);

  useEffect(() => {
    const channel = supabase
      .channel("home-visits")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_requests" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function respond(visitId: string, status: "ACCEPTED" | "REJECTED") {
    await supabase
      .from("visit_requests")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", visitId);
    load();
  }

  async function open(accessPointId?: string, visitId?: string) {
    if (unit?.billing_status === "BLOCKED") {
      Alert.alert("Acceso bloqueado", "Tenés una deuda de expensas. Contactá a la administración.");
      return;
    }
    setOpening(true);
    const { data, error } = await openAccess({ accessPointId, visitId });
    setOpening(false);
    if (error) Alert.alert("No se pudo abrir", error);
    else Alert.alert("Puerta abierta", "El acceso se abrió correctamente.");
  }

  const name = resident?.display_name || resident?.first_name || "Residente";

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([load(), registerPushToken(session.user.id)]);
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>Hola, {name}</Text>
          <Text style={styles.unitLabel}>
            {unit?.display_name || unit?.unit_number || "Unidad"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOut}>Salir</Text>
        </TouchableOpacity>
      </View>

      {unit && (
        <View style={[styles.banner, { borderColor: BILLING_STYLE[unit.billing_status].color }]}>
          <Text style={[styles.bannerText, { color: BILLING_STYLE[unit.billing_status].color }]}>
            {BILLING_STYLE[unit.billing_status].label}
          </Text>
          {unit.debt_amount > 0 && (
            <Text style={styles.bannerSub}>
              Deuda: ${Number(unit.debt_amount).toLocaleString("es-AR")}
            </Text>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Visitas</Text>
      {visits.length === 0 && <Text style={styles.empty}>No tenés visitas todavía.</Text>}
      {visits.map((v) => (
        <View key={v.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>
              {v.visitor_name || "Visitante"} {v.visitor_type === "DELIVERY" ? "📦" : ""}
            </Text>
            <Text style={[styles.status, { color: statusColor(v.status) }]}>
              {statusLabel(v.status)}
            </Text>
          </View>
          <Text style={styles.cardSub}>{v.access_points?.name ?? "Acceso"}</Text>
          {v.visitor_message ? <Text style={styles.cardMsg}>{v.visitor_message}</Text> : null}

          {v.status === "PENDING" && (
            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => respond(v.id, "REJECTED")}>
                <Text style={styles.btnText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnAccept]} onPress={() => respond(v.id, "ACCEPTED")}>
                <Text style={styles.btnText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          )}
          {v.status === "ACCEPTED" && (
            <TouchableOpacity
              style={[styles.btn, styles.btnOpen]}
              onPress={() => open(undefined, v.id)}
              disabled={opening}
            >
              <Text style={styles.btnText}>Abrir puerta</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Accesos</Text>
      {accesses.length === 0 && <Text style={styles.empty}>Sin accesos habilitados.</Text>}
      {accesses.map((a) => (
        <View key={a.id} style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle}>{a.name}</Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnOpen]}
              onPress={() => open(a.id)}
              disabled={opening}
            >
              <Text style={styles.btnText}>Abrir</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function statusLabel(s: string): string {
  return (
    { PENDING: "Pendiente", ACCEPTED: "Aceptada", REJECTED: "Rechazada", EXPIRED: "Expirada", CANCELLED: "Cancelada" }[s] ??
    s
  );
}

function statusColor(s: string): string {
  return (
    { PENDING: "#f59e0b", ACCEPTED: "#16a34a", REJECTED: "#ef4444", EXPIRED: "#71717a", CANCELLED: "#71717a" }[s] ??
    "#71717a"
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090b", padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 16 },
  hello: { color: "#fff", fontSize: 24, fontWeight: "700" },
  unitLabel: { color: "#a1a1aa", marginTop: 2 },
  signOut: { color: "#60a5fa" },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 16, backgroundColor: "#18181b" },
  bannerText: { fontWeight: "700", fontSize: 15 },
  bannerSub: { color: "#a1a1aa", marginTop: 2 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  empty: { color: "#52525b" },
  card: { backgroundColor: "#18181b", borderRadius: 12, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: "#fff", fontWeight: "600", fontSize: 16 },
  cardSub: { color: "#a1a1aa", marginTop: 2 },
  cardMsg: { color: "#d4d4d8", marginTop: 6 },
  status: { fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  btnAccept: { backgroundColor: "#16a34a", flex: 1 },
  btnReject: { backgroundColor: "#dc2626", flex: 1 },
  btnOpen: { backgroundColor: "#2563eb" },
  btnText: { color: "#fff", fontWeight: "600" },
});
