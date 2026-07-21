import { normalizeText } from "./territory";
import { isPersonaNatural } from "./ruc";

/**
 * Elegibilidad del RUC para iniciar un trámite de licencia.
 *
 * No alcanza con que el domicilio fiscal esté en Trujillo. El contribuyente
 * tiene que estar vigente ante SUNAT, ser ubicable, y tener un establecimiento
 * registrado: sin local no hay nada que licenciar.
 */

/** Único estado tributario que habilita el trámite. */
const ESTADO_HABILITADO = "ACTIVO";

/** Única condición de domicilio que habilita el trámite. */
const CONDICION_HABILITADA = "HABIDO";

/** Texto con que RucService rellena una dirección vacía. */
const DIRECCION_VACIA = "DIRECCION NO ENCONTRADA";

/** Explicación de cada estado de baja, para que el mensaje sea claro. */
const MOTIVOS_ESTADO: Record<string, string> = {
  "BAJA DE OFICIO":
    "SUNAT dio de baja este RUC de oficio. No puede iniciar trámites hasta regularizar su situación tributaria.",
  "BAJA DEFINITIVA":
    "Este RUC tiene baja definitiva ante SUNAT y no puede iniciar trámites.",
  "BAJA PROVISIONAL":
    "Este RUC tiene baja provisional ante SUNAT. Debe reactivarlo antes de iniciar el trámite.",
  "SUSPENSION TEMPORAL":
    "Este RUC está en suspensión temporal de actividades. Debe reactivarlo antes de iniciar el trámite.",
  "INHABILITADO-VENT. UNICA":
    "Este RUC está inhabilitado ante SUNAT y no puede iniciar trámites.",
};

/** Explicación de cada condición de domicilio que impide tramitar. */
const MOTIVOS_CONDICION: Record<string, string> = {
  "NO HABIDO":
    "SUNAT declaró NO HABIDO a este contribuyente: no fue ubicado en el domicilio fiscal declarado. Debe regularizar su domicilio ante SUNAT antes de solicitar la licencia.",
  "NO HALLADO":
    "SUNAT registra este RUC como NO HALLADO: no fue posible ubicarlo en su domicilio fiscal. Debe actualizar su domicilio ante SUNAT.",
  PENDIENTE:
    "La condición de domicilio de este RUC está pendiente de verificación en SUNAT. No es posible iniciar el trámite hasta que se regularice.",
};

export interface RucEligibility {
  elegible: boolean;
  motivo?: string;
}

export interface RucEligibilityInput {
  ruc?: string;
  estado?: string;
  condicion?: string;
  fiscalAddress?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
}

export function checkRucEligibility(data: RucEligibilityInput): RucEligibility {
  const estado = normalizeText(data.estado || "");
  const condicion = normalizeText(data.condicion || "");

  /**
   * Sin ubicación registrada no hay establecimiento que licenciar.
   *
   * SUNAT solo asigna domicilio fiscal cuando existe actividad empresarial.
   * Verificado con los RUC 10708882688 y 10416089162, que devuelven
   * dirección, distrito, provincia y departamento vacíos.
   */
  const direccion = normalizeText(data.fiscalAddress || "");
  const sinDireccion = !direccion || direccion === DIRECCION_VACIA;
  const sinUbicacion =
    !data.distrito?.trim() &&
    !data.provincia?.trim() &&
    !data.departamento?.trim();

  if (sinUbicacion && sinDireccion) {
    return {
      elegible: false,
      motivo:
        data.ruc && isPersonaNatural(data.ruc)
          ? "Este RUC corresponde a una persona natural sin negocio: SUNAT no registra domicilio fiscal ni ubicación. " +
            "Para obtener una licencia de funcionamiento primero debes registrar tu actividad empresarial ante SUNAT."
          : "SUNAT no registra un domicilio fiscal para este RUC. Sin establecimiento declarado no es posible otorgar una licencia de funcionamiento.",
    };
  }

  if (estado && estado !== ESTADO_HABILITADO) {
    return {
      elegible: false,
      motivo:
        MOTIVOS_ESTADO[estado] ||
        `El RUC no está activo ante SUNAT (estado: ${data.estado}). No puede iniciar trámites.`,
    };
  }

  if (condicion && condicion !== CONDICION_HABILITADA) {
    return {
      elegible: false,
      motivo:
        MOTIVOS_CONDICION[condicion] ||
        `SUNAT registra este RUC con condición ${data.condicion}. Debe regularizar su domicilio fiscal antes de iniciar el trámite.`,
    };
  }

  return { elegible: true };
}
