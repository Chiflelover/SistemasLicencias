/**
 * Aviso por WhatsApp a través de CallMeBot.
 *
 * Se eligió CallMeBot porque la API oficial de Meta cobra por cada mensaje
 * que inicia el negocio, y este proyecto no maneja presupuesto. La
 * contrapartida es que solo entrega al número que autorizó al bot: sirve
 * para demostrar que el aviso sale, no es una solución de producción.
 */

const CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php";

/**
 * Un servicio externo lento no puede dejar colgada la petición del ciudadano:
 * las funciones de Vercel tienen tiempo límite y del otro lado hay alguien
 * esperando que le cargue la página.
 *
 * Son 2 segundos y no más porque el aviso de inspección se manda dentro del
 * pago, que ya es la operación más lenta del sistema. Con CallMeBot caído
 * (devuelve 503) el tope se agota entero.
 */
const TIMEOUT_MS = 2000;

export class WhatsAppService {
  /**
   * Devuelve true si el mensaje salió. Nunca lanza: quien llama está en medio
   * de una operación de negocio que no debe romperse porque falle un aviso.
   */
  static async send(message: string): Promise<boolean> {
    const phone = process.env.CALLMEBOT_PHONE;
    const apiKey = process.env.CALLMEBOT_APIKEY;

    // Sin credenciales el aviso simplemente no se manda. No es un error:
    // permite levantar el proyecto sin configurar WhatsApp.
    if (!phone || !apiKey) {
      return false;
    }

    const params = new URLSearchParams({
      phone,
      text: message,
      apikey: apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${CALLMEBOT_URL}?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`CallMeBot respondió ${response.status}`);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error("No se pudo enviar el aviso por WhatsApp:", error?.message);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Aviso al inspector de su carga del día.
   *
   * El bot gratuito entrega a un único número, así que WhatsApp quedó
   * dedicado al inspector; al administrado se le avisa por correo.
   *
   * La fecha se arma con la zona del proceso, fijada en Lima (ver
   * src/lib/date.ts): sin eso saldría en UTC, cinco horas corrida.
   */
  static async notifyInspectorAgenda(pendientes: number, primera: Date) {
    const hora = primera.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const cuantas =
      pendientes === 1
        ? "1 inspección programada"
        : `${pendientes} inspecciones programadas`;

    return this.send(
      `Inspector: hoy tienes ${cuantas}. La primera a las ${hora}`
    );
  }
}
