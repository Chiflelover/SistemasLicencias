import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CashService, isPaymentMethod } from "@/services/cash.service";

export const dynamic = "force-dynamic";

/**
 * Registra un pago recibido en ventanilla.
 *
 * Sin pasarelas ni servicios externos: el cajero declara el cobro y el sistema
 * lo asienta, cambia el estado del trámite y deja la traza de auditoría.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const applicationId = String(body.applicationId || "").trim();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Falta el identificador del trámite." },
        { status: 400 }
      );
    }

    // Formas de pago: una (pago simple) o dos (pago mixto). Compat: si llega
    // el viejo `method`, se arma una única forma por la tasa completa.
    const TUPA = 180.0;
    const formasCrudas = Array.isArray(body.formasPago)
      ? body.formasPago
      : [{ method: body.method, amount: TUPA }];

    const formasPago = [] as Array<{ method: any; amount: number }>;

    for (const forma of formasCrudas) {
      const method = String(forma?.method || "").trim().toUpperCase();

      if (!isPaymentMethod(method)) {
        return NextResponse.json(
          { error: "Selecciona un método de pago válido: Efectivo, Tarjeta, Yape o Plin." },
          { status: 400 }
        );
      }

      formasPago.push({ method, amount: Number(forma?.amount) });
    }

    // Solo se usa en un pago único en efectivo; el servicio lo ignora si no.
    const receivedAmount =
      body.receivedAmount === undefined || body.receivedAmount === null
        ? undefined
        : Number(body.receivedAmount);

    const receiptType = String(body.receiptType || "FACTURA")
      .trim()
      .toUpperCase();

    if (receiptType !== "FACTURA" && receiptType !== "BOLETA") {
      return NextResponse.json(
        { error: "El comprobante debe ser Boleta o Factura." },
        { status: 400 }
      );
    }

    const { payment, pagos, operationNumber, paidAt } =
      await CashService.registerCounterPayment({
        cashierId: user.id,
        applicationId,
        formasPago,
        receivedAmount,
        receiptType,
      });

    const total = pagos.reduce((suma, p) => suma + Number(p.amount), 0);

    return NextResponse.json({
      success: true,
      message: "Pago registrado en caja correctamente.",
      payment: {
        // El id del primer pago; el comprobante agrupa la operación completa.
        id: payment.id,
        operationNumber,
        total,
        // Una o dos formas de pago (pago mixto).
        formasPago: pagos.map((p) => ({
          method: p.method,
          amount: Number(p.amount),
        })),
        receiptType: payment.receiptType,
        receivedAmount:
          payment.receivedAmount === null ? null : Number(payment.receivedAmount),
        changeGiven:
          payment.changeGiven === null ? null : Number(payment.changeGiven),
        paidAt,
      },
    });
  } catch (error: any) {
    console.error("Error registrando pago presencial:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al registrar el pago." },
      { status: 400 }
    );
  }
}
