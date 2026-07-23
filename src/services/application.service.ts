import { ApplicationRepository } from "@/repositories/application.repository";
import { BusinessService } from "@/services/business.service";
import { getCurrentSystemDate } from "@/lib/date";
import { prisma } from "@/lib/db/prisma";
import { Application, ApplicationStatus, Business, Role } from "@prisma/client";

/**
 * Estados en los que un trámite sigue vivo y hay que retomarlo en vez de crear
 * otro.
 *
 * Ojo con la diferencia respecto de `BLOCKING_STATUSES`: acá **sí** está
 * `DRAFT`, porque un borrador es un trámite que se reanuda. Lo que no hace es
 * bloquear el RUC.
 */
export const OPEN_APPLICATION_STATUSES = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.DOCUMENTS_COMPLETE,
  ApplicationStatus.PENDING_PAYMENT,
  ApplicationStatus.PAYMENT_COMPLETED,
  ApplicationStatus.INSPECTION_SCHEDULED,
  ApplicationStatus.FIRST_INSPECTION_REJECTED,
  ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
];

/**
 * Estados en los que el negocio ya tramitó su licencia y no corresponde
 * iniciar otro trámite.
 *
 * `EXPIRED` está incluido a propósito: una licencia vencida **se renueva en
 * ventanilla**, no se reemplaza por un trámite nuevo. Antes el vencimiento
 * liberaba el RUC; ahora lo mantiene tomado, porque si no habría dos caminos
 * válidos para el mismo negocio. El rechazo definitivo sí libera: ahí no hay
 * licencia que renovar.
 */
const LICENSED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.LICENSE_ISSUED,
  ApplicationStatus.RENEWAL_AVAILABLE,
  ApplicationStatus.EXPIRED,
];

/**
 * Estados que impiden empezar un trámite nuevo con ese RUC.
 *
 * Es `OPEN_APPLICATION_STATUSES` **menos `DRAFT`**, y esa resta es el punto.
 * Un borrador está vacío: no tiene documentos, ni pago, ni inspección. Lo único
 * que guarda es el correo y el DNI de quien lo creó, así que si alguien se
 * equivoca de RUC —o abandona a medio camino— el trámite queda tomando un RUC
 * ajeno para siempre: no había ninguna pantalla que lo borrara.
 *
 * Con el borrador fuera de esta lista, el que llegue después lo reutiliza y lo
 * pisa con sus propios datos: `findOpenApplication` lo sigue encontrando —por
 * eso la constante de arriba no se toca— y tanto el flujo público como el
 * presencial actualizan correo, DNI y rubro al retomarlo. En cuanto sube el
 * primer par de documentos el trámite deja de ser borrador y el RUC vuelve a
 * quedar tomado.
 */
const BLOCKING_STATUSES: ApplicationStatus[] = [
  ...OPEN_APPLICATION_STATUSES.filter(
    (status) => status !== ApplicationStatus.DRAFT
  ),
  ...LICENSED_STATUSES,
];

export class ApplicationService {
  /** Traduce el estado de un trámite bloqueante al motivo que ve el ciudadano. */
  private static motivoBloqueo(status: ApplicationStatus) {
    return status === ApplicationStatus.EXPIRED
      ? ("LICENCIA_VENCIDA" as const)
      : LICENSED_STATUSES.includes(status)
        ? ("YA_TIENE_LICENCIA" as const)
        : ("EN_PROCESO" as const);
  }

