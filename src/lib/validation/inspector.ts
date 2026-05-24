import { z } from "zod";

export const InspectorActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  observations: z.string().max(500, "Las observaciones no pueden superar los 500 caracteres").optional(),
});

export type InspectorActionPayload = z.infer<typeof InspectorActionSchema>;
