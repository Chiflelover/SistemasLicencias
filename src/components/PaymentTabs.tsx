"use client";

import { useState } from "react";
import MercadoPagoCardBrick from "./MercadoPagoCardBrick";
import ManualPaymentForm from "./ManualPaymentForm";
import { CreditCard, Upload } from "lucide-react";

interface PaymentTabsProps {
  applicationId: string;
  payerEmail: string;
}

export default function PaymentTabs({ applicationId, payerEmail }: PaymentTabsProps) {
  const [activeTab, setActiveTab] = useState<"card" | "manual">("card");

  return (
    <div className="space-y-6">
      {/* Tabs Selector */}
      <div className="flex border border-slate-800 bg-slate-900/50 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab("card")}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2.5 transition cursor-pointer ${
            activeTab === "card"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Pagar con Tarjeta
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2.5 transition cursor-pointer ${
            activeTab === "manual"
              ? "bg-amber-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Upload className="w-4 h-4" />
          Ya pagué (Subir comprobante)
        </button>
      </div>

      {/* Active Tab Content */}
      {activeTab === "card" ? (
        <div className="rounded-3xl border border-slate-800 bg-white p-6 text-slate-950 animate-fadeIn">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-950">
              Pago con Visa / Mastercard
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Ingresa los datos de tu tarjeta. Mercado Pago procesará el
              pago de forma segura por S/ 2.00.
            </p>
          </div>

          <MercadoPagoCardBrick
            applicationId={applicationId}
            payerEmail={payerEmail}
          />
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-white animate-fadeIn">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-white">
              Confirmar Pago Manual
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Sube la imagen del comprobante de transferencia bancaria por derecho de trámite de <strong>S/ 180.00</strong>.
            </p>
          </div>

          <ManualPaymentForm applicationId={applicationId} />
        </div>
      )}
    </div>
  );
}
