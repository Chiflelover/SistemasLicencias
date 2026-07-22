import { NextResponse } from "next/server";
import { GRAVEDADES, getUit } from "@/lib/uit";

export const dynamic = "force-dynamic";

/**
 * UIT vigente y la escala de multas que sale de ella.
 *
 * Devuelve los montos ya calculados para que las pantallas del inspector no
 * repitan la cuenta: el servidor es el único que multiplica. Sin sesión, con el
 * mismo criterio que `/api/tarifa` — la UIT es un valor público fijado por
 * decreto y no reserva nada.
 */
export async function GET() {
  const uit = await getUit();

  return NextResponse.json({
    uit,
    gravedades: GRAVEDADES.map((g) => ({
      clave: g.clave,
      nombre: g.nombre,
      porcentaje: g.porcentaje,
      monto: Math.round(uit * g.porcentaje) / 100,
    })),
  });
}
