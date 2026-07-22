import { z } from "zod";

export const InspectorActionSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    observations: z
      .string()
      .max(500, "Las observaciones no pueden superar los 500 caracteres")
      .optional(),
    // El comprobante de pago no es válido. No hay segunda oportunidad: sin
    // pago legítimo no hay nada que volver a inspeccionar, así que el trámite
    // se cierra en firme y el RUC queda libre para empezar de cero.
    paymentInvalid: z.boolean().optional().default(false),
    // Gravedad de la multa. Solo se usa al observar una inspección inopinada:
    // ahí la licencia sigue vigente y lo único que corresponde es multar.
    //
    // Viaja la gravedad y **no el monto**: el importe sale de la UIT vigente y
    // esa la cambia el administrador. Si el navegador mandara el monto, un
    // cambio de UIT entre que se abre la pantalla y se registra la multa
    // dejaría el importe viejo.
    fineGravedad: z
      .enum(["LEVE", "GRAVE", "MUY_GRAVE", "MUY_GRAVE_AGRAVADA"])
      .optional(),
  })
  // Rechazar sin motivo deja al administrado sin saber qué subsanar: para
  // rechazar, las observaciones son obligatorias.
  .refine(
    (data) =>
      data.action !== "reject" || (data.observations?.trim().length ?? 0) > 0,
    {
      path: ["observations"],
      message: "Para rechazar es obligatorio registrar observaciones.",
    }
  );

export type InspectorActionPayload = z.infer<typeof InspectorActionSchema>;
