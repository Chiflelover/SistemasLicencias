import { NextResponse } from "next/server";
import {
  advanceSystemDateByDays,
  advanceSystemDateByYears,
  getCurrentSystemDate,
  resetSystemDate,
} from "@/lib/date";
import { LicenseService } from "@/services/license.service";
import { SimulationService } from "@/services/simulation.service";
import { getCurrentUser } from "@/lib/auth";

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
  });
}

/**
 * Devuelve el reloj a la fecha real y recalcula los estados que dependen de
 * ella, para que el sistema quede como si nunca se hubiera simulado nada.
 */
export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "El simulador de fechas no está disponible en producción." },
      { status: 403 }
    );
  }

  try {
    const simulatedEndAt = await getCurrentSystemDate();

    // Primero se deshacen los cambios anotados durante la simulación, y
    // recién después se mueve el reloj: así la reversión ocurre con la misma
    // fecha con la que se hicieron.
    const reversion = await SimulationService.restoreAndArchive({
      simulatedEndAt,
    });

    const restored = await resetSystemDate();

    // Con el reloj de vuelta en el presente, las licencias que se habían
    // vencido durante la demostración recuperan su estado real.
    await LicenseService.resyncAllLicenseStates();

    return NextResponse.json({
      currentSystemDate: restored.toISOString(),
      realDate: restored.toISOString(),
      offsetDays: 0,
      simulacion: reversion,
      message: reversion.restored
        ? `Fecha restablecida. Se revirtieron ${reversion.revertidos} cambio(s) de la simulación.`
        : "Fecha restablecida. No había simulación en curso.",
    });
  } catch (error) {
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
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "El simulador de fechas no está disponible en producción." },
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
