import { z } from "zod";

export const BusinessSchema = z.object({
  legalName: z.string().min(3, "La razón social es obligatoria"),
  ruc: z
    .string()
    .length(11, "El RUC debe tener 11 dígitos")
    .regex(/^\d+$/, "El RUC debe contener solo números"),
  fiscalAddress: z.string().min(5, "El domicilio fiscal es obligatorio"),
  commercialAddress: z.string().min(5, "La dirección del local es obligatoria"),
  activityType: z.string().min(3, "El rubro es obligatorio"),
  representativeName: z.string().min(3, "El representante legal es obligatorio"),
});

export type BusinessFormValues = z.infer<typeof BusinessSchema>;
