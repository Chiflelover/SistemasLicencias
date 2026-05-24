import { z } from "zod";

export const ScheduleInspectionSchema = z.object({
  applicationId: z.string().min(1, "El trámite es obligatorio para programar la inspección"),
});

export type ScheduleInspectionPayload = z.infer<typeof ScheduleInspectionSchema>;
