"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  searchResidents,
  createVisit,
  getVisitStatus,
  ResidentResult,
  VisitStatus,
} from "@/lib/api";

type Step = "search" | "details" | "tracking";

const STATUS_UI: Record<VisitStatus, { title: string; tone: string }> = {
  PENDING: { title: "Solicitud enviada. Esperando respuesta…", tone: "text-amber-600" },
  ACCEPTED: { title: "Tu visita fue aceptada. ¡Bienvenido!", tone: "text-emerald-600" },
  REJECTED: { title: "Tu visita fue rechazada.", tone: "text-red-600" },
  EXPIRED: { title: "La solicitud expiró. Volvé a intentar.", tone: "text-gray-500" },
  CANCELLED: { title: "La solicitud fue cancelada.", tone: "text-gray-500" },
};

interface RecentVisit {
  visitId: string;
  residentId: string;
  displayName: string;
  unitLabel: string;
  visitorName: string;
  visitorType: "VISITOR" | "DELIVERY";
  status: VisitStatus;
  ts: number;
}

const recentKey = (token: string) => `portero:recent:${token}`;

function loadRecent(token: string): RecentVisit[] {
  try {
    return JSON.parse(localStorage.getItem(recentKey(token)) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(token: string, list: RecentVisit[]) {
  localStorage.setItem(recentKey(token), JSON.stringify(list.slice(0, 10)));
}

function patchRecentStatus(token: string, visitId: string, status: VisitStatus) {
  const list = loadRecent(token);
  const i = list.findIndex((r) => r.visitId === visitId);
  if (i >= 0) {
    list[i].status = status;
    saveRecent(token, list);
  }
}

export default function VisitorFlow({ token }: { token: string }) {
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResidentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResidentResult | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [visitorMessage, setVisitorMessage] = useState("");
  const [visitorType, setVisitorType] = useState<"VISITOR" | "DELIVERY">("VISITOR");
  const [status, setStatus] = useState<VisitStatus>("PENDING");
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<RecentVisit[]>([]);
  const [closeHint, setCloseHint] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecent(loadRecent(token));
  }, [token]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const finalized = step === "tracking" && status !== "PENDING";

  const closeTab = useCallback(() => {
    window.close();
    setCloseHint(true);
  }, []);

  // Atrapar el botón "atrás" del navegador cuando la visita ya está resuelta.
  useEffect(() => {
    if (!finalized) return;
    history.pushState({ finalized: true }, "");
    const onPop = () => {
      closeTab();
      history.pushState({ finalized: true }, "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [finalized, closeTab]);

  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      setError(null);
      try {
        const found = await searchResidents(token, q.trim());
        setResults(found);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al buscar");
      } finally {
        setSearching(false);
      }
    },
    [token],
  );

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const unitLabel = (r: ResidentResult) =>
    [r.unit_display_name || r.unit_number, r.building, r.floor ? `Piso ${r.floor}` : null]
      .filter(Boolean)
      .join(" · ");

  const selectResident = (r: ResidentResult) => {
    setSelected(r);
    setStep("details");
  };

  const send = async () => {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      const res = await createVisit({
        token,
        residentId: selected.id,
        visitorName: visitorName.trim() || undefined,
        visitorMessage: visitorMessage.trim() || undefined,
        visitorType,
      });
      setStatus(res.status);
      setStep("tracking");

      const entry: RecentVisit = {
        visitId: res.visitId,
        residentId: selected.id,
        displayName: selected.display_name,
        unitLabel: unitLabel(selected),
        visitorName: visitorName.trim(),
        visitorType,
        status: res.status,
        ts: Date.now(),
      };
      saveRecent(token, [entry, ...loadRecent(token)]);
      setRecent(loadRecent(token));

      poll(res.trackingToken, res.visitId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
      setSending(false);
    }
  };

  const repeat = async (r: RecentVisit) => {
    setSending(true);
    setError(null);
    try {
      const res = await createVisit({
        token,
        residentId: r.residentId,
        visitorName: r.visitorName || undefined,
        visitorType: r.visitorType,
      });
      setStatus(res.status);
      setStep("tracking");

      const entry: RecentVisit = { ...r, visitId: res.visitId, status: res.status, ts: Date.now() };
      saveRecent(token, [entry, ...loadRecent(token)]);
      setRecent(loadRecent(token));

      poll(res.trackingToken, res.visitId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
      setSending(false);
    }
  };

  const poll = (trackingToken: string, visitId: string) => {
    const tick = async () => {
      try {
        const s = await getVisitStatus(trackingToken);
        setStatus(s.status);
        if (s.status === "PENDING") {
          timerRef.current = setTimeout(tick, 2000);
        } else {
          patchRecentStatus(token, visitId, s.status);
          setRecent(loadRecent(token));
        }
      } catch {
        timerRef.current = setTimeout(tick, 3000);
      }
    };
    tick();
  };

  const back = () => {
    setStep("search");
    setSelected(null);
    setError(null);
    setVisitorName("");
    setVisitorMessage("");
  };

  if (step === "tracking") {
    const ui = STATUS_UI[status];
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="text-6xl">
            {status === "PENDING" ? "⏳" : status === "ACCEPTED" ? "✅" : status === "REJECTED" ? "❌" : "⏰"}
          </div>
          <h1 className={`text-2xl font-bold ${ui.tone}`}>{ui.title}</h1>
          {status === "PENDING" && <p className="text-zinc-400">No cierres esta pantalla.</p>}
          {finalized && (
            <>
              <button
                onClick={closeTab}
                className="mt-4 px-6 py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200"
              >
                Cerrar pestaña
              </button>
              {closeHint && (
                <p className="text-zinc-500 text-sm">Si no se cerró, ya podés cerrar esta pestaña manualmente.</p>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-md mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">
            {step === "search" ? "¿A quién venís a visitar?" : "Confirmar visita"}
          </h1>
          <p className="text-zinc-400 text-sm">
            {step === "search"
              ? "Buscá por nombre y apellido (mínimo 2 palabras) o por departamento."
              : "Completá los datos opcionales y avisá."}
          </p>
        </header>

        {error && (
          <div className="rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {step === "search" && (
          <div className="space-y-4">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Juan Pérez o 4B"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="space-y-2">
              {searching && <p className="text-zinc-500 text-sm">Buscando…</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="text-zinc-500 text-sm">Sin coincidencias.</p>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectResident(r)}
                  className="w-full text-left rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 hover:border-blue-500 transition"
                >
                  <p className="font-semibold">{r.display_name}</p>
                  <p className="text-sm text-zinc-400">{unitLabel(r)}</p>
                </button>
              ))}
            </div>

            {recent.length > 0 && (
              <div className="pt-2">
                <h2 className="text-sm font-semibold text-zinc-400 mb-2">Tus visitas recientes</h2>
                <div className="space-y-2">
                  {recent.map((r, i) => (
                    <div
                      key={`${r.visitId}-${i}`}
                      className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{r.displayName}</p>
                        <p className="text-xs text-zinc-500 truncate">{r.unitLabel}</p>
                        <p className={`text-xs mt-0.5 ${STATUS_UI[r.status]?.tone ?? "text-zinc-400"}`}>
                          {STATUS_UI[r.status]?.title ?? r.status}
                        </p>
                      </div>
                      <button
                        onClick={() => repeat(r)}
                        disabled={sending}
                        className="shrink-0 px-3 py-2 rounded-lg bg-blue-600 text-sm font-semibold hover:bg-blue-500 disabled:opacity-50"
                      >
                        Repetir
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "details" && selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
              <p className="font-semibold">{selected.display_name}</p>
              <p className="text-sm text-zinc-400">{unitLabel(selected)}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setVisitorType("VISITOR")}
                className={`flex-1 rounded-xl px-4 py-2 border ${
                  visitorType === "VISITOR"
                    ? "bg-blue-600 border-blue-600"
                    : "bg-zinc-900 border-zinc-700"
                }`}
              >
                Visita
              </button>
              <button
                onClick={() => setVisitorType("DELIVERY")}
                className={`flex-1 rounded-xl px-4 py-2 border ${
                  visitorType === "DELIVERY"
                    ? "bg-blue-600 border-blue-600"
                    : "bg-zinc-900 border-zinc-700"
                }`}
              >
                Repartidor
              </button>
            </div>

            <input
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={visitorMessage}
              onChange={(e) => setVisitorMessage(e.target.value)}
              placeholder="Mensaje (opcional)"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex gap-3">
              <button
                onClick={back}
                className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 font-semibold"
              >
                Atrás
              </button>
              <button
                onClick={send}
                disabled={sending}
                className="flex-1 py-3 rounded-xl bg-blue-600 font-semibold hover:bg-blue-500 disabled:opacity-50"
              >
                {sending ? "Enviando…" : `Avisar a ${selected.display_name}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
