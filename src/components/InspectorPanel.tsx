"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, FileSearch, AlertCircle, ClipboardList, MessageSquare } from "lucide-react";

interface InspectionSummary {
  id: string;
  applicationId: string;
  scheduledAt: string;
  number: "FIRST" | "SECOND";
  status: string;
  application: {
    number: string;
    business: { legalName: string; ruc: string };
  };
}

interface InspectionDetail {
  id: string;
  scheduledAt: string;
  number: "FIRST" | "SECOND";
  status: string;
  result: string | null;
  observations: string | null;
  application: {
    id: string;
    number: string;
    status: string;
    business: { legalName: string; ruc: string; commercialAddress: string | null; activityType: string | null };
    applicant: { fullName: string; email: string; phone: string } | null;
    documents: Array<{ id: string; name: string; type: string; fileName: string }>;
    payments: Array<{ id: string; amount: number; operationNumber: string; status: string; createdAt: string }>;
  };
}

const formatDateTime = (isoDate: string) => {
  const date = new Date(isoDate);
  return date.toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function InspectorPanel() {
  const [inspections, setInspections] = useState<InspectionSummary[]>([]);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [details, setDetails] = useState<InspectionDetail | null>(null);
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const formatPaymentAmount = (amount: unknown) => {
    if (typeof amount === "number") {
      return amount.toFixed(2);
    }

    if (typeof amount === "string" && !Number.isNaN(Number(amount))) {
      return Number(amount).toFixed(2);
    }

    return String(amount ?? "0.00");
  };

  const selectedInspection = useMemo(
    () => inspections.find((item) => item.id === selectedInspectionId) || null,
    [inspections, selectedInspectionId]
  );

  const loadInspections = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inspector/inspections");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo cargar las inspecciones");
      }

      setInspections(data.inspections || []);
      setSelectedInspectionId((current) => current ?? data.inspections?.[0]?.id ?? null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/inspector/inspections/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo cargar el detalle de la inspección");
      }

      setDetails(data.inspection || null);
      setObservations(data.inspection?.observations || "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, [loadInspections]);

  useEffect(() => {
    if (selectedInspectionId) {
      loadDetail(selectedInspectionId);
    } else {
      setDetails(null);
    }
  }, [selectedInspectionId]);

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedInspectionId) return;

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/inspector/inspections/${selectedInspectionId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, observations }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo procesar la acción");
      }

      setSuccessMessage(
        action === "approve"
          ? "Inspección aprobada correctamente."
          : "Inspección rechazada y observaciones registradas."
      );
      await loadInspections();
      await loadDetail(selectedInspectionId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Inspecciones asignadas</h2>
              <p className="text-slate-400 text-sm mt-2">
                Revisa tu bandeja de inspecciones y abre el detalle para aprobar o rechazar cada trámite.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-emerald-200 text-xs font-semibold uppercase tracking-wide">
              {inspections.length} asignadas
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-950/30 text-slate-400 text-xs uppercase tracking-[0.18em]">
                  <th className="px-4 py-3">Trámite</th>
                  <th className="px-4 py-3">Establecimiento</th>
                  <th className="px-4 py-3">Programado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                {inspections.map((inspection) => (
                  <tr
                    key={inspection.id}
                    className={`cursor-pointer transition hover:bg-slate-900/40 ${
                      inspection.id === selectedInspectionId ? "bg-slate-900/50" : ""
                    }`}
                    onClick={() => setSelectedInspectionId(inspection.id)}
                  >
                    <td className="px-4 py-3 font-medium text-white">{inspection.application.number}</td>
                    <td className="px-4 py-3">
                      <div>{inspection.application.business.legalName}</div>
                      <div className="text-xs text-slate-500">{inspection.application.business.ruc}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDateTime(inspection.scheduledAt)}</td>
                  </tr>
                ))}
                {inspections.length === 0 && !loading && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      No tienes inspecciones asignadas en este momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Información de la inspección</h3>
              <p className="text-slate-500 text-sm mt-1">
                Revisa los datos del trámite, los documentos y marca la acción correspondiente.
              </p>
            </div>
            <div className="text-xs text-slate-400">{loading ? "Actualizando..." : "Datos actualizados"}</div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {successMessage}
            </div>
          )}

          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
                <p className="text-slate-500 uppercase text-[11px] tracking-[0.2em]">Nombre del negocio</p>
                <p className="mt-2 text-white">{details?.application.business.legalName || "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
                <p className="text-slate-500 uppercase text-[11px] tracking-[0.2em]">RUC</p>
                <p className="mt-2 text-white">{details?.application.business.ruc || "-"}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
                <p className="text-slate-500 uppercase text-[11px] tracking-[0.2em]">Dirección</p>
                <p className="mt-2 text-white">{details?.application.business.commercialAddress || "No registrada"}</p>
              </div>
              <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
                <p className="text-slate-500 uppercase text-[11px] tracking-[0.2em]">Rubro</p>
                <p className="mt-2 text-white">{details?.application.business.activityType || "No registrada"}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-slate-500 uppercase text-[11px] tracking-[0.2em]">Solicitante</p>
                  <p className="mt-2 text-white">{details?.application.applicant?.fullName || "-"}</p>
                </div>
                <div className="text-slate-400 text-xs">
                  {details?.application.applicant?.email}
                  <br />
                  {details?.application.applicant?.phone}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
              <p className="text-slate-500 uppercase text-[11px] tracking-[0.2em]">Documentos adjuntos</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {details?.application.documents.length ? (
                  details.application.documents.map((document) => (
                    <a
                      key={document.id}
                      href={`/api/public/documentos/${document.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-850/50 bg-slate-900/70 p-3 hover:border-amber-500/50 hover:bg-slate-900 transition text-left cursor-pointer group"
                      title="Haga clic para ver el documento"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ClipboardList className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{document.name}</p>
                          <p className="text-xs text-slate-500 truncate">{document.fileName}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 shrink-0">
                        VER
                      </span>
                    </a>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No hay documentos adjuntos.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
                <p className="text-slate-500 uppercase text-[11px] tracking-[0.2em]">Último pago</p>
                <p className="mt-2 text-white">
                  {details?.application.payments.length ? (
                    `S/ ${formatPaymentAmount(details.application.payments.at(-1)?.amount)} - ${details.application.payments.at(-1)?.operationNumber}`
                  ) : (
                    "Sin pago registrado"
                  )}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
                <p className="text-slate-500 uppercase text-[11px] tracking-[0.2em]">Estado del trámite</p>
                <p className="mt-2 text-white">{details?.application.status || "-"}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-850 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 text-slate-300">
                <MessageSquare className="w-4 h-4" />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Observaciones del inspector</p>
              </div>
              <textarea
                value={observations}
                onChange={(event) => setObservations(event.target.value)}
                placeholder="Agrega comentarios importantes sobre la inspección..."
                className="mt-3 w-full min-h-[140px] resize-none rounded-2xl border border-slate-850 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => handleAction("reject")}
              disabled={!selectedInspectionId || actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AlertCircle className="w-4 h-4" />
              Rechazar trámite
            </button>
            <button
              type="button"
              onClick={() => handleAction("approve")}
              disabled={!selectedInspectionId || actionLoading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Aprobar inspección
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="rounded-full bg-slate-800 p-2 text-amber-400">
                <FileSearch className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Resumen de actuación</p>
                <p className="mt-2 text-white text-sm">Proceso de validación de trámites asignados.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-2xl border border-slate-850 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total inspecciones</p>
                <p className="mt-2 text-lg font-semibold text-white">{inspections.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-850 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Próxima inspección</p>
                <p className="mt-2 text-white">{selectedInspection ? formatDateTime(selectedInspection.scheduledAt) : "No hay inspecciones"}</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-850 rounded-2xl p-6">
            <div className="flex items-center gap-3 text-slate-400">
              <span className="rounded-full bg-slate-800 p-2 text-slate-300">
                <ClipboardList className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Pauta rápida</p>
                <p className="mt-2 text-white text-sm">
                  Aprueba un trámite solo si cumple con los requisitos y registra observaciones precisas en caso de rechazo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
