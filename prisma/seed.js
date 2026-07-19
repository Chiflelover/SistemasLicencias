const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando siembra de base de datos...");

  const users = [
    {
      email: "inspector@muni.pe",
      password: "12345678",
      fullName: "Inspector Municipal de Trujillo",
      dni: "00000000",
      phone: "999999999",
      role: "INSPECTOR",
    },
    {
      email: "cajero@muni.pe",
      password: "12345678",
      fullName: "Cajero Municipal de Trujillo",
      dni: "00000001",
      phone: "999999998",
      role: "CAJERO",
    },
  ];

  for (const userData of users) {
    const passwordHash = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        passwordHash,
        fullName: userData.fullName,
        dni: userData.dni,
        phone: userData.phone,
        role: userData.role,
        active: true,
      },
      create: {
        email: userData.email,
        passwordHash,
        fullName: userData.fullName,
        dni: userData.dni,
        phone: userData.phone,
        role: userData.role,
        active: true,
      },
    });

    console.log(`${user.role} creado/actualizado: ${user.email} (contraseña: ${userData.password})`);
  }

  console.log("Siembra completada con éxito.");
}

main()
  .catch((e) => {
    console.error("Error en la siembra de la base de datos:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
