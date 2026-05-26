"use client";

import { useEffect, useState } from "react";

interface FineRecord {
  id: string;
  amount: number | string;
  description: string;
  observations: string | null;
  issuedAt: string;
  status: string;
  license: {
    licenseNumber: string;
    application: {
      number: string;
      business: {
        legalName: string;
        ruc: string;
      };
    };
  };
}

function formatMoney(value: number | string | null | undefined) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0.00";
  }

  return amount.toFixed(2);
}

function formatStatus(status: string) {
  const statuses: Record<string, string> = {
    PENDING: "PENDIENTE",
    PAID: "PAGADA",
    CANCELLED: "ANULADA",
    ACTIVE: "ACTIVA",
    EXPIRED: "VENCIDA",
  };

  return statuses[status] || status;
}

export default function InspectorFinesPage() {
  const [fines, setFines] = useState<FineRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchFines = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/inspector/multas");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "No se pudieron cargar las multas.");
        }

        setFines(data.fines || []);
      } catch (error) {
        setErrorMessage((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchFines();
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6">
        <h1 className="text-2xl font-bold text-white">Multas Registradas</h1>
        <p className="text-slate-400 mt-2">
          Visualiza las multas e inspecciones inopinadas que hayas registrado en el sistema.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
          {errorMessage}
        </div>
      )}

      <div className="bg-slate-900/40 border border-slate-850 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-slate-850">
          <h2 className="text-lg font-semibold text-white">Resumen de multas</h2>
          <p className="text-slate-400 text-sm mt-1">
            Aquí se muestran las multas registradas por ti.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/30 text-slate-400 uppercase tracking-[0.18em] text-xs">
              <tr>
                <th className="px-4 py-4">Licencia</th>
                <th className="px-4 py-4">Establecimiento</th>
                <th className="px-4 py-4">Monto</th>
                <th className="px-4 py-4">Emitida</th>
                <th className="px-4 py-4">Estado</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-850/80">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Cargando multas...
                  </td>
                </tr>
              )}

              {!loading &&
                fines.map((fine) => (
                  <tr key={fine.id} className="hover:bg-slate-900/20">
                    <td className="px-4 py-4 text-white">
                      {fine.license?.licenseNumber || "Sin licencia"}
                    </td>

                    <td className="px-4 py-4">
                      <div>
                        {fine.license?.application?.business?.legalName ||
                          "Establecimiento no registrado"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {fine.license?.application?.business?.ruc || "Sin RUC"}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-amber-300">
                      S/ {formatMoney(fine.amount)}
                    </td>

                    <td className="px-4 py-4 text-slate-400">
                      {fine.issuedAt
                        ? new Date(fine.issuedAt).toLocaleDateString("es-PE")
                        : "Sin fecha"}
                    </td>

                    <td className="px-4 py-4 text-slate-200">
                      {formatStatus(fine.status)}
                    </td>
                  </tr>
                ))}

              {!loading && fines.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Aún no has registrado multas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}