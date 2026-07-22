import nodemailer, { Transporter } from "nodemailer";

/**
 * Envío de correos al administrado.
 *
 * Usa una cuenta de Gmail con contraseña de aplicación: gratis, sin dominio
 * propio y entrega a cualquier dirección, que es lo que el flujo público
 * necesita porque el ciudadano no puede iniciar sesión y sus avisos internos
 * quedaban sin leer. No es correo institucional: el remitente es la cuenta
 * personal configurada.
 */

const REMITENTE = "Licencias MPT";

/** Un SMTP lento no debe colgar la petición del ciudadano. */
const TIMEOUT_MS = 8000;

let transporterCache: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  // Google muestra la clave en grupos de cuatro; se quitan los espacios por
  // si se pegó tal cual.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

  if (!user || !pass) {
    return null;
  }

  if (!transporterCache) {
    transporterCache = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
  }

  return transporterCache;
}

export class MailService {
  /**
   * Devuelve true si el correo salió. Nunca lanza: quien llama está en medio
   * de una operación de negocio que no debe romperse porque falle un aviso.
   */
  static async send(params: {
    to: string;
    subject: string;
    text: string;
  }): Promise<boolean> {
    const transporter = getTransporter();

    // Sin credenciales o sin destinatario, el aviso simplemente no se manda.
    if (!transporter || !params.to) {
      return false;
    }

    try {
      await transporter.sendMail({
        from: `"${REMITENTE}" <${process.env.GMAIL_USER}>`,
        to: params.to,
        subject: params.subject,
        text: params.text,
      });

      return true;
    } catch (error: any) {
      console.error("No se pudo enviar el correo:", error?.message);
      return false;
    }
  }

  /** Aviso al administrado de que su licencia caducó. */
  static async notifyLicenseExpired(to: string, licenseNumber: string) {
    return this.send({
      to,
      subject: "Tu licencia de funcionamiento venció",
      text:
        `La licencia ${licenseNumber} venció.\n\n` +
        "Para renovarla acércate a una ventanilla de la Municipalidad " +
        "Provincial de Trujillo con tu RUC. Si cambió algo del local puedes " +
        "presentar los documentos actualizados; si no cambió nada, no hace " +
        "falta volver a presentarlos.",
    });
  }

  /**
   * Aviso al administrado de que su licencia fue dada de baja en ventanilla.
   *
   * Se manda aunque la baja la haya pedido él mismo: termina una licencia antes
   * de tiempo y conviene que quede constancia escrita de cuándo y por qué.
   */
  static async notifyLicenseCancelled(
    to: string,
    licenseNumber: string,
    motivo: string
  ) {
    return this.send({
      to,
      subject: "Tu licencia de funcionamiento fue dada de baja",
      text:
        `La licencia ${licenseNumber} fue dada de baja en ventanilla.\n\n` +
        `Motivo registrado: ${motivo}\n\n` +
        "Desde ahora el local no cuenta con licencia de funcionamiento. Si vas " +
        "a operar en un local nuevo, inicia un trámite desde el portal o " +
        "acércate a una ventanilla: tu RUC quedó habilitado para hacerlo.",
    });
  }

  /**
   * Aviso al administrado de que su primera inspección fue observada, con el
   * motivo del inspector y la fecha de la segunda visita.
   */
  static async notifyInspectionRejected(
    to: string,
    observations: string,
    secondInspectionAt: Date
  ) {
    const cuando = secondInspectionAt.toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return this.send({
      to,
      subject: "Tu inspección fue observada",
      text:
        "La inspección de tu establecimiento fue observada.\n\n" +
        `Observación del inspector:\n${observations}\n\n` +
        `Se reprogramó una segunda inspección para el ${cuando}. Tienes hasta ` +
        "esa fecha para subsanar los documentos: vuelve a subir los archivos " +
        "corregidos desde la página de tu trámite.",
    });
  }

  /**
   * Aviso de rechazo por comprobante de pago inválido.
   *
   * A diferencia de una observación normal, acá no hay segunda inspección: el
   * trámite se cierra y corresponde iniciar uno nuevo.
   */
  static async notifyPaymentRejected(to: string, observations: string) {
    return this.send({
      to,
      subject: "Tu trámite fue rechazado: el pago no es válido",
      text:
        "El inspector municipal no pudo validar el comprobante de pago de tu " +
        "trámite, así que quedó rechazado.\n\n" +
        (observations ? `Observación del inspector:\n${observations}\n\n` : "") +
        "No hay una segunda inspección para este caso. Puedes iniciar un " +
        "trámite nuevo con el mismo RUC cuando tengas el pago en regla.",
    });
  }

  /**
   * Aviso de rechazo definitivo tras la segunda observación.
   *
   * Es el aviso más importante de todos: el trámite se cierra para siempre y
   * el administrado solo se enteraría consultando su RUC por su cuenta.
   */
  static async notifyDefinitiveRejection(to: string, observations: string) {
    return this.send({
      to,
      subject: "Tu trámite fue rechazado",
      text:
        "La segunda inspección de tu establecimiento también fue observada, " +
        "así que el trámite quedó rechazado.\n\n" +
        (observations ? `Observación del inspector:\n${observations}\n\n` : "") +
        "No corresponde una tercera inspección. Puedes iniciar un trámite " +
        "nuevo con el mismo RUC cuando hayas resuelto las observaciones.",
    });
  }

  /** Aviso al administrado de la inspección programada para hoy. */
  static async notifyInspectionScheduled(to: string, scheduledAt: Date) {
    const cuando = scheduledAt.toLocaleString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return this.send({
      to,
      subject: "Hoy tienes la inspección de tu licencia",
      text:
        `Hoy ${cuando} está programada la inspección municipal de tu ` +
        "establecimiento.\n\nAsegúrate de que el local esté abierto y con la " +
        "documentación a la vista.",
    });
  }
}
