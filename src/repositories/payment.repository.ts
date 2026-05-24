import { prisma } from "../lib/db/prisma";
import { getCurrentSystemDate } from "@/lib/date";
import { Payment, PaymentType } from "@prisma/client";

export class PaymentRepository {
  static async create(data: {
    applicationId: string;
    type: PaymentType;
    amount: number;
    operationNumber: string;
    paidAt: Date;
  }): Promise<Payment> {
    return prisma.payment.create({
      data: {
        applicationId: data.applicationId,
        type: data.type,
        amount: data.amount,
        operationNumber: data.operationNumber,
        status: "COMPLETED",
        paidAt: data.paidAt,
      },
    });
  }

  static async findByApplicationId(applicationId: string): Promise<Payment[]> {
    return prisma.payment.findMany({ where: { applicationId }, orderBy: { createdAt: "desc" } });
  }

  static async generateOperationNumber(): Promise<string> {
    const timestamp = (await getCurrentSystemDate()).getTime().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `MPT-${timestamp}-${random}`;
  }
}
