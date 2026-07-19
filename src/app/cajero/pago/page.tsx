"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  Loader2,
} from "lucide-react";

interface ApplicationRow {
  id: string;
  number: string;
  status: string;
  business: { legalName: string; ruc: string };
  documents: Array<{ id: string; type: string }>;
  payments: Array<{ id: string; operationNumber: string }>;
}

export default function CajeroPagoPage() {
  const router = useRouter();

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const cargarSolicitudes = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/cajero/solicitudes", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar las solicitudes.");
      }

      setApplications(data.applications || []);
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const registrarPago = async (applicationId: string) => {
    setPayingId(applicationId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/cajero/pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "No se pudo registrar el pago.");
      }

      setSuccessMessage(
        `Pago registrado. Operación ${data.operationNumber}. La inspección quedó agendada.`
      );

      await cargarSolicitudes();
      router.refresh();
    } catch (error: any) {
      setErrorMessage(error.message);
    } finally {
      setPayingId(null);
    }
  };

  const cobrables = applications.filter(
    (a) => a.status === "PENDING_PAYMENT" || a.status === "RENEWAL_AVAILABLE"
  );

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl">
      <div>
        <Link
          href="/cajero"
          className="text-sm text-slate-400 hover:text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al panel
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-white">
          Registrar pago presencial
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Confirma el cobro de S/ 180.00 en ventanilla. Al registrarlo, el
          sistema agenda automáticamente la inspección.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 text-sm flex gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-850 bg-slate-900/40 overflow-hidden">
        <div className="p-5 border-b border-slate-850">
          <h2 className="text-lg font-bold text-white">
            Trámites pendientes de cobro
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Solo aparecen los que registraste vos y ya tienen sus documentos
            completos.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 mx-auto animate-spin" />
          </div>
        ) : cobrables.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <DollarSign className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No hay trámites pendientes de cobro.
          </div>
        ) : (
          <div className="divide-y divide-slate-850">
            {cobrables.map((application) => {
              const tieneDocumentos =
                application.documents.some((d) => d.type === "FLOOR_PLAN") &&
                application.documents.some((d) => d.type === "RUC_RECORD");

              return (
                <div
                  key={application.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-mono text-amber-300 text-sm">
                      {application.number}
                    </p>
                    <p className="text-white font-semibold mt-0.5">
                      {application.business.legalName}
                    </p>
                    <p className="text-slate-500 text-xs font-mono mt-0.5">
                      RUC {application.business.ruc}
                    </p>

                    {!tieneDocumentos && (
                      <p className="text-amber-400 text-xs mt-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Faltan el plano del local o la ficha RUC
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => registrarPago(application.id)}
                    disabled={!tieneDocumentos || payingId === application.id}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
                  >
                    {payingId === application.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4" />
                    )}
                    Cobrar S/ 180.00
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