  /**
   * Busca un trámite que impida iniciar otro **para ese local**.
   *
   * El bloqueo es por (RUC + establecimiento), no por RUC: un mismo RUC puede
   * tener varias licencias, una por local (Ley 28976). Lo que no se puede es
   * tener dos trámites vivos para el **mismo** local. Devuelve null si ese local
   * está libre —o si nunca tramitó, o si su último trámite ahí terminó rechazado
   * en firme o quedó en borrador (ver `BLOCKING_STATUSES`)—.
   */
  static async findBlockingApplication(
    ruc: string,
    establishmentAddress: string
  ) {
    const application = await prisma.application.findFirst({
      where: {
        business: { ruc },
        establishmentAddress,
        status: { in: BLOCKING_STATUSES },
      },
      select: {
        id: true,
        number: true,
        status: true,
        establishmentAddress: true,
        createdAt: true,
        business: { select: { legalName: true, ruc: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!application) {
      return null;
    }

    return { ...application, motivo: this.motivoBloqueo(application.status) };
  }

  /**
   * Locales del RUC que están tomados (con trámite vivo o licencia).
   *
   * Lo usa la consulta del RUC para avisar en la pantalla, antes de enviar, si
   * el local que el ciudadano eligió ya tiene trámite. El bloqueo real lo hace
   * `findBlockingApplication` en el servidor.
   */
  static async listBlockingByRuc(ruc: string) {
    const applications = await prisma.application.findMany({
      where: {
        business: { ruc },
        status: { in: BLOCKING_STATUSES },
      },
      select: {
        id: true,
        number: true,
        status: true,
        establishmentAddress: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return applications.map((app) => ({
      ...app,
      motivo: this.motivoBloqueo(app.status),
    }));
  }

  /**
   * Trámite vigente de ese solicitante y negocio **para ese local**, si lo hay.
   *
   * Se acota por establecimiento: un borrador del local A no se reutiliza cuando
   * se está iniciando el trámite del local B; ahí corresponde uno nuevo.
   */
  private static async findOpenApplication(
    applicantId: string,
    businessId: string,
    establishmentAddress: string
  ) {
    return prisma.application.findFirst({
      where: {
        applicantId,
        businessId,
        // Este local, o un trámite que todavía no eligió local (borrador
        // legacy / anterior a la migración): ese se adopta para el local que se
        // esté iniciando. Al adoptarlo se le fija el local.
        OR: [{ establishmentAddress }, { establishmentAddress: null }],
        status: { in: OPEN_APPLICATION_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Trámite vigente de ese negocio **para ese local**, sea de quien sea la fila
   * del solicitante.
   *
   * La ventanilla necesita mirar por negocio y no por solicitante: el trámite
   * que empezó por la web quedó a nombre del usuario sintético
   * (`tramite-{ruc}@municipalidad.local`), mientras que acá el solicitante se
   * busca por el correo que tipea el cajero. Con la versión por solicitante no lo
   * encontraría y abriría un **segundo** trámite para el mismo local. Se acota
   * por establecimiento por lo mismo que arriba.
   */
  private static async findOpenApplicationByBusiness(
    businessId: string,
    establishmentAddress: string
  ) {
    return prisma.application.findFirst({
      where: {
        businessId,
        // Igual que arriba: este local o el trámite sin local aún elegido.
        OR: [{ establishmentAddress }, { establishmentAddress: null }],
        status: { in: OPEN_APPLICATION_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // startNewApplication se eliminó con el área /solicitante: era el alta desde
  // una cuenta propia del administrado, que ya no existe. Quedan los dos
  // caminos reales: startPublicApplication y registerInPersonApplication.

  static async startPublicApplication(params: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    // Local para el que se pide la licencia. La ruta lo resuelve contra los
    // anexos del RUC; si no se eligió ninguno, es el domicilio fiscal.
    commercialAddress?: string;
    // Igual que el anterior pero **siempre concreto** (el domicilio fiscal si no
    // se eligió anexo): es la llave del local, va en el trámite y decide el
    // bloqueo y el reuso.
    establishmentAddress: string;
    activityType?: string;
    contactEmail?: string;
    representativeDni?: string;
    // Resuelto contra el padrón en la ruta, no declarado por el ciudadano: va
    // impreso en la licencia como titular.
    representativeName?: string;
  }): Promise<{ application: Application; business: Business }> {
    const now = await getCurrentSystemDate();

    const business = await BusinessService.findOrCreateBusiness({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
      commercialAddress: params.commercialAddress,
      activityType: params.activityType,
      representativeDni: params.representativeDni,
      representativeName: params.representativeName,
    });

    const applicant = await prisma.user.upsert({
      where: {
        email: `tramite-${params.ruc}@municipalidad.local`,
      },
      update: {
        fullName: `Solicitante RUC ${params.ruc}`,
        active: true,
      },
      create: {
        email: `tramite-${params.ruc}@municipalidad.local`,
        passwordHash: `public-flow-disabled-${params.ruc}`,
        fullName: `Solicitante RUC ${params.ruc}`,
        dni: "00000000",
        phone: "000000000",
        role: Role.APPLICANT,
        active: true,
      },
    });

    const existingApplication = await ApplicationService.findOpenApplication(
      applicant.id,
      business.id,
      params.establishmentAddress
    );

    if (existingApplication) {
      // Se retoma. Se fija el local (reclama el borrador adoptado, que pudo venir
      // sin local elegido) y, si cambió el correo, se actualiza: es el dato con
      // el que se le va a avisar.
      const tracked = await prisma.application.update({
        where: { id: existingApplication.id },
        data: {
          establishmentAddress: params.establishmentAddress,
          ...(params.contactEmail ? { contactEmail: params.contactEmail } : {}),
        },
      });

      return { application: tracked, business };
    }

    const applicationNumber = await ApplicationRepository.generateNumber();

    const application = await prisma.application.create({
      data: {
        number: applicationNumber,
        applicantId: applicant.id,
        businessId: business.id,
        contactEmail: params.contactEmail ?? null,
        establishmentAddress: params.establishmentAddress,
        createdAt: now,
      },
    });

    return { application, business };
  }

  // startCashierApplication se eliminó: era una versión reducida del alta en
  // ventanilla que nunca tuvo llamadores. El registro presencial real es
  // registerInPersonApplication, que releva además al representante legal.

  /**
   * Registro presencial completo en ventanilla.
   *
   * A diferencia del flujo público, acá el cajero releva todos los datos del
   * contribuyente (representante legal y contacto real), así que el solicitante
   * se crea con su correo verdadero en lugar de uno sintético.
   *
   * Deja el trámite en DRAFT; al subir el plano y los certificados,
   * DocumentService lo pasa solo a PENDING_PAYMENT.
   */
  static async registerInPersonApplication(params: {
    cashierId: string;
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    representativeName: string;
    representativeDni?: string;
    representativeRole?: string;
    activityType?: string;
    email: string;
    /** Local para el que se pide la licencia. Sin esto, el domicilio fiscal. */
    commercialAddress?: string;
    /** La llave del local, siempre concreta: bloqueo y reuso se acotan por ella. */
    establishmentAddress: string;
  }): Promise<{ application: Application; business: Business }> {
    const now = await getCurrentSystemDate();

    // Sin teléfono: la ventanilla dejó de pedirlo porque el sistema no manda
    // nada por ahí. `User.phone` y `Business.representativePhone` son NOT NULL,
    // así que llevan el mismo relleno que ya usa el flujo público.
    const business = await BusinessService.upsertBusinessDetails({
      legalName: params.legalName,
      ruc: params.ruc,
      fiscalAddress: params.fiscalAddress,
      commercialAddress: params.commercialAddress,
      activityType: params.activityType,
      representativeName: params.representativeName,
      representativeDni: params.representativeDni,
      representativeRole: params.representativeRole,
    });

    const applicant = await prisma.user.upsert({
      where: { email: params.email },
      update: {
        fullName: params.representativeName,
        active: true,
      },
      create: {
        email: params.email,
        // Alta presencial: el contribuyente no elige contraseña en ventanilla.
        passwordHash: `presencial-sin-acceso-${params.ruc}`,
        fullName: params.representativeName,
        dni: params.representativeDni || "00000000",
        phone: "000000000",
        role: Role.APPLICANT,
        active: true,
      },
    });

    const existingApplication =
      await ApplicationService.findOpenApplicationByBusiness(
        business.id,
        params.establishmentAddress
      );

    if (existingApplication) {
      // Se adopta el trámite que ya existía **para este local** —típicamente un
      // borrador que quedó de un intento por la web— en vez de abrir otro. El
      // solicitante pasa a ser el que el cajero acaba de relevar: es el que dio
      // la cara en el mostrador y el correo con el que se le va a avisar.
      const tracked = await prisma.application.update({
        where: { id: existingApplication.id },
        data: {
          applicantId: applicant.id,
          registeredById: params.cashierId,
          contactEmail: params.email,
          // Reclama el local para el borrador adoptado (era null si venía sin
          // local elegido).
          establishmentAddress: params.establishmentAddress,
        },
      });

      return { application: tracked, business };
    }

    const applicationNumber = await ApplicationRepository.generateNumber();

    const application = await prisma.application.create({
      data: {
        number: applicationNumber,
        applicantId: applicant.id,
        businessId: business.id,
        registeredById: params.cashierId,
        // El mismo correo que se guarda en el usuario va también al trámite:
        // MailService y la subsanación pública leen contactEmail, no
        // User.email. Sin esto el administrado atendido en ventanilla no
        // recibía ningún aviso pese a haber dejado su correo.
        contactEmail: params.email,
        establishmentAddress: params.establishmentAddress,
        createdAt: now,
        updatedAt: now,
      },
    });

    return { application, business };
  }
}