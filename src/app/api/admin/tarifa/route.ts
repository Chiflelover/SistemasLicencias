import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "@/services/audit.service";
import {
  getTupaAmount,
  setTupaAmount,
  DEFAULT_TUPA_AMOUNT,
  MIN_TUPA_AMOUNT,
  MAX_TUPA_AMOUNT,
} from "@/lib/tarifa";

export const dynamic = "force-dynamic";

/** Tarifa vigente y sus límites, para el formulario del administrador. */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json({
    amount: await getTupaAmount(),
    porDefecto: DEFAULT_TUPA_AMOUNT,
    minimo: MIN_TUPA_AMOUNT,
    maximo: MAX_TUPA_AMOUNT,
  });
}

/** El administrador cambia la tarifa del derecho de trámite. */
export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const anterior = await getTupaAmount();
    const vigente = await setTupaAmount(Number(body.amount));

    await AuditService.log({
      action: "TARIFA_ACTUALIZADA",
      entityType: "Tarifa",
      entityId: "singleton",
      userId: user.id,
      details: { anterior, vigente },
    });

    return NextResponse.json({
      success: true,
      amount: vigente,
      message: `La tarifa del trámite quedó en S/ ${vigente.toFixed(2)}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo cambiar la tarifa." },
      { status: 400 }
    );
  }
}
