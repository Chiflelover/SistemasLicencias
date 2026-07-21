import { UserRepository } from "../repositories/user.repository";
import { comparePassword, signToken, setAuthCookie, removeAuthCookie } from "../lib/auth";
import { User } from "@prisma/client";

/**
 * Sesiones del personal: inspector, cajero, administrador y desarrollador.
 *
 * No hay autoregistro. El administrado no tiene cuenta: entra por el flujo
 * público, que lo identifica por el link de su trámite y por el correo con el
 * que lo registró. Antes existía `registerApplicant` junto con la pantalla
 * `/register`, que nadie enlazaba y contradecía ese diseño.
 */
export class AuthService {
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
