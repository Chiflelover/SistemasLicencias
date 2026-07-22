import { BusinessRepository } from "@/repositories/business.repository";
import { prisma } from "@/lib/db/prisma";
import { Business } from "@prisma/client";

export class BusinessService {
  // registerBusiness se eliminó con startNewApplication, su único llamador.
  // Las altas vivas usan findOrCreateBusiness (público) y upsertBusinessDetails
  // (ventanilla), que reutilizan el negocio si el RUC ya existe en vez de
  // rechazarlo.

  /**
   * Alta o actualización del negocio con los datos completos que releva el
   * cajero en ventanilla, incluido el representante legal.
   */
  static async upsertBusinessDetails(data: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    commercialAddress?: string;
    activityType?: string;
    representativeName?: string;
    representativeDni?: string;
    representativeRole?: string;
    representativePhone?: string;
  }): Promise<Business> {
    const details = {
      legalName: data.legalName,
      fiscalAddress: data.fiscalAddress,
      activityType: data.activityType || "No registrado",
      representativeName: data.representativeName || "No registrado",
      representativeDni: data.representativeDni || "",
      representativeRole: data.representativeRole || "Representante Legal",
      representativePhone: data.representativePhone || "",
    };

    return prisma.business.upsert({
      where: { ruc: data.ruc },
      // El local elegido solo se pisa si vino uno nuevo: al retomar un trámite
      // sin volver a tocar la tarjeta de anexos, el que ya estaba se conserva.
      // Sin esto, continuar en ventanilla devolvía la licencia al domicilio
      // fiscal sin que nadie lo hubiera pedido.
      update: data.commercialAddress
        ? { ...details, commercialAddress: data.commercialAddress }
        : details,
      create: {
        ruc: data.ruc,
        ...details,
        commercialAddress: data.commercialAddress || data.fiscalAddress,
      },
    });
  }

  static async findOrCreateBusiness(data: {
    legalName: string;
    ruc: string;
    fiscalAddress: string;
    /** Local para el que se pide la licencia. Sin esto, el domicilio fiscal. */
    commercialAddress?: string;
    activityType?: string;
    representativeDni?: string;
    representativeName?: string;
  }): Promise<Business> {
    const existingBusiness = await BusinessRepository.findByRuc(data.ruc);

    if (existingBusiness) {
      // El negocio puede venir de un trámite anterior a que el rubro o el DNI
      // se pidieran, con el relleno guardado. Si ahora el ciudadano los
      // declara, se actualizan: si no, la licencia se seguiría emitiendo con
      // el relleno impreso.
      const cambios: {
        activityType?: string;
        representativeDni?: string;
        representativeName?: string;
        commercialAddress?: string;
      } = {};

      if (
        data.commercialAddress &&
        data.commercialAddress !== existingBusiness.commercialAddress
      ) {
        cambios.commercialAddress = data.commercialAddress;
      }

      if (data.activityType && data.activityType !== existingBusiness.activityType) {
        cambios.activityType = data.activityType;
      }

      if (
        data.representativeDni &&
        data.representativeDni !== existingBusiness.representativeDni
      ) {
        cambios.representativeDni = data.representativeDni;
      }

      if (
        data.representativeName &&
        data.representativeName !== existingBusiness.representativeName
      ) {
        cambios.representativeName = data.representativeName;
      }

      if (Object.keys(cambios).length > 0) {
        return prisma.business.update({
          where: { id: existingBusiness.id },
          data: cambios,
        });
      }

      return existingBusiness;
    }

    return BusinessRepository.create({
      legalName: data.legalName,
      ruc: data.ruc,
      fiscalAddress: data.fiscalAddress,
      // Sin local elegido, el establecimiento es el domicilio fiscal.
      commercialAddress: data.commercialAddress || data.fiscalAddress,
      activityType: data.activityType || "No registrado",
      // El relleno solo queda si el padrón no resolvió el nombre; en ese caso la
      // licencia imprime únicamente el DNI (ver formatRepresentative).
      representativeName: data.representativeName || "No registrado",
      representativeDni: data.representativeDni || "",
      representativeRole: "Representante Legal",
      representativePhone: "",
    });
  }
}