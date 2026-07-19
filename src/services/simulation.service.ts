import { prisma } from "@/lib/db/prisma";

/**
 * Simulación de tiempo para la demostración académica.
 *
 * Mientras hay una corrida abierta, el middleware de Prisma anota cada
 * escritura en SimulationChange. Al restablecer el reloj, esos cambios se
 * deshacen en orden inverso y la corrida queda archivada como historial.
 */
export class SimulationService {
  /** Corrida abierta, si la hay. */
  static async getRunningSimulation() {
    return prisma.simulationRun.findFirst({
      where: { status: "RUNNING" },
      include: { _count: { select: { changes: true } } },
    });
  }

  /**
   * Abre una corrida si todavía no hay ninguna.
   *
   * Se llama al adelantar el reloj: a partir de ahí todo queda anotado.
   */
  static async startIfNeeded(params: {
    simulatedDate: Date;
    startedByEmail?: string | null;
  }) {
    const existente = await this.getRunningSimulation();
    if (existente) {
      return existente;
    }

    return prisma.simulationRun.create({
      data: {
        simulatedStartAt: params.simulatedDate,
        startedByEmail: params.startedByEmail ?? null,
      },
    });
  }

  /**
   * Deshace los cambios de la corrida abierta y la archiva.
   *
   * Los cambios se revierten del más reciente al más antiguo para respetar
   * las dependencias: lo último que se creó es lo primero que se borra.
   */
  static async restoreAndArchive(params: { simulatedEndAt: Date }) {
    const corrida = await this.getRunningSimulation();

    if (!corrida) {
      return { restored: false, revertidos: 0, fallidos: 0 };
    }

    const cambios = await prisma.simulationChange.findMany({
      where: { runId: corrida.id },
      orderBy: { createdAt: "desc" },
    });

    let revertidos = 0;
    let fallidos = 0;

    for (const cambio of cambios) {
      const delegado = (prisma as any)[
        cambio.model.charAt(0).toLowerCase() + cambio.model.slice(1)
      ];

      if (!delegado) {
        fallidos++;
        continue;
      }

      try {
        if (cambio.operation === "CREATE") {
          if (cambio.recordId) {
            await delegado.deleteMany({ where: { id: cambio.recordId } });
            revertidos++;
          } else {
            fallidos++;
          }
          continue;
        }

        // UPDATE y DELETE: se devuelve la fila a su estado previo.
        const previos = Array.isArray(cambio.before) ? cambio.before : [];

        for (const fila of previos as Array<Record<string, any>>) {
          if (!fila?.id) continue;

          const datos = this.prepararDatos(cambio.model, fila);

          await delegado.upsert({
            where: { id: fila.id },
            update: datos,
            create: { id: fila.id, ...datos },
          });
          revertidos++;
        }
      } catch (error) {
        // Una fila que ya no existe, o una dependencia rota, no debe frenar
        // el resto de la reversión.
        fallidos++;
      }
    }

    await prisma.simulationRun.update({
      where: { id: corrida.id },
      data: {
        status: "RESTORED",
        simulatedEndAt: params.simulatedEndAt,
        restoredAt: new Date(),
      },
    });

    return { restored: true, revertidos, fallidos, runId: corrida.id };
  }

  /**
   * Reconstruye los tipos que el registro guardó como texto.
   *
   * El anotador serializa fechas a ISO y omite binarios; acá se revierte lo
   * que se puede y se descartan los campos irrecuperables.
   */
  private static prepararDatos(model: string, fila: Record<string, any>) {
    const datos: Record<string, any> = {};

    for (const [clave, valor] of Object.entries(fila)) {
      if (clave === "id") continue;

      // Los binarios no se guardan en el registro: se dejan como estaban.
      if (typeof valor === "string" && valor.startsWith("<binario ")) {
        continue;
      }

      if (
        typeof valor === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(valor)
      ) {
        datos[clave] = new Date(valor);
        continue;
      }

      datos[clave] = valor;
    }

    return datos;
  }

  /** Historial de simulaciones, para el panel de desarrollo. */
  static async listHistory(limit = 20) {
    return prisma.simulationRun.findMany({
      include: { _count: { select: { changes: true } } },
      orderBy: { realStartedAt: "desc" },
      take: limit,
    });
  }

  /** Detalle de los cambios de una corrida. */
  static async getRunChanges(runId: string) {
    const corrida = await prisma.simulationRun.findUnique({
      where: { id: runId },
    });

    if (!corrida) {
      return null;
    }

    const cambios = await prisma.simulationChange.findMany({
      where: { runId },
      orderBy: { createdAt: "asc" },
    });

    // Resumen por modelo y operación, para leerlo de un vistazo.
    const resumen: Record<string, { CREATE: number; UPDATE: number; DELETE: number }> = {};

    for (const c of cambios) {
      resumen[c.model] ??= { CREATE: 0, UPDATE: 0, DELETE: 0 };
      resumen[c.model][c.operation]++;
    }

    return { corrida, cambios, resumen };
  }
}
