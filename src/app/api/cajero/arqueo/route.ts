import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CashService } from "@/services/cash.service";
import { getCurrentSystemDate } from "@/lib/date";

export const dynamic = "force-dynamic";

/**
 * Arqueo de caja del cajero autenticado.
 *
 * Sin parámetros toma el día en curso según la fecha del sistema; acepta
 * ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD para cerrar otros períodos.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "CAJERO") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");

    const systemDate = await getCurrentSystemDate();

    const from = desde ? new Date(`${desde}T00:00:00`) : new Date(systemDate);
    const to = hasta ? new Date(`${hasta}T23:59:59.999`) : new Date(systemDate);

    if (!desde) from.setHours(0, 0, 0, 0);
    if (!hasta) to.setHours(23, 59, 59, 999);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Las fechas del arqueo no son válidas." },
        { status: 400 }
      );
    }

    const arqueo = await CashService.getCashReconciliation({
      cashierId: user.id,
      from,
      to,
    });

    return NextResponse.json({ success: true, arqueo });
  } catch (error: any) {
    console.error("Error generando el arqueo de caja:", error);

    return NextResponse.json(
      { error: error?.message || "Error interno al generar el arqueo." },
      { status: 500 }
    );
  }
}
