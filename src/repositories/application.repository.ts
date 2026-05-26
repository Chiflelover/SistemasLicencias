import { prisma } from "../lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { Application, ApplicationStatus } from "@prisma/client";

export class ApplicationRepository {
  static async findById(id: string) {
    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        business: true,
        applicant: {
          select: {
            id: true,
            fullName: true,
            email: true,
            dni: true,
            phone: true,
            role: true,
          },
        },
        documents: true,
        payments: true,
        inspections: {
          include: {
            inspector: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        license: true,
      },
    });

    return app ? this.syncStatusWithSimulatedDate(app) : null;
  }

  static async findByApplicantId(applicantId: string) {
    const app = await prisma.application.findFirst({
      where: { applicantId },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        business: true,
        documents: true,
        payments: true,
        inspections: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            inspector: {
              select: {
                fullName: true,
              },
            },
          },
        },
        license: true,
      },
    });

    return app ? this.syncStatusWithSimulatedDate(app) : null;
  }

  static async findPaymentTargetByApplicantId(applicantId: string) {
    const apps = await prisma.application.findMany({
      where: { applicantId },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        business: true,
        documents: true,
        payments: true,
        inspections: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            inspector: {
              select: {
                fullName: true,
              },
            },
          },
        },
        license: true,
      },
    });

    if (apps.length === 0) {
      return null;
    }

    const syncedApps = [];

    for (const app of apps) {
      syncedApps.push(await this.syncStatusWithSimulatedDate(app));
    }

    const pendingPaymentApp = syncedApps.find(
      (app) =>
        app.status === ApplicationStatus.PENDING_PAYMENT ||
        app.status === ApplicationStatus.RENEWAL_AVAILABLE
    );

    return pendingPaymentApp ?? syncedApps[0];
  }

  private static async syncStatusWithSimulatedDate(application: any) {
    if (!application.license) {
      return application;
    }

    const simulatedDate = await getCurrentSystemDate();
    const expiresAt = new Date(application.license.expiresAt);

    const renewalPeriodStart = new Date(expiresAt);
    renewalPeriodStart.setDate(expiresAt.getDate() - 30);

    let newStatus: ApplicationStatus = application.status;

    if (simulatedDate > expiresAt) {
      newStatus = ApplicationStatus.EXPIRED;
    } else if (simulatedDate >= renewalPeriodStart) {
      newStatus = ApplicationStatus.RENEWAL_AVAILABLE;
    }

    if (newStatus !== application.status) {
      application.status = newStatus;

      if (application.license) {
        application.license.status =
          simulatedDate > expiresAt ? "EXPIRED" : "RENEWAL_AVAILABLE";
      }
    }

    return application;
  }

  static async findAllForInspector() {
    return prisma.application.findMany({
      where: {
        status: {
          in: [
            ApplicationStatus.INSPECTION_SCHEDULED,
            ApplicationStatus.SECOND_INSPECTION_SCHEDULED,
          ],
        },
      },
      include: {
        business: true,
        applicant: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        inspections: {
          where: {
            status: "SCHEDULED",
          },
          include: {
            inspector: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
          orderBy: {
            scheduledAt: "asc",
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  static async generateNumber(): Promise<string> {
    const count = await prisma.application.count();
    const year = (await getCurrentSystemDate()).getFullYear();

    return `MPT-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  static async create(data: {
    number: string;
    applicantId: string;
    businessId: string;
  }): Promise<Application> {
    const now = await getCurrentSystemDate();

    return prisma.application.create({
      data: {
        number: data.number,
        applicantId: data.applicantId,
        businessId: data.businessId,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  static async updateStatus(
    id: string,
    status: ApplicationStatus
  ): Promise<Application> {
    return prisma.application.update({
      where: { id },
      data: {
        status,
        updatedAt: await getCurrentSystemDate(),
      },
    });
  }

  static async lockData(id: string): Promise<Application> {
    return prisma.application.update({
      where: { id },
      data: {
        dataLocked: true,
        updatedAt: await getCurrentSystemDate(),
      },
    });
  }

  static async searchPublic(query: string) {
    return prisma.application.findMany({
      where: {
        status: ApplicationStatus.LICENSE_ISSUED,
        business: {
          OR: [
            {
              ruc: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              legalName: {
                contains: query,
                mode: "insensitive",
              },
            },
          ],
        },
      },
      include: {
        business: true,
        license: {
          select: {
            licenseNumber: true,
            status: true,
            issuedAt: true,
            expiresAt: true,
          },
        },
      },
      take: 20,
    });
  }

  static async findAllActive() {
    return prisma.application.findMany({
      where: {
        status: {
          in: [
            ApplicationStatus.LICENSE_ISSUED,
            ApplicationStatus.RENEWAL_AVAILABLE,
          ],
        },
      },
      include: {
        license: true,
      },
    });
  }
}