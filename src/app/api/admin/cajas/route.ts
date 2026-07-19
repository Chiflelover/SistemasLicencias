import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AdminService } from "@/services/admin.service";

export const dynamic = "force-dynamic";

/**
 * Recaudación por caja.
 *
 * Sin parámetros devuelve el histórico completo; acepta
 * ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD para acotar el período.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const desde = url.searchParams.get("desde");
    const hasta = url.searchParams.get("hasta");

    let rango: { from: Date; to: Date } | undefined;

    if (desde && hasta) {
      const from = new Date(`${desde}T00:00:00`);
      const to = new Date(`${hasta}T23:59:59.999`);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return NextResponse.json(
          { error: "Las fechas no son válidas." },
          { status: 400 }
        );
      }

      rango = { from, to };
    }

    const resumen = await AdminService.getRevenueByCashRegister(rango);

    return NextResponse.json({ success: true, ...resumen });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error al calcular la recaudación." },
      { status: 500 }
    );
  }
}
