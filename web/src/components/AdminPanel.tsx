"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase-client";

type Tab =
  | "overview"
  | "properties"
  | "units"
  | "residents"
  | "access"
  | "permissions"
  | "controllers"
  | "invitations"
  | "admins"
  | "visits"
  | "audit";

const BILLING_COLOR: Record<string, string> = {
  OK: "bg-emerald-600",
  WARNING: "bg-amber-500",
  BLOCKED: "bg-red-600",
};

async function api(path: string, options?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Error");
  return json;
}

export default function AdminPanel() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [role, setRole] = useState("");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [overview, setOverview] = useState<any>({});
  const [units, setUnits] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [accessPoints, setAccessPoints] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [controllers, setControllers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const loadMe = useCallback(async () => {
    const m = await api("/me");
    setRole(m.role);
    setProperties(m.properties ?? []);
    if (m.properties?.length) setPropertyId((p) => p || m.properties[0].id);
    return m;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        try {
          await loadMe();
          setAuthed(true);
        } catch {
          setAuthed(false);
        }
      }
      setLoading(false);
    });
  }, [loadMe]);

  async function login() {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(error.message);
      return;
    }
    await loadMe();
    setAuthed(true);
    setEmail("");
    setPassword("");
  }

  async function logout() {
    await supabase.auth.signOut();
    setAuthed(false);
    setRole("");
    setProperties([]);
    setPropertyId("");
  }

  useEffect(() => {
    if (!authed) return;
    const load = async () => {
      try {
        const q = propertyId ? `?propertyId=${propertyId}` : "";
        const [ov, u, r, a, p, c, i, v, au, adm] = await Promise.all([
          api("/overview"),
          api(`/units${q}`),
          api(`/residents${q}`),
          api(`/access-points${q}`),
          api("/permissions"),
          api(`/access-controllers${q}`),
          api("/invitations"),
          api("/visits?limit=100"),
          role === "DEVELOPER" ? api("/audit?limit=100") : Promise.resolve([]),
          role === "DEVELOPER" ? api("/admins") : Promise.resolve([]),
        ]);
        setOverview(ov);
        setUnits(u);
        setResidents(r);
        setAccessPoints(a);
        setPermissions(p);
        setControllers(c);
        setInvitations(i);
        setVisits(v);
        setAudit(au);
        setAdmins(adm);
      } catch (e: any) {
        if (e.message === "UNAUTHORIZED") {
          setAuthed(false);
        } else {
          setError(e.message);
        }
      }
    };
    load();
  }, [authed, propertyId, tab, role]);

  const refresh = async () => {
    try {
      await loadMe();
      setPropertyId("");
    } catch {}
  };

  if (loading) return <div className="p-8 text-zinc-400">Cargando…</div>;

  if (!authed) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-center">Panel de administración</h1>
          <p className="text-zinc-400 text-center text-sm">Ingresá con tu email y contraseña.</p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoCapitalize="none"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Contraseña"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={login} className="w-full py-3 rounded-xl bg-blue-600 font-semibold hover:bg-blue-500">
            Ingresar
          </button>
        </div>
      </main>
    );
  }

  const isDev = role === "DEVELOPER";

  const allTabs: { id: Tab; label: string; dev?: boolean }[] = [
    { id: "overview", label: "Resumen" },
    { id: "properties", label: "Edificios", dev: true },
    { id: "units", label: "Unidades" },
    { id: "residents", label: "Residentes" },
    { id: "access", label: "Accesos" },
    { id: "permissions", label: "Permisos" },
    { id: "controllers", label: "Controladores" },
    { id: "invitations", label: "Invitaciones" },
    { id: "admins", label: "Administradores", dev: true },
    { id: "visits", label: "Visitas" },
    { id: "audit", label: "Auditoría", dev: true },
  ];
  const tabs = allTabs.filter((t) => !t.dev || isDev);

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel de administración</h1>
            <p className="text-sm text-zinc-400">
              Rol: <span className="text-blue-400">{role}</span>
            </p>
            {properties.length > 0 && (
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="mt-2 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button onClick={logout} className="text-sm text-zinc-400 hover:text-white">
            Salir
          </button>
        </header>

        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm ${
                tab === t.id ? "bg-blue-600" : "bg-zinc-900 border border-zinc-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {toast && (
          <div className="rounded-lg bg-emerald-600/20 border border-emerald-600/40 text-emerald-300 px-4 py-3 whitespace-pre-wrap">
            {toast}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-600/20 border border-red-600/40 text-red-300 px-4 py-3">
            {error}
          </div>
        )}

        {tab === "overview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Stat label="Edificios" value={overview.properties} />
              <Stat label="Unidades" value={overview.units} />
              <Stat label="Residentes" value={overview.residents} />
              <Stat label="Accesos" value={overview.accessPoints} />
              <Stat label="Visitas totales" value={overview.visits} />
              <Stat label="Visitas pendientes" value={overview.pendingVisits} />
            </div>
            <Section title="Últimas visitas">
              <Table
                head={["Estado", "Visitante", "Tipo", "Unidad", "Fecha"]}
                rows={(overview.recentVisits ?? []).map((v: any) => [
                  v.status,
                  v.visitor_name ?? "-",
                  v.visitor_type,
                  v.units?.display_name ?? v.units?.unit_number ?? "-",
                  new Date(v.created_at).toLocaleString("es-AR"),
                ])}
              />
            </Section>
            {isDev && (
              <Section title="Última actividad">
                <Table
                  head={["Acción", "Entidad", "Fecha"]}
                  rows={(overview.recentAudit ?? []).map((a: any) => [
                    a.action,
                    a.entity_type,
                    new Date(a.created_at).toLocaleString("es-AR"),
                  ])}
                />
              </Section>
            )}
          </div>
        )}

        {tab === "properties" && isDev && <PropertiesTab onChanged={refresh} />}
        {tab === "units" && (
          <UnitsTab propertyId={propertyId} units={units} onChanged={() => notify("Unidad actualizada")} />
        )}
        {tab === "residents" && (
          <ResidentsTab units={units} residents={residents} onChanged={() => notify("Residente actualizado")} />
        )}
        {tab === "access" && (
          <AccessTab propertyId={propertyId} accessPoints={accessPoints} controllers={controllers} onChanged={() => notify("Acceso actualizado")} />
        )}
        {tab === "permissions" && (
          <PermissionsTab units={units} accessPoints={accessPoints} permissions={permissions} onChanged={() => notify("Permiso actualizado")} />
        )}
        {tab === "controllers" && (
          <ControllersTab propertyId={propertyId} controllers={controllers} onChanged={() => notify("Controlador actualizado")} />
        )}
        {tab === "invitations" && (
          <InvitationsTab units={units} residents={residents} invitations={invitations} onChanged={() => notify("Invitación generada")} />
        )}
        {tab === "admins" && isDev && <AdminsTab admins={admins} properties={properties} onChanged={notify} />}
        {tab === "visits" && (
          <Section title="Visitas">
            <Table
              head={["Estado", "Visitante", "Mensaje", "Acceso", "Residente", "Fecha"]}
              rows={visits.map((v: any) => [
                v.status,
                v.visitor_name ?? "-",
                v.visitor_message ?? "-",
                v.access_points?.name ?? "-",
                v.residents?.display_name ?? v.units?.display_name ?? "-",
                new Date(v.created_at).toLocaleString("es-AR"),
              ])}
            />
          </Section>
        )}
        {tab === "audit" && isDev && (
          <Section title="Auditoría">
            <Table
              head={["Acción", "Actor", "Entidad", "Fecha"]}
              rows={audit.map((a: any) => [
                a.action,
                a.actor_type ?? "-",
                a.entity_type ?? "-",
                new Date(a.created_at).toLocaleString("es-AR"),
              ])}
            />
          </Section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
      <p className="text-3xl font-bold">{value ?? 0}</p>
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-900 text-left">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-zinc-400 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-zinc-800">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PropertiesTab({ onChanged }: { onChanged: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", type: "BUILDING", address: "" });

  useEffect(() => {
    api("/properties").then(setList).catch(() => {});
  }, []);

  async function create() {
    await api("/properties", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", type: "BUILDING", address: "" });
    api("/properties").then(setList);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Nombre del edificio/barrio" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="BUILDING">Edificio</option>
          <option value="CONDOMINIUM">Condominio</option>
          <option value="GATED_COMMUNITY">Barrio privado</option>
          <option value="HOUSE">Casa</option>
          <option value="OFFICE">Oficina</option>
          <option value="OTHER">Otro</option>
        </select>
        <input className={inputCls} placeholder="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <button className={btnCls} onClick={create}>Agregar</button>
      </div>
      <Table
        head={["Nombre", "Tipo", "Dirección", "Activo"]}
        rows={list.map((p) => [p.name, p.type, p.address ?? "-", p.active ? "Sí" : "No"])}
      />
    </div>
  );
}

function AdminsTab({ admins, properties, onChanged }: { admins: any[]; properties: { id: string; name: string }[]; onChanged: (m: string) => void }) {
  const [email, setEmail] = useState("");
  const [propertyId, setPropertyId] = useState("");

  async function add() {
    const res = await api("/admins", { method: "POST", body: JSON.stringify({ email, propertyId }) });
    setEmail("");
    setPropertyId("");
    if (res.generatedPassword) {
      onChanged(`Administrador creado.\nEmail: ${email}\nContraseña temporal: ${res.generatedPassword}\n(compártela con el administrador)`);
    } else {
      onChanged("Administrador asignado (ya tenía cuenta).");
    }
  }

  async function remove(id: string) {
    await api(`/admins/${id}`, { method: "DELETE" });
    onChanged("Administrador removido.");
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Email del administrador" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className={inputCls} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">Edificio…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className={btnCls} onClick={add}>Asignar</button>
      </div>
      <Table
        head={["Email", "Edificio", ""]}
        rows={admins.map((a) => [
          a.profiles?.email ?? "-",
          a.properties?.name ?? "-",
          <button key={a.id} className="text-red-400" onClick={() => remove(a.id)}>Quitar</button>,
        ])}
      />
    </div>
  );
}

function UnitsTab({ propertyId, units, onChanged }: { propertyId: string; units: any[]; onChanged: () => void }) {
  const [form, setForm] = useState({ unit_number: "", display_name: "", building: "", floor: "" });

  async function create() {
    await api("/units", { method: "POST", body: JSON.stringify({ property_id: propertyId, ...form }) });
    setForm({ unit_number: "", display_name: "", building: "", floor: "" });
    onChanged();
  }

  async function setBilling(id: string, status: string) {
    const amount = Number((document.getElementById(`debt-${id}`) as HTMLInputElement)?.value ?? 0);
    await api(`/units/${id}/billing`, { method: "POST", body: JSON.stringify({ billingStatus: status, debtAmount: amount }) });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Nº unidad (ej 4B)" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} />
        <input className={inputCls} placeholder="Piso" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
        <input className={inputCls} placeholder="Torre/edificio" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
        <button className={btnCls} onClick={create}>Agregar</button>
      </div>
      <div className="space-y-2">
        {units.map((u) => (
          <div key={u.id} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{u.display_name || u.unit_number}</p>
                <p className="text-sm text-zinc-400">
                  {u.building ? `${u.building} · ` : ""}Piso {u.floor ?? "-"} · {u.unit_number}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${BILLING_COLOR[u.billing_status] ?? "bg-zinc-700"}`}>
                {u.billing_status}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input type="number" defaultValue={u.debt_amount} id={`debt-${u.id}`} placeholder="Deuda" className={inputCls + " max-w-[140px]"} />
              <button className={btnCls + " bg-emerald-600"} onClick={() => setBilling(u.id, "OK")}>OK</button>
              <button className={btnCls + " bg-amber-500"} onClick={() => setBilling(u.id, "WARNING")}>WARNING</button>
              <button className={btnCls + " bg-red-600"} onClick={() => setBilling(u.id, "BLOCKED")}>BLOCKED</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResidentsTab({ units, residents, onChanged }: { units: any[]; residents: any[]; onChanged: () => void }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", unit_id: "" });

  async function create() {
    await api("/residents", { method: "POST", body: JSON.stringify(form) });
    setForm({ first_name: "", last_name: "", unit_id: "" });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Nombre" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        <input className={inputCls} placeholder="Apellido" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        <select className={inputCls} value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}>
          <option value="">Unidad…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.display_name || u.unit_number}</option>
          ))}
        </select>
        <button className={btnCls} onClick={create}>Agregar</button>
      </div>
      <Table
        head={["Nombre", "Unidad", "Rol", "Activo"]}
        rows={residents.map((r) => [r.display_name ?? `${r.first_name} ${r.last_name ?? ""}`, r.units?.display_name ?? "-", r.role, r.active ? "Sí" : "No"])}
      />
    </div>
  );
}

function AccessTab({ propertyId, accessPoints, controllers, onChanged }: { propertyId: string; accessPoints: any[]; controllers: any[]; onChanged: () => void }) {
  const [form, setForm] = useState({ name: "", type: "MAIN_ENTRANCE", access_controller_id: "" });

  async function create() {
    await api("/access-points", { method: "POST", body: JSON.stringify({ property_id: propertyId, ...form }) });
    setForm({ name: "", type: "MAIN_ENTRANCE", access_controller_id: "" });
    onChanged();
  }

  async function rotate(id: string) {
    await api(`/access-points/${id}/rotate`, { method: "POST" });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Nombre (ej Entrada principal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="MAIN_ENTRANCE">Entrada principal</option>
          <option value="PEDESTRIAN_DOOR">Puerta peatonal</option>
          <option value="VEHICLE_GATE">Barrera vehicular</option>
          <option value="ELEVATOR_ACCESS">Ascensor</option>
          <option value="OTHER">Otro</option>
        </select>
        <select className={inputCls} value={form.access_controller_id} onChange={(e) => setForm({ ...form, access_controller_id: e.target.value })}>
          <option value="">Controlador…</option>
          {controllers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
          ))}
        </select>
        <button className={btnCls} onClick={create}>Agregar</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accessPoints.map((a) => {
          const url = `${window.location.origin}/access/${a.qr_token}`;
          return (
            <div key={a.id} className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{a.name}</p>
                <span className={`text-xs ${a.active ? "text-emerald-400" : "text-red-400"}`}>
                  {a.active ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-lg">
                  <QRCodeSVG value={url} size={96} />
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-xs text-zinc-400 break-all">{url}</p>
                  <button className={btnCls + " bg-zinc-700"} onClick={() => rotate(a.id)}>Rotar QR</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PermissionsTab({ units, accessPoints, permissions, onChanged }: { units: any[]; accessPoints: any[]; permissions: any[]; onChanged: () => void }) {
  const [unitId, setUnitId] = useState("");
  const [accessPointId, setAccessPointId] = useState("");

  async function grant() {
    await api("/permissions", { method: "POST", body: JSON.stringify({ unit_id: unitId, access_point_id: accessPointId, granted: true }) });
    setUnitId("");
    setAccessPointId("");
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select className={inputCls} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Unidad…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.display_name || u.unit_number}</option>
          ))}
        </select>
        <select className={inputCls} value={accessPointId} onChange={(e) => setAccessPointId(e.target.value)}>
          <option value="">Acceso…</option>
          {accessPoints.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button className={btnCls} onClick={grant}>Conceder</button>
      </div>
      <Table
        head={["Unidad", "Acceso", "Concedido"]}
        rows={permissions.map((p) => [p.units?.display_name ?? "-", p.access_points?.name ?? "-", p.granted ? "Sí" : "No"])}
      />
    </div>
  );
}

function ControllersTab({ propertyId, controllers, onChanged }: { propertyId: string; controllers: any[]; onChanged: () => void }) {
  const [form, setForm] = useState({ name: "", type: "MOCK", url: "", secret: "" });

  async function create() {
    const config = form.type === "MOCK" ? null : { url: form.url, secret: form.secret || null };
    await api("/access-controllers", { method: "POST", body: JSON.stringify({ property_id: propertyId, name: form.name, type: form.type, config }) });
    setForm({ name: "", type: "MOCK", url: "", secret: "" });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="MOCK">MOCK (simulado)</option>
          <option value="LOCAL_GATEWAY">Gateway local (HTTP)</option>
          <option value="HTTP">HTTP API</option>
        </select>
        {form.type !== "MOCK" && (
          <>
            <input className={inputCls} placeholder="URL del gateway" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <input className={inputCls} placeholder="Secreto (opcional)" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} />
          </>
        )}
        <button className={btnCls} onClick={create}>Agregar</button>
      </div>
      <Table
        head={["Nombre", "Tipo", "Estado"]}
        rows={controllers.map((c) => [c.name, c.type, c.status])}
      />
    </div>
  );
}

function InvitationsTab({ units, residents, invitations, onChanged }: { units: any[]; residents: any[]; invitations: any[]; onChanged: () => void }) {
  const [unitId, setUnitId] = useState("");
  const [residentId, setResidentId] = useState("");

  async function generate() {
    await api("/invitations", { method: "POST", body: JSON.stringify({ unit_id: unitId, resident_id: residentId || null }) });
    setUnitId("");
    setResidentId("");
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select className={inputCls} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
          <option value="">Unidad…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>{u.display_name || u.unit_number}</option>
          ))}
        </select>
        <select className={inputCls} value={residentId} onChange={(e) => setResidentId(e.target.value)}>
          <option value="">Residente (opcional)…</option>
          {residents.map((r) => (
            <option key={r.id} value={r.id}>{r.display_name}</option>
          ))}
        </select>
        <button className={btnCls} onClick={generate}>Generar invitación</button>
      </div>
      <Table
        head={["Código", "Unidad", "Residente", "Estado"]}
        rows={invitations.map((i) => [
          <code key={i.id} className="bg-zinc-800 px-2 py-1 rounded">{i.token}</code>,
          i.units?.display_name ?? "-",
          i.residents?.display_name ?? "-",
          i.status,
        ])}
      />
    </div>
  );
}

const inputCls = "rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const btnCls = "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500";
