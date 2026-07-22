import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AuditService } from "@/services/audit.service";
import {
  GRAVEDADES,
  getUit,
  setUit,
  DEFAULT_UIT,
  MIN_UIT,
  MAX_UIT,
} from "@/lib/uit";

export const dynamic = "force-dynamic";

/** UIT vigente, sus límites y la escala de multas, para el administrador. */
export async function GET() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const uit = await getUit();

  return NextResponse.json({
    amount: uit,
    porDefecto: DEFAULT_UIT,
    minimo: MIN_UIT,
    maximo: MAX_UIT,
    gravedades: GRAVEDADES.map((g) => ({
      nombre: g.nombre,
      porcentaje: g.porcentaje,
      monto: Math.round(uit * g.porcentaje) / 100,
    })),
  });
}

/**
 * El administrador cambia el valor de la UIT.
 *
 * Cambia por decreto cada enero. Las multas ya registradas **no se tocan**:
 * `Fine.amount` guarda soles, no un múltiplo, así que una multa vieja conserva
 * el importe que tenía cuando se puso — que es como funciona en la realidad.
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const anterior = await getUit();
    const vigente = await setUit(Number(body.amount));

    await AuditService.log({
      action: "UIT_ACTUALIZADA",
      entityType: "Uit",
      entityId: "singleton",
      userId: user.id,
      details: { anterior, vigente },
    });

    return NextResponse.json({
      success: true,
      amount: vigente,
      message: `La UIT quedó en S/ ${vigente.toFixed(2)}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "No se pudo cambiar la UIT." },
      { status: 400 }
    );
  }
}
