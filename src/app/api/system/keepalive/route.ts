import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

// Sin esto Next puede resolver la ruta en el build y servirla estática: nunca
// llegaría a la base, que es exactamente lo que este endpoint necesita hacer.
export const dynamic = "force-dynamic";

/**
 * Latido para que Neon no suspenda el cómputo mientras alguien usa el sistema.
 *
 * El plan gratuito suspende a los 5 minutos de inactividad y el plazo no es
 * configurable; la primera consulta posterior falla con `P1017` / `kind:
 * Closed`. La consulta es la más barata posible —no toca ninguna tabla— y al
 * ser lectura no la anota el middleware de simulación, así que no ensucia una
 * corrida en curso.
 *
 * El costo no es gratis: el plan gratuito da 100 CU-horas por mes y al
 * agotarlas el proyecto queda suspendido hasta el mes siguiente. Por eso el
 * cliente (`KeepAlive`) solo late con la pestaña visible y con interacción
 * reciente.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    // La base pudo estar despertando: el intento igual la sacó de suspensión.
    // Se informa el fallo, pero el cliente lo ignora a propósito.
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
