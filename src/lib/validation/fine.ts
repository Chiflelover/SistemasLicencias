import { z } from "zod";

export const FineRegistrationSchema = z.object({
  licenseId: z.string().min(1, "La licencia es obligatoria"),
  // Viaja la gravedad y **no el monto**: las multas municipales se expresan en
  // porcentaje de UIT y ese valor lo cambia el administrador, así que el
  // importe lo calcula el servidor contra la UIT del momento. Antes acá había
  // un `amount: z.number().min(0)`, que encima dejaba pasar multas de S/ 0.
  gravedad: z.enum(["LEVE", "GRAVE", "MUY_GRAVE", "MUY_GRAVE_AGRAVADA"], {
    message: "Indica la gravedad de la infracción",
  }),
  description: z.string().min(3, "La descripción es obligatoria"),
  observations: z.string().max(500, "Las observaciones no pueden superar los 500 caracteres").optional(),
});

export type FineRegistrationPayload = z.infer<typeof FineRegistrationSchema>;
