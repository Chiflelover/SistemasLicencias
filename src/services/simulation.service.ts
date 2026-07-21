import { prisma } from "@/lib/db/prisma";

/**
 * Simulación de tiempo para la demostración académica.
 *
 * Mientras hay una corrida abierta, el middleware de Prisma anota cada
 * escritura en SimulationChange. Ese registro quedó como bitácora para el
 * panel de desarrollo: ya no se usa para deshacer nada, porque el restablecer
 * borra los datos de la demostración en vez de revertirlos.
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

  // restoreAndArchive y su ayudante prepararDatos se eliminaron. Deshacían
  // cambio por cambio contra Neon —lento y frágil con binarios y dependencias
  // rotas— y solo alcanzaban a lo ocurrido con una corrida abierta: quien
  // probaba el sistema sin adelantar el reloj no dejaba nada anotado y el
  // restablecer no limpiaba nada. Hoy el restablecer borra los datos de la
  // demostración (DemoResetService) en vez de revertirlos.

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
