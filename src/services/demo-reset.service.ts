import { prisma } from "@/lib/db/prisma";
import { AuditService } from "@/services/audit.service";
import { Role } from "@prisma/client";

/**
 * Devuelve el sistema al estado inicial de una demostración.
 *
 * Borra todos los datos de negocio y deja en pie lo que hace falta para volver
 * a empezar: las cuentas del personal y los cachés de RUC, DNI y
 * establecimientos anexos. Los cachés se conservan a propósito — no guardan
 * nada de trámites y evitan gastar cuota de APIPERU en cada RUC que ya se
 * consultó alguna vez.
 *
 * No es lo mismo que deshacer una simulación. El registro de `SimulationChange`
 * solo anota lo que pasó *mientras* había una corrida abierta, y una corrida se
 * abre únicamente al adelantar el reloj: si alguien prueba el sistema sin tocar
 * el DevPanel, no queda nada anotado y no habría nada que revertir. Por eso el
 * restablecer borra en lugar de revertir.
 */
export class DemoResetService {
  static async resetDemoData(adminId?: string) {
    // Primero las corridas: mientras haya una RUNNING, el middleware de
    // `prisma.ts` anota cada borrado de este método en SimulationChange —
    // cientos de filas que después se van igual con la corrida. Sacarlas de
    // entrada apaga el registro y el borrado sale mucho más barato.
    const corridas = (await prisma.simulationRun.deleteMany()).count;

    // De adentro hacia afuera: License→Application, Application→Business y
    // Application→applicant son onDelete: Restrict, así que borrar al revés lo
    // rechaza la base. Documentos, pagos e inspecciones cuelgan del trámite en
    // Cascade y se van solos; los movimientos, del turno de caja.
    const multas = (await prisma.fine.deleteMany()).count;
    const licencias = (await prisma.license.deleteMany()).count;
    const tramites = (await prisma.application.deleteMany()).count;
    const negocios = (await prisma.business.deleteMany()).count;
    const notificaciones = (await prisma.notification.deleteMany()).count;

    const solicitantes = (
      await prisma.user.deleteMany({ where: { role: Role.APPLICANT } })
    ).count;

    const turnosDeCaja = (await prisma.cashSession.deleteMany()).count;
    const auditoria = (await prisma.auditLog.deleteMany()).count;

    // El reloj vuelve a la hora real. Tiene que ser un borrado y no un
    // `simulatedDate: null`: la columna es NOT NULL, así que la única forma de
    // decir "no hay simulación" es que la fila no exista — es lo que mira
    // `getCurrentSystemDate`.
    await prisma.systemConfig.deleteMany();

    // Y la tarifa vuelve a la de fábrica, por el mismo camino: sin fila rige
    // DEFAULT_TUPA_AMOUNT.
    await prisma.tarifa.deleteMany();

    // Lo mismo con la UIT, de la que salen los montos de las multas: sin fila
    // rige DEFAULT_UIT.
    await prisma.uit.deleteMany();

    const borrados = {
      tramites,
      licencias,
      negocios,
      solicitantes,
      turnosDeCaja,
      notificaciones,
      multas,
      auditoria,
      corridas,
    };

    // Se registra después de vaciar la auditoría, así queda como el primer
    // asiento del sistema recién restablecido.
    await AuditService.log({
      action: "DEMO_RESTABLECIDA",
      entityType: "System",
      entityId: "demo",
      userId: adminId,
      details: borrados,
    });

    return borrados;
  }
}
