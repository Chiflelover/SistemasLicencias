# Licencias Municipales - Trujillo

Proyecto base configurado con Next.js 14, TypeScript, TailwindCSS, Prisma y PostgreSQL.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS 3**
- **Prisma ORM**
- **PostgreSQL**

## Estructura

```
prisma/
  schema.prisma          # Configuración de base de datos
src/
  app/                   # App Router (páginas y layouts)
  components/            # Componentes UI reutilizables
  lib/                   # Utilidades e infraestructura
    db/                  # Cliente Prisma
  services/              # Lógica de negocio
  repositories/          # Acceso a datos
  types/                 # Tipos TypeScript compartidos
```

## Modelo de datos (Prisma)

| Modelo | Descripción |
|--------|-------------|
| `User` | Solicitante (`APPLICANT`) o Inspector (`INSPECTOR`) |
| `Business` | Datos del negocio (RUC único) |
| `Application` | Trámite de licencia |
| `Document` | Archivos cargados (binario en BD) |
| `Payment` | Pagos simulados del trámite o renovación |
| `Inspection` | Inspecciones técnicas (1ª y 2ª) |
| `License` | Licencia emitida (PDF en BD) |
| `Fine` | Multas sobre licencias vigentes |

Ver `prisma/schema.prisma` para enums y relaciones completas.

## Instalación

```bash
npm install
cp .env.example .env
# Editar DATABASE_URL en .env

npm run db:push
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run db:push` | Sincronizar schema con PostgreSQL |
| `npm run db:migrate` | Crear migración |
| `npm run db:studio` | Prisma Studio |

## Variables de entorno

Ver `.env.example`:

- `DATABASE_URL` — Conexión PostgreSQL
- `NEXT_PUBLIC_APP_URL` — URL pública de la app
- `NODE_ENV` — Entorno de ejecución
