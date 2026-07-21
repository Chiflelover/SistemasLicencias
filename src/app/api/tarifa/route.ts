import { NextResponse } from "next/server";
import { getTupaAmount } from "@/lib/tarifa";

export const dynamic = "force-dynamic";

/**
 * Tarifa vigente del derecho de trámite.
 *
 * Sin sesión: el monto ya está publicado en la portada y en la pantalla de
 * pago del ciudadano, así que no hay nada que reservar. Lo consumen las
 * pantallas que corren en el navegador y no pueden leer la base directo.
 */
export async function GET() {
  return NextResponse.json({ amount: await getTupaAmount() });
}
