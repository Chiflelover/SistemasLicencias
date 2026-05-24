const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando siembra de base de datos...");

  const email = "inspector@muni.pe";
  const passwordHash = await bcrypt.hash("12345678", 10);

  // Crear o actualizar inspector obligatorio
  const inspector = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      fullName: "Inspector Municipal de Trujillo",
      dni: "00000000",
      phone: "999999999",
      role: "INSPECTOR",
      active: true,
    },
    create: {
      email,
      passwordHash,
      fullName: "Inspector Municipal de Trujillo",
      dni: "00000000",
      phone: "999999999",
      role: "INSPECTOR",
      active: true,
    },
  });

  console.log(`Inspector creado/actualizado: ${inspector.email}`);
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
