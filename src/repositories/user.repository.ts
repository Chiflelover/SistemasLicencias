import { prisma } from "../lib/db/prisma";
import { User, Role } from "@prisma/client";

export class UserRepository {
  static async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  static async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async createApplicant(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    dni: string;
    phone: string;
  }): Promise<User> {
    return prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        dni: data.dni,
        phone: data.phone,
        role: Role.APPLICANT,
        active: true,
      },
    });
  }

  static async findInspectors(): Promise<User[]> {
    return prisma.user.findMany({
      where: { role: Role.INSPECTOR, active: true },
      orderBy: { fullName: "asc" },
    });
  }
}
