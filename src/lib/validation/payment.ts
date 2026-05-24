import { z } from "zod";

export const PaymentSchema = z.object({
  applicationId: z.string().min(1, "El trámite es obligatorio para realizar el pago"),
});

export type PaymentPayload = z.infer<typeof PaymentSchema>;
