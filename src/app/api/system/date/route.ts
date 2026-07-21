import { NextResponse } from "next/server";
import {
  advanceSystemDateByDays,
  advanceSystemDateByYears,
  clearSimulatedDate,
  getCurrentSystemDate,
} from "@/lib/date";
import { SimulationService } from "@/services/simulation.service";
import { getCurrentUser } from "@/lib/auth";
import {
  isTimeSimulatorEnabled,
  PERSONAL_CON_SIMULADOR,
} from "@/lib/simulator";

export async function GET() {
  const current = await getCurrentSystemDate();
  const real = new Date();

  // El desfase permite avisar en pantalla cuando el reloj está desplazado.
  const offsetDays = Math.round(
    (current.getTime() - real.getTime()) / (1000 * 60 * 60 * 24)
  );

  return NextResponse.json({
    currentSystemDate: current.toISOString(),
    realDate: real.toISOString(),
    offsetDays,
    // El panel se oculta solo cuando el simulador está apagado.
    enabled: isTimeSimulatorEnabled(),
  });
}

/**
 * Devuelve el reloj a la hora real. **No toca ningún dato.**
 *
 * Es lo que se usa durante una demostración: los trámites, licencias, pagos e
 * inspecciones quedan donde están y solo se recalcula lo que depende de la
 * fecha (una licencia marcada vencida vuelve a estar vigente, por ejemplo).
 *
 * Para vaciar la base está `DELETE /api/system/demo`, que es otra cosa.
 */
export async function DELETE() {
  if (!isTimeSimulatorEnabled()) {
    return NextResponse.json(
      { error: "El simulador de fechas está deshabilitado en esta instalación." },
      { status: 403 }
    );
  }

  const user = await getCurrentUser();

  if (!user || !PERSONAL_CON_SIMULADOR.includes(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const real = await clearSimulatedDate();

    return NextResponse.json({
      currentSystemDate: real.toISOString(),
      realDate: real.toISOString(),
      offsetDays: 0,
      message: "El reloj volvió a la fecha real. No se borró ningún dato.",
    });
  } catch (error) {
    console.error("Error devolviendo el reloj a la fecha real:", error);

    return NextResponse.json(
      { error: "No se pudo restablecer la fecha del sistema." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // El simulador es una herramienta de desarrollo. En producción la fecha
  // real manda igual, pero se bloquea la escritura para que nadie altere
  // SystemConfig desde afuera.
  if (!isTimeSimulatorEnabled()) {
    return NextResponse.json(
      { error: "El simulador de fechas está deshabilitado en esta instalación." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { unit, amount } = body as { unit?: string; amount?: number };
  if (!unit || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Se requiere unit y amount válidos." }, { status: 400 });
  }

  try {
    // Abre la corrida antes de mover el reloj: desde acá, cada escritura
    // queda anotada para poder deshacerla al restablecer.
    const user = await getCurrentUser();
    await SimulationService.startIfNeeded({
      simulatedDate: await getCurrentSystemDate(),
      startedByEmail: user?.email ?? null,
    });

    let newDate: Date;
    if (unit === "days") {
      newDate = await advanceSystemDateByDays(amount);
    } else if (unit === "years") {
      newDate = await advanceSystemDateByYears(amount);
    } else {
      return NextResponse.json({ error: "Unidad no soportada." }, { status: 400 });
    }

    return NextResponse.json({ currentSystemDate: newDate.toISOString() });
  } catch (error) {
    return NextResponse.json({ error: "No se pudo avanzar la fecha del sistema." }, { status: 500 });
  }
}
