"use client";

import MercadoPagoCardBrick from "@/components/MercadoPagoCardBrick";
import { AlertTriangle, CreditCard } from "lucide-react";

interface PayButtonProps {
  applicationId: string | null;
  applicationStatus: string | null;
  mercadoPagoLink?: string;
  missingDocuments?: string[];
  payerEmail?: string;
}

function canPay(status: string | null) {
  return status === "PENDING_PAYMENT" || status === "RENEWAL_AVAILABLE";
}

export default function PayButton({
  applicationId,
  applicationStatus,
  missingDocuments = [],
  payerEmail = "",
}: PayButtonProps) {
  const isPaymentAllowed =
    Boolean(applicationId) &&
    canPay(applicationStatus) &&
    missingDocuments.length === 0;

  return (
    <section className="rounded-3xl border border-slate-850 bg-slate-900/40 p-6 lg:p-8 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-amber-400 font-semibold mb-2">
          Pago real
        </p>

        <h2 className="text-2xl font-bold text-white">
          Pago con Visa / Mastercard
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Ingresa los datos de tu tarjeta dentro del sistema. Mercado Pago
          procesa el pago de forma segura y el sistema programa la inspección
          cuando el pago sea aprobado.
        </p>
      </div>

      {!applicationId && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200 text-sm">
          No hay un trámite activo para pagar.
        </div>
      )}

      {missingDocuments.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-sm">
          Primero debes subir los documentos obligatorios antes de realizar el
          pago.
        </div>
      )}

      {!canPay(applicationStatus) && applicationId && (
        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-slate-300 text-sm">
          Este trámite no se encuentra en estado pendiente de pago. Estado
          actual:{" "}
          <span className="font-semibold text-amber-300">
            {applicationStatus?.replaceAll("_", " ") || "SIN ESTADO"}
          </span>
        </div>
      )}

      {!isPaymentAllowed && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 text-slate-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-300 mt-1" />
            <p className="text-sm">
              Cuando el trámite esté en estado PAGO PENDIENTE y tenga los
              documentos completos, aparecerá aquí el formulario de tarjeta.
            </p>
          </div>
        </div>
      )}

      {isPaymentAllowed && applicationId && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="w-6 h-6 text-amber-300 mt-1" />
              <div>
                <p className="font-bold text-white">Formulario seguro</p>
                <p className="text-sm text-slate-300 mt-1">
                  Los datos de tarjeta son procesados por Mercado Pago. El
                  sistema municipal no almacena número de tarjeta ni CVV.
                </p>
              </div>
            </div>
          </div>

          <MercadoPagoCardBrick
            applicationId={applicationId}
            payerEmail={payerEmail}
          />
        </div>
      )}
    </section>
  );
}