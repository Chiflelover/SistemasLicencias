"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    MercadoPago?: any;
    cardPaymentBrickController?: any;
  }
}

interface MercadoPagoCardBrickProps {
  applicationId: string;
  payerEmail: string;
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

export default function MercadoPagoCardBrick({
  applicationId,
  payerEmail,
}: MercadoPagoCardBrickProps) {
  const router = useRouter();
  const containerId = "cardPaymentBrick_container";

  const brickMounted = useRef(false);

  const [loading, setLoading] = useState(true);
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

    async function renderBrick() {
      try {
        setLoading(true);
        setErrorMessage(null);
        setSuccessMessage(null);

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

        const container = document.getElementById(containerId);

        if (!container) {
          throw new Error("No se encontró el contenedor del formulario.");
        }

        container.innerHTML = "";

        if (window.cardPaymentBrickController) {
          try {
            await window.cardPaymentBrickController.unmount();
          } catch {
            // No hacer nada si ya estaba desmontado.
          }
        }

        const mp = new window.MercadoPago(publicKey, {
          locale: "es-PE",
        });

        const bricksBuilder = mp.bricks();

        const settings = {
          initialization: {
            amount: 2,
            payer: {
              email: payerEmail || "comprador@test.com",
            },
          },
          customization: {
            visual: {
              style: {
                theme: "default",
              },
            },
            paymentMethods: {
              maxInstallments: 1,
            },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) {
                setLoading(false);
              }
            },
            onSubmit: (cardFormData: any) => {
              setErrorMessage(null);
              setSuccessMessage(null);

              return new Promise<void>(async (resolve, reject) => {
                try {
                  const response = await fetch(
                    `/api/public/tramite/${applicationId}/pago/card`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        ...cardFormData,
                        applicationId,
                        transaction_amount: 2,
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
                    "Pago aprobado correctamente. Tu inspección ha sido programada."
                  );

                  resolve();

                  setTimeout(() => {
                    router.refresh();
                    router.push(`/tramite/${applicationId}/inspecciones`);
                  }, 1500);
                } catch (error) {
                  setErrorMessage((error as Error).message);
                  reject(error);
                }
              });
            },
            onError: (error: any) => {
              console.error("Error Mercado Pago Brick:", error);

              setLoading(false);
              setErrorMessage(
                "No se pudo cargar el formulario de tarjeta. Revisa que la Public Key sea correcta y que hayas reiniciado npm run dev."
              );
            },
          },
        };

        window.cardPaymentBrickController = await bricksBuilder.create(
          "cardPayment",
          containerId,
          settings
        );

        brickMounted.current = true;

        setTimeout(() => {
          const containerAfterLoad = document.getElementById(containerId);

          if (
            containerAfterLoad &&
            containerAfterLoad.innerHTML.trim().length === 0 &&
            !cancelled
          ) {
            setLoading(false);
            setErrorMessage(
              "Mercado Pago no renderizó el formulario. Revisa tu Public Key real en .env y reinicia el servidor."
            );
          }
        }, 8000);
      } catch (error) {
        console.error("Error cargando Mercado Pago:", error);

        setLoading(false);
        setErrorMessage((error as Error).message);
      }
    }

    renderBrick();

    return () => {
      cancelled = true;

      if (brickMounted.current && window.cardPaymentBrickController) {
        try {
          window.cardPaymentBrickController.unmount();
        } catch {
          // No hacer nada.
        }
      }
    };
  }, [applicationId, payerEmail, router]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-white p-5 text-slate-950">
      <h3 className="mb-2 text-lg font-bold">Pago con Visa / Mastercard</h3>

      <p className="mb-4 text-sm text-slate-600">
        Ingresa los datos de tu tarjeta. Mercado Pago procesará el pago de forma
        segura por S/ 2.00.
      </p>

      {loading && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Cargando formulario de tarjeta...
        </div>
      )}

      <div id={containerId} className="min-h-[520px]" />

      {errorMessage && (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}
    </div>
  );
}