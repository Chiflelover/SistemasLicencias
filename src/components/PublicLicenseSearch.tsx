"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2, Download } from "lucide-react";
import SubsanarPublico from "@/components/SubsanarPublico";

/** Estados del ciclo de observación que admiten subsanar documentos. */
const ESTADOS_OBSERVADO = [
  "FIRST_INSPECTION_REJECTED",
  "SECOND_INSPECTION_SCHEDULED",
];

type SearchResult = {
  id: string;
  number: string;
  status: string;
  // Local de este trámite. Un mismo RUC puede tener varias licencias, una por
  // local: es lo que distingue una fila de otra en la lista.
  establishmentAddress: string | null;
  business: {
    ruc: string;
    legalName: string;
    commercialAddress: string | null;
    activityType: string | null;
  };
  license: {
    licenseNumber: string;
    status: string;
    expiresAt: string;
  } | null;
  subsanado?: boolean;
  /** Solo en trámites cerrados en firme. Null si no se registró un motivo. */
  motivoRechazo?: string | null;
};

/** Estado de la licencia emitida. */
function formatLicenseStatus(status: string) {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "RENEWAL_AVAILABLE":
      return "Licencia por vencer";
    case "EXPIRED":
      return "Vencida";
    default:
      return status;
  }
}

/** Estado del trámite cuando todavía no hay licencia emitida. */
const ESTADO_TRAMITE: Record<string, string> = {
  DRAFT: "En borrador",
  DOCUMENTS_COMPLETE: "Documentos completos",
  PENDING_PAYMENT: "Pendiente de pago",
  PAYMENT_COMPLETED: "Pagado, esperando inspección",
  INSPECTION_SCHEDULED: "Inspección programada",
  FIRST_INSPECTION_REJECTED: "Observado",
  SECOND_INSPECTION_SCHEDULED: "Observado · 2da inspección programada",
  LICENSE_ISSUED: "Licencia emitida",
  DEFINITIVELY_REJECTED: "Rechazado definitivo",
  RENEWAL_AVAILABLE: "Licencia por vencer",
  EXPIRED: "Licencia vencida",
  CANCELLED: "Licencia dada de baja",
};

function formatApplicationStatus(status: string) {
  return ESTADO_TRAMITE[status] ?? status.replaceAll("_", " ");
}

/** Color según si el trámite está resuelto, en curso o rechazado. */
function estadoColor(status: string) {
  if (status === "LICENSE_ISSUED") return "text-emerald-300";
  if (status === "DEFINITIVELY_REJECTED" || status === "EXPIRED")
    return "text-rose-300";
  return "text-amber-300";
}

export default function PublicLicenseSearch() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanQuery = query.trim();

    setErrorMessage(null);
    setResults([]);
    setSearchedQuery(cleanQuery);

    if (!/^\d{11}$/.test(cleanQuery)) {
      setErrorMessage("Ingresa un RUC válido de 11 dígitos.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/public/consulta?q=${encodeURIComponent(cleanQuery)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo realizar la consulta.");
      }

      setResults(data.results || []);
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSearch} className="grid gap-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-200">
            RUC del negocio
          </span>

          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value.replace(/\D/g, "").slice(0, 11))
            }
            type="text"
            inputMode="numeric"
            maxLength={11}
            placeholder="Ej. 20123456789"
            className="mt-3 w-full rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-4 text-slate-100 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-3xl bg-amber-500 px-5 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {errorMessage && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          {errorMessage}
        </div>
      )}

      {searchedQuery && !loading && !errorMessage && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-400">Resultados para:</p>
            <p className="text-lg font-semibold text-white">{searchedQuery}</p>
          </div>

          {results.length === 0 ? (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
              No se encontró ningún trámite con ese RUC.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/80 shadow-lg shadow-slate-950/20">
              <table className="min-w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/90 text-xs uppercase tracking-[0.18em] text-slate-400">
                  <tr>
                    <th className="px-4 py-4">Razón social</th>
                    <th className="px-4 py-4">Trámite</th>
                    <th className="px-4 py-4">Estado del trámite</th>
                    <th className="px-4 py-4">Licencia</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {results.map((application) => (
                    <tr key={application.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-4">
                        <p className="text-white">
                          {application.business.legalName}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500">
                          RUC {application.business.ruc}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {application.establishmentAddress ||
                            application.business.commercialAddress ||
                            "Dirección no registrada"}
                        </p>
                      </td>

                      <td className="px-4 py-4 font-mono text-slate-300">
                        {application.number}
                      </td>

                      <td
                        className={`px-4 py-4 font-semibold ${estadoColor(
                          application.status
                        )}`}
                      >
                        {formatApplicationStatus(application.status)}
                      </td>

                      <td className="px-4 py-4">
                        {application.license ? (
                          <>
                            <p className="font-mono text-xs text-slate-300">
                              {application.license.licenseNumber}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-400">
                              {formatLicenseStatus(application.license.status)}
                              {" · vence "}
                              {new Date(
                                application.license.expiresAt
                              ).toLocaleDateString("es-PE")}
                            </p>

                            <a
                              href={`/api/public/licencia/${application.id}`}
                              className="mt-2 inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-400"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Descargar PDF
                            </a>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Aún no emitida
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Un trámite rechazado sin motivo visible deja al administrado sin
              saber qué pasó ni qué hacer. */}
          {results
            .filter((app) => app.motivoRechazo)
            .map((app) => (
              <div
                key={`rechazo-${app.id}`}
                className="mt-2 flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong className="font-bold text-white">
                    Trámite rechazado
                  </strong>{" "}
                  — {app.motivoRechazo}. Puedes iniciar un trámite nuevo con
                  este mismo RUC.
                </span>
              </div>
            ))}

          {/* Subsanación: si un trámite quedó observado y todavía no subió los
              documentos corregidos, se ofrece el formulario con el correo como
              llave. Si ya subsanó, se muestra el aviso de espera. */}
          {results
            .filter((app) => ESTADOS_OBSERVADO.includes(app.status))
            .map((app) => (
              <div key={`subsanar-${app.id}`} className="mt-2">
                {app.subsanado ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-start gap-2.5 text-sm text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Documentos subsanados del trámite {app.number}. Pendiente
                      de la segunda inspección.
                    </span>
                  </div>
                ) : (
                  <SubsanarPublico
                    applicationId={app.id}
                    applicationNumber={app.number}
                    legalName={app.business.legalName}
                  />
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}