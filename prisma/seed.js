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
    },
    {
      email: "pepe.inspector@muni.pe",
      password: "Pepe2026!",
      fullName: "Pepe Martínez",
      dni: "14876543",
      phone: "987651234",
    },
    {
      email: "juan.inspector@muni.pe",
      password: "Juan2026!",
      fullName: "Juan Rojas",
      dni: "17543268",
      phone: "987654321",
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
        role: "INSPECTOR",
        active: true,
      },
      create: {
        email: userData.email,
        passwordHash,
        fullName: userData.fullName,
        dni: userData.dni,
        phone: userData.phone,
        role: "INSPECTOR",
        active: true,
      },
    });

    console.log(`Inspector creado/actualizado: ${user.email} (contraseña: ${userData.password})`);
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
