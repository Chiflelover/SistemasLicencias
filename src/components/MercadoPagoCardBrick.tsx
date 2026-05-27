"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

interface MercadoPagoCardBrickProps {
  applicationId: string;
  payerEmail?: string;
}

function isInvalidPublicKey(publicKey?: string) {
  if (!publicKey) return true;

  const value = publicKey.trim();

  return (
    value.length < 20 ||
    value.includes("AQUI_PEGA") ||
    value.includes("PEGA_AQUI") ||
    value.includes("PUBLIC_KEY_REAL") ||
    value === "TEST" ||
    value === "APP_USR"
  );
}

function isValidGmail(email: string) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email.trim().toLowerCase());
}

export default function MercadoPagoCardBrick({
  applicationId,
}: MercadoPagoCardBrickProps) {
  const router = useRouter();
  const cardFormRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMercadoPagoScript() {
      if (window.MercadoPago) return;

      await new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector(
          'script[src="https://sdk.mercadopago.com/js/v2"]'
        );

        if (existingScript) {
          existingScript.addEventListener("load", () => resolve());
          existingScript.addEventListener("error", () =>
            reject(new Error("No se pudo cargar el SDK de Mercado Pago."))
          );
          return;
        }

        const script = document.createElement("script");
        script.src = "https://sdk.mercadopago.com/js/v2";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error("No se pudo cargar el SDK de Mercado Pago."));

        document.body.appendChild(script);
      });
    }

    async function initializeCardForm() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

        if (isInvalidPublicKey(publicKey)) {
          throw new Error(
            "Tu Public Key de Mercado Pago no está configurada correctamente. Revisa NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY en .env y reinicia npm run dev."
          );
        }

        await loadMercadoPagoScript();

        if (cancelled) return;

        if (!window.MercadoPago) {
          throw new Error("El SDK de Mercado Pago no está disponible.");
        }

        const mp = new window.MercadoPago(publicKey, {
          locale: "es-PE",
        });

        cardFormRef.current = mp.cardForm({
          amount: "2",
          iframe: true,
          form: {
            id: "form-checkout",
            cardNumber: {
              id: "form-checkout__cardNumber",
              placeholder: "Número de tarjeta",
            },
            expirationDate: {
              id: "form-checkout__expirationDate",
              placeholder: "MM/AA",
            },
            securityCode: {
              id: "form-checkout__securityCode",
              placeholder: "CVV",
            },
            cardholderEmail: {
              id: "form-checkout__cardholderEmail",
              placeholder: "correo@gmail.com",
            },
            cardholderName: {
              id: "form-checkout__cardholderName",
              placeholder: "Nombre como aparece en la tarjeta",
            },
            identificationType: {
              id: "form-checkout__identificationType",
              placeholder: "Tipo de documento",
            },
            identificationNumber: {
              id: "form-checkout__identificationNumber",
              placeholder: "DNI",
            },
            issuer: {
              id: "form-checkout__issuer",
              placeholder: "Banco emisor",
            },
            installments: {
              id: "form-checkout__installments",
              placeholder: "Cuotas",
            },
          },
          callbacks: {
            onFormMounted: (error: any) => {
              if (cancelled) return;

              setLoading(false);

              if (error) {
                console.error("Error montando CardForm:", error);
                setErrorMessage(
                  "No se pudo cargar el formulario de Mercado Pago."
                );
              }
            },
            onSubmit: async (event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();

              try {
                setPaying(true);
                setErrorMessage(null);
                setSuccessMessage(null);

                const cardFormData = cardFormRef.current.getCardFormData();

                const payerEmail = String(
                  cardFormData.cardholderEmail || ""
                )
                  .trim()
                  .toLowerCase();

                if (!isValidGmail(payerEmail)) {
                  throw new Error(
                    "Ingresa un correo Gmail válido. Ejemplo: usuario@gmail.com"
                  );
                }

                const response = await fetch(
                  `/api/public/tramite/${applicationId}/pago/card`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      token: cardFormData.token,
                      payment_method_id: cardFormData.paymentMethodId,
                      issuer_id: cardFormData.issuerId,
                      installments: Number(cardFormData.installments || 1),
                      payerEmail,
                      payer: {
                        email: payerEmail,
                        identification: {
                          type: cardFormData.identificationType || "DNI",
                          number: cardFormData.identificationNumber || "",
                        },
                      },
                    }),
                  }
                );

                const data = await response.json();

                if (!response.ok) {
                  throw new Error(
                    data.error || "No se pudo procesar el pago con tarjeta."
                  );
                }

                setSuccessMessage(
                  "Pago aprobado correctamente. Tu trámite continuará a inspección."
                );

                setTimeout(() => {
                  router.refresh();
                  router.push(`/tramite/${applicationId}/inspecciones`);
                }, 1500);
              } catch (error) {
                setErrorMessage((error as Error).message);
              } finally {
                setPaying(false);
              }
            },
            onFetching: () => {
              return () => {};
            },
          },
        });
      } catch (error) {
        console.error("Error cargando Mercado Pago:", error);
        setLoading(false);
        setErrorMessage((error as Error).message);
      }
    }

    initializeCardForm();

    return () => {
      cancelled = true;

      if (cardFormRef.current?.unmount) {
        try {
          cardFormRef.current.unmount();
        } catch {
          // Ignorar si Mercado Pago ya desmontó el formulario.
        }
      }
    };
  }, [applicationId, router]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-white p-5 text-slate-950">
      <h3 className="mb-2 text-lg font-bold">Pago con Visa / Mastercard</h3>

      <p className="mb-5 text-sm text-slate-600">
        Completa los datos de tu tarjeta. Mercado Pago tokeniza la información
        sensible; el sistema municipal no guarda número de tarjeta ni CVV.
      </p>

      {loading && (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Cargando formulario seguro de Mercado Pago...
        </div>
      )}

      <form id="form-checkout" className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-800">
            Número de tarjeta
          </label>
          <div
            id="form-checkout__cardNumber"
            className="h-12 rounded-2xl border border-slate-300 bg-white px-4 py-3"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-800">
              Vencimiento
            </label>
            <div
              id="form-checkout__expirationDate"
              className="h-12 rounded-2xl border border-slate-300 bg-white px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-800">
              CVV
            </label>
            <div
              id="form-checkout__securityCode"
              className="h-12 rounded-2xl border border-slate-300 bg-white px-4 py-3"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-800">
            Correo Gmail del pagador
          </label>
          <input
            type="email"
            id="form-checkout__cardholderEmail"
            placeholder="usuario@gmail.com"
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          <p className="mt-1 text-xs text-slate-500">
            Debe ser un correo Gmail real del pagador.
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-800">
            Nombre del titular
          </label>
          <input
            type="text"
            id="form-checkout__cardholderName"
            placeholder="Nombre como aparece en la tarjeta"
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-800">
            Documento del titular
          </label>

          <div className="grid gap-4 md:grid-cols-[150px_1fr]">
            <select
              id="form-checkout__identificationType"
              className="h-12 rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
            />

            <input
              type="text"
              id="form-checkout__identificationNumber"
              placeholder="Número de DNI"
              className="h-12 rounded-2xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        <div className="hidden">
          <select id="form-checkout__issuer" />
          <select id="form-checkout__installments" />
        </div>

        <button
          type="submit"
          disabled={loading || paying}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {paying ? "Procesando pago..." : "Pagar"}
        </button>
      </form>

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}
    </div>
  );
}