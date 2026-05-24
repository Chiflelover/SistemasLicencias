import { z } from "zod";

export const DocumentUploadSchema = z.object({
  applicationId: z.string().min(1, "El trámite es obligatorio"),
  documentName: z.string().min(3, "El nombre del documento es obligatorio"),
  documentType: z.enum(["FLOOR_PLAN", "RUC_RECORD", "ADDITIONAL"]),
  file: z.any().optional(),
});

export type DocumentUploadValues = z.infer<typeof DocumentUploadSchema>;
