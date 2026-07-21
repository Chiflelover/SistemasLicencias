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

  // createApplicant se eliminó con el autoregistro: los solicitantes los crean
  // los flujos público y presencial, con contraseña inutilizable.

  static async findInspectors(): Promise<User[]> {
    return prisma.user.findMany({
      where: { role: Role.INSPECTOR, active: true },
      orderBy: { fullName: "asc" },
    });
  }
}
