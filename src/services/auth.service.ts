import { UserRepository } from "../repositories/user.repository";
import { hashPassword, comparePassword, signToken, setAuthCookie, removeAuthCookie } from "../lib/auth";
import { User, Role } from "@prisma/client";

export class AuthService {
  static async registerApplicant(data: {
    email: string;
    passwordPlain: string;
    fullName: string;
    dni: string;
    phone: string;
  }): Promise<{ user: Omit<User, "passwordHash">; token: string }> {
    // Verificar si el correo ya existe
    const existingUser = await UserRepository.findByEmail(data.email);
    if (existingUser) {
      throw new Error("El correo electrónico ya está registrado.");
    }

    // Hashear la contraseña
    const passwordHash = await hashPassword(data.passwordPlain);

    // Crear el usuario solicitante
    const newUser = await UserRepository.createApplicant({
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      dni: data.dni,
      phone: data.phone,
    });

    // Firmar token JWT
    const token = signToken({
      userId: newUser.id,
      email: newUser.email,
      role: Role.APPLICANT,
    });

    // Establecer la cookie de sesión
    setAuthCookie(token);

    // Retornar sin el hash de la contraseña
    const { passwordHash: _, ...userWithoutHash } = newUser;
    return { user: userWithoutHash, token };
  }

  static async login(data: {
    email: string;
    passwordPlain: string;
  }): Promise<{ user: Omit<User, "passwordHash">; token: string }> {
    // Buscar usuario por correo
    const user = await UserRepository.findByEmail(data.email);
    if (!user) {
      throw new Error("Credenciales inválidas. Correo o contraseña incorrectos.");
    }

    // Verificar si el usuario está activo
    if (!user.active) {
      throw new Error("Esta cuenta de usuario ha sido desactivada.");
    }

    // Comparar contraseñas
    const passwordMatch = await comparePassword(data.passwordPlain, user.passwordHash);
    if (!passwordMatch) {
      throw new Error("Credenciales inválidas. Correo o contraseña incorrectos.");
    }

    // Firmar token JWT
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Establecer la cookie de sesión
    setAuthCookie(token);

    // Retornar sin el hash
    const { passwordHash: _, ...userWithoutHash } = user;
    return { user: userWithoutHash, token };
  }

  static async logout(): Promise<void> {
    removeAuthCookie();
  }
}
