"use client";

import { useState } from "react";
import { DollarSign, CheckCircle2, AlertTriangle } from "lucide-react";

export default function PayButton({ applicationId }: { applicationId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!applicationId) {
      setError("No hay trámite activo para procesar el pago.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/solicitante/pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "No se pudo procesar el pago.");
        return;
      }

      setMessage(`Pago procesado. Operación: ${data.payment.operationNumber}`);
    } catch (err) {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-slate-850 bg-slate-900/40 p-6">
      <div className="flex items-center gap-3 text-amber-300">
        <DollarSign className="w-5 h-5" />
        <div>
          <h3 className="text-lg font-bold text-white">Pago simulado</h3>
          <p className="text-slate-400 text-sm">Paga S/2 para avanzar con la inspección y continuar el trámite.</p>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {message}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handlePay}
        disabled={loading || !applicationId}
        className="w-full rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Procesando..." : "Pagar S/2"}
      </button>
    </div>
  );
}
