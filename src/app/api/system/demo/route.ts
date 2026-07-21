import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  isTimeSimulatorEnabled,
  PERSONAL_CON_SIMULADOR,
} from "@/lib/simulator";
import { DemoResetService } from "@/services/demo-reset.service";

export const dynamic = "force-dynamic";

/**
 * Vacía la demostración: borra todos los datos de negocio y devuelve el reloj
 * a la hora real, para que el sistema quede como recién instalado.
 *
 * Es distinto de `DELETE /api/system/date`, que solo mueve el reloj y no toca
 * ningún dato. Este se usa **entre** demostraciones; aquel, **durante**.
 *
 * Exige sesión del personal: es irreversible y el endpoint no puede quedar
 * abierto solo porque el simulador esté encendido.
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
    const borrados = await DemoResetService.resetDemoData(user.id);
    const real = new Date();

    return NextResponse.json({
      currentSystemDate: real.toISOString(),
      realDate: real.toISOString(),
      offsetDays: 0,
      borrados,
      message:
        `Sistema vaciado. Se borraron ${borrados.tramites} trámite(s), ` +
        `${borrados.licencias} licencia(s) y ${borrados.turnosDeCaja} turno(s) de caja. ` +
        "El reloj volvió a la hora real.",
    });
  } catch (error) {
    console.error("Error vaciando la demostración:", error);

    return NextResponse.json(
      { error: "No se pudo vaciar el sistema." },
      { status: 500 }
    );
  }
}
