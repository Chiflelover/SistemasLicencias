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
    const method = String(body.method || "").trim().toUpperCase();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Falta el identificador del trámite." },
        { status: 400 }
      );
    }

    if (!isPaymentMethod(method)) {
      return NextResponse.json(
        { error: "Selecciona un método de pago válido: Efectivo, Tarjeta, Yape o Plin." },
        { status: 400 }
      );
    }

    const { payment, operationNumber, paidAt } =
      await CashService.registerCounterPayment({
        cashierId: user.id,
        applicationId,
        method,
      });

    return NextResponse.json({
      success: true,
      message: "Pago registrado en caja correctamente.",
      payment: {
        id: payment.id,
        operationNumber,
        amount: Number(payment.amount),
        method: payment.method,
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
