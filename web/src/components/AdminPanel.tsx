"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Tab =
  | "overview"
  | "units"
  | "residents"
  | "access"
  | "permissions"
  | "controllers"
  | "invitations"
  | "visits"
  | "audit";

const BILLING_COLOR: Record<string, string> = {
  OK: "bg-emerald-600",
  WARNING: "bg-amber-500",
  BLOCKED: "bg-red-600",
};

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Error");
  return data;
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [secret, setSecret] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [properties, setProperties] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");

  const [overview, setOverview] = useState<any>({});
  const [units, setUnits] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [accessPoints, setAccessPoints] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [controllers, setControllers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [ov, props] = await Promise.all([
        api("/overview"),
        api("/properties"),
      ]);
      setOverview(ov);
      setProperties(props);
      if (!propertyId && props.length) setPropertyId(props[0].id);
    } catch (e: any) {
      if (e.message === "UNAUTHORIZED") setAuthed(false);
      else setError(e.message);
    }
  }, [propertyId]);

  useEffect(() => {
    if (authed === null) {
      api("/overview")
        .then(() => setAuthed(true))
        .catch(() => setAuthed(false));
    }
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    refresh();
  }, [authed, refresh]);

  useEffect(() => {
    if (!authed || !propertyId) return;
    const load = async () => {
      setLoading(true);
      try {
        const q = `?propertyId=${propertyId}`;
        const [u, r, a, p, c, i, v, au] = await Promise.all([
          api(`/units${q}`),
          api(`/residents${q}`),
          api(`/access-points${q}`),
          api("/permissions"),
          api(`/access-controllers${q}`),
          api("/invitations"),
          api("/visits?limit=100"),
          api("/audit?limit=100"),
        ]);
        setUnits(u);
        setResidents(r);
        setAccessPoints(a);
        setPermissions(p);
        setControllers(c);
        setInvitations(i);
        setVisits(v);
        setAudit(au);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [authed, propertyId, tab]);

  async function login() {
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    if (res.ok) {
      setAuthed(true);
      setSecret("");
    } else {
      setError("Clave incorrecta");
    }
  }

  if (authed === null) return <div className="p-8 text-zinc-400">Cargando…</div>;

  if (authed === false) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold text-center">Panel de administración</h1>
          <p className="text-zinc-400 text-center text-sm">
            Ingresá la clave de administración (ADMIN_SECRET).
          </p>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="Clave"
            className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={login}
            className="w-full py-3 rounded-xl bg-blue-600 font-semibold hover:bg-blue-500"
          >
            Entrar
          </button>
        </div>
      </main>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Resumen" },
    { id: "units", label: "Unidades" },
    { id: "residents", label: "Residentes" },
    { id: "access", label: "Accesos" },
    { id: "permissions", label: "Permisos" },
    { id: "controllers", label: "Controladores" },
    { id: "invitations", label: "Invitaciones" },
    { id: "visits", label: "Visitas" },
    { id: "audit", label: "Auditoría" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Panel de administración</h1>
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
          <button
            onClick={() => {
              fetch("/api/admin/logout", { method: "POST" }).then(() => setAuthed(false));
            }}
            className="text-sm text-zinc-400 hover:text-white"
          >
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
          <div className="rounded-lg bg-emerald-600/20 border border-emerald-600/40 text-emerald-300 px-4 py-3">
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
          </div>
        )}

        {tab === "units" && (
          <UnitsTab
            propertyId={propertyId}
            units={units}
            onChanged={() => {
              refresh();
              notify("Unidad actualizada");
            }}
          />
        )}

        {tab === "residents" && (
          <ResidentsTab
            units={units}
            residents={residents}
            onChanged={() => {
              refresh();
              notify("Residente actualizado");
            }}
          />
        )}

        {tab === "access" && (
          <AccessTab
            propertyId={propertyId}
            accessPoints={accessPoints}
            controllers={controllers}
            onChanged={() => {
              refresh();
              notify("Acceso actualizado");
            }}
          />
        )}

        {tab === "permissions" && (
          <PermissionsTab
            units={units}
            accessPoints={accessPoints}
            permissions={permissions}
            onChanged={() => {
              refresh();
              notify("Permiso actualizado");
            }}
          />
        )}

        {tab === "controllers" && (
          <ControllersTab
            propertyId={propertyId}
            controllers={controllers}
            onChanged={() => {
              refresh();
              notify("Controlador actualizado");
            }}
          />
        )}

        {tab === "invitations" && (
          <InvitationsTab
            units={units}
            residents={residents}
            invitations={invitations}
            onChanged={() => {
              refresh();
              notify("Invitación generada");
            }}
          />
        )}

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

        {tab === "audit" && (
          <Section title="Auditoría">
            <Table
              head={["Acción", "Actor", "Entidad", "Fecha", "Detalle"]}
              rows={audit.map((a: any) => [
                a.action,
                a.actor_type ?? "-",
                a.entity_type ?? "-",
                new Date(a.created_at).toLocaleString("es-AR"),
                a.metadata ? JSON.stringify(a.metadata) : "-",
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

function UnitsTab({
  propertyId,
  units,
  onChanged,
}: {
  propertyId: string;
  units: any[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ unit_number: "", display_name: "", building: "", floor: "" });

  async function create() {
    await api("/units", {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId, ...form }),
    });
    setForm({ unit_number: "", display_name: "", building: "", floor: "" });
    onChanged();
  }

  async function setBilling(id: string, status: string, amount: number) {
    await api(`/units/${id}/billing`, {
      method: "POST",
      body: JSON.stringify({ billingStatus: status, debtAmount: amount }),
    });
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
              <input
                type="number"
                defaultValue={u.debt_amount}
                id={`debt-${u.id}`}
                placeholder="Deuda"
                className={inputCls + " max-w-[140px]"}
              />
              <button className={btnCls + " bg-emerald-600"} onClick={() => setBilling(u.id, "OK", Number((document.getElementById(`debt-${u.id}`) as HTMLInputElement)?.value ?? 0))}>OK</button>
              <button className={btnCls + " bg-amber-500"} onClick={() => setBilling(u.id, "WARNING", Number((document.getElementById(`debt-${u.id}`) as HTMLInputElement)?.value ?? 0))}>WARNING</button>
              <button className={btnCls + " bg-red-600"} onClick={() => setBilling(u.id, "BLOCKED", Number((document.getElementById(`debt-${u.id}`) as HTMLInputElement)?.value ?? 0))}>BLOCKED</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResidentsTab({
  units,
  residents,
  onChanged,
}: {
  units: any[];
  residents: any[];
  onChanged: () => void;
}) {
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

function AccessTab({
  propertyId,
  accessPoints,
  controllers,
  onChanged,
}: {
  propertyId: string;
  accessPoints: any[];
  controllers: any[];
  onChanged: () => void;
}) {
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

function PermissionsTab({
  units,
  accessPoints,
  permissions,
  onChanged,
}: {
  units: any[];
  accessPoints: any[];
  permissions: any[];
  onChanged: () => void;
}) {
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
        rows={permissions.map((p) => [
          p.units?.display_name ?? "-",
          p.access_points?.name ?? "-",
          p.granted ? "Sí" : "No",
        ])}
      />
    </div>
  );
}

function ControllersTab({
  propertyId,
  controllers,
  onChanged,
}: {
  propertyId: string;
  controllers: any[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState({ name: "", type: "MOCK", url: "", secret: "" });

  async function create() {
    const config = form.type === "MOCK" ? null : { url: form.url, secret: form.secret || null };
    await api("/access-controllers", {
      method: "POST",
      body: JSON.stringify({ property_id: propertyId, name: form.name, type: form.type, config }),
    });
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
        head={["Nombre", "Tipo", "Estado", "Config"]}
        rows={controllers.map((c) => [c.name, c.type, c.status, c.config ? JSON.stringify(c.config) : "-"])}
      />
    </div>
  );
}

function InvitationsTab({
  units,
  residents,
  invitations,
  onChanged,
}: {
  units: any[];
  residents: any[];
  invitations: any[];
  onChanged: () => void;
}) {
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

const inputCls =
  "rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const btnCls =
  "rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold hover:bg-blue-500";
