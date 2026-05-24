import { z } from "zod";

export const FineRegistrationSchema = z.object({
  licenseId: z.string().min(1, "La licencia es obligatoria"),
  amount: z.number().min(0, "El monto no puede ser negativo"),
  description: z.string().min(3, "La descripción es obligatoria"),
  observations: z.string().max(500, "Las observaciones no pueden superar los 500 caracteres").optional(),
});

export type FineRegistrationPayload = z.infer<typeof FineRegistrationSchema>;
