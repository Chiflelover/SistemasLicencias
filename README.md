# Licencias Municipales — Trujillo

Sistema de licencias de funcionamiento para la Municipalidad Provincial de
Trujillo (Perú). Permite iniciar el trámite por internet o en ventanilla,
validar el RUC contra SUNAT, cobrar el derecho de trámite, agendar la
inspección municipal y emitir la licencia en PDF.

**Next.js 14** (App Router) · **TypeScript** · **Prisma** · **PostgreSQL** (Neon)
· **TailwindCSS**

---

## Cómo levantarlo en otra computadora

### Atajo: un solo comando

Después de clonar, en la raíz del proyecto:

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

```bash
# macOS, Linux o Git Bash
bash scripts/setup.sh
```

Comprueba la versión de Node, instala las dependencias, genera el cliente de
Prisma, crea el `.env` a partir de la plantilla y avisa qué variables faltan
completar. Al terminar dice exactamente qué hacer.

**No instala Node ni Git**: si faltan, muestra el comando para hacerlo y se
detiene, porque eso afecta a toda la computadora y no solo a este proyecto.

El resto de esta sección explica los mismos pasos a mano.

### 1. Requisitos

- **Node.js 18.17 o superior** — comprobar con `node -v`
- **Git**
- Una base **PostgreSQL**. La del proyecto está en [Neon](https://neon.com)
  (plan gratuito), pero sirve cualquiera.

### 2. Clonar e instalar

```bash
git clone https://github.com/Chiflelover/SistemasLicencias.git
cd SistemasLicencias
npm install
```

`npm install` corre `prisma generate` solo, así que el cliente de Prisma queda
listo sin pasos extra.

### 3. Variables de entorno

```bash
cp .env.example .env
```

Y completar el `.env`. Lo mínimo para que arranque son tres:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `APIPERU_TOKEN` | Consulta de RUC en [apiperu.dev](https://apiperu.dev). **Sin esto no se puede iniciar ningún trámite** |
| `JWT_SECRET` | Firma de las sesiones. Cualquier cadena larga y aleatoria |

Las demás son opcionales: si faltan, la función correspondiente simplemente no
aparece y **nada se rompe**. Ver *Variables de entorno* más abajo.

### 4. Preparar la base

```bash
npm run db:setup
```

Aplica las migraciones y crea las cuentas del personal. Si la base ya tenía
datos, este comando no los borra.

### 5. Arrancar

```bash
npm run dev
```

Abrir <http://localhost:3000>.

### 6. Entrar

Las cuentas son **precreadas**: no hay registro. Todas usan la contraseña
`12345678`.

| Rol | Correo | Entra a |
|---|---|---|
| Administrador | `admin@muni.pe` | `/admin` |
| Desarrollador | `dev@muni.pe` | `/dev` |
| Inspector | `inspector@muni.pe` | `/inspector` |
| Cajero (Caja 1) | `cajero@muni.pe` | `/cajero` |
| Cajero (Caja 2) | `cajero2@muni.pe` | `/cajero` |

**El ciudadano no tiene cuenta.** Entra por `/iniciar-tramite` y hace el
seguimiento en `/consulta` con su RUC.

### Problemas frecuentes

**`npm run build` falla con `EPERM` en Windows.** Hay que **detener el servidor
de desarrollo antes de compilar**: el proceso de Next bloquea
`query_engine-windows.dll.node`, y el build arranca con `prisma generate`, que
necesita reescribirlo.

**La primera petición falla con `P1017` o `kind: Closed`.** Es Neon, que
suspende el cómputo tras 5 minutos de inactividad. No es un error del código:
refrescar la página vuelve a funcionar apenas la base despierta.

**Levantar un solo servidor a la vez.** Dos `npm run dev` simultáneos compiten
por el puerto 3000 y sirven compilaciones distintas: aparecen 404 y respuestas
HTML donde se espera JSON.

**Nunca usar `npm run db:push`.** La base contiene una tabla `playing_with_neon`
que no está en el esquema, y `db push` sincroniza el esquema exacto: propondría
borrarla. Para cambios de esquema, generar la migración a mano y aplicarla con
`npm run db:deploy`.

---

## Cómo funciona

### El ciclo del trámite

```
DRAFT → (documentos) → PENDING_PAYMENT → (pago) → PAYMENT_COMPLETED
  → INSPECTION_SCHEDULED → aprueba → LICENSE_ISSUED
                         → observa  → SECOND_INSPECTION_SCHEDULED
                                       → aprueba → LICENSE_ISSUED
                                       → observa → DEFINITIVELY_REJECTED
LICENSE_ISSUED → (30 días antes) → RENEWAL_AVAILABLE → (pago) → renovada
               → (vencida)       → EXPIRED
```

- La **primera inspección** se agenda para el **siguiente día hábil** a las
  8:00. Nunca el mismo día del pago.
- La **segunda** se agenda 30 días hábiles después de la observación.
- **No hay tercera inspección.**
- Si el inspector marca que el **comprobante de pago no es válido**, el trámite
  se cierra en firme sin segunda inspección.
- Una **licencia vencida no se renueva**: corresponde iniciar un trámite nuevo.
  Ese RUC queda libre.

### Los dos caminos del ciudadano

**Por internet** — `/iniciar-tramite`: valida el RUC, sube el plano del local y
la ficha RUC, paga y sigue el trámite en `/consulta`. Se identifica por el
enlace de su trámite y por el correo que declaró.

**En ventanilla** — el cajero lo atiende en `/cajero/registro-presencial`,
releva sus datos, carga los documentos y cobra.

Los dos caminos se cruzan: un trámite iniciado por internet se puede subsanar en
ventanilla, y uno presencial se puede subsanar por internet.

### Elegibilidad del RUC

Antes de crear el trámite se verifica, en los tres puntos de alta:

1. **Dígito de control** — se valida localmente para no gastar cuota de APIPERU
   en RUC mal tipeados.
2. **Con ubicación registrada** — sin domicilio fiscal no hay establecimiento
   que licenciar.
3. **Estado tributario ACTIVO** ante SUNAT.
4. **Condición HABIDO**.
5. **Jurisdicción**: distrito Trujillo, provincia Trujillo, La Libertad.
6. **Sin trámite duplicado**: bloquea si hay uno en curso o una licencia
   vigente. Permite si venció o fue rechazado en firme.

### Pago

El derecho de trámite es de **S/ 180.00** según el TUPA, y es lo que muestra la
interfaz. El cobro real de la demostración es simbólico.

- **En ventanilla**: el cajero cobra con turno de caja abierto, admite pago
  mixto de hasta dos métodos, calcula vuelto y emite boleta o factura.
- **Por internet**: el ciudadano paga en línea con **Flow** —si está
  configurado `FLOW_PAYMENT_URL`— y sube la constancia. Registrar el
  comprobante es lo que marca el trámite como pagado y dispara el agendado de
  la inspección.

### Avisos al administrado

Como el ciudadano no puede iniciar sesión, los avisos salen **por correo** a la
dirección que declaró: licencia vencida, inspección de hoy, primera
observación, rechazo por pago inválido y rechazo definitivo.

El **WhatsApp** queda reservado para la agenda diaria del inspector: el bot
gratuito entrega a un único número fijo.

### Panel del administrador

Gestiona el personal y ve la recaudación de cada caja. Con cuatro reglas, todas
validadas también en el servidor:

- El **inspector base** no se elimina ni se desactiva.
- La **Caja 1** no se elimina.
- Siempre queda **al menos una caja activa**.
- **Solo se agregan cajas**, hasta un máximo de diez.

### Simulador de tiempo

Con `ENABLE_TIME_SIMULATOR="true"` aparece un panel flotante para adelantar el
reloj y demostrar vencimientos, renovaciones y la agenda del inspector sin
esperar semanas.

Al adelantar se abre una **corrida de simulación**: cada escritura queda
anotada con su estado previo, y al restablecer se deshacen todas y el reloj
vuelve al presente. Restablecer tarda unos segundos porque revierte los cambios
uno por uno.

Está en los portales de inspector, administrador y desarrollador. **No en
cajero.**

---

## Variables de entorno

### Obligatorias

| Variable | Notas |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `APIPERU_TOKEN` | Sin esto no se puede iniciar ningún trámite |
| `JWT_SECRET` | Tiene un valor por defecto en el código: no usarlo en producción |

### Opcionales

| Variable | Si falta |
|---|---|
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | No se manda ningún correo. No falla |
| `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` | No se manda el WhatsApp al inspector. No falla |
| `FLOW_PAYMENT_URL` | No aparece el botón de pago en línea; queda solo la carga del comprobante |
| `ENABLE_TIME_SIMULATOR` | El reloj es siempre el real y el panel no se renderiza |
| `NEXT_PUBLIC_APP_URL`, `NODE_ENV` | Estándar |

### En producción (Vercel)

Agregar además `TZ = America/Lima`. Vercel ejecuta en UTC, y sin la zona
correcta las inspecciones salen cinco horas corridas.

---

## Estructura

```
prisma/
  schema.prisma          # Modelos, enums y relaciones
  migrations/            # Migraciones versionadas
  seed.js                # Cuentas del personal
src/
  app/                   # Rutas (App Router)
    api/                 # Endpoints
    admin/  cajero/  inspector/  dev/     # Portales con sesión
    iniciar-tramite/  consulta/  tramite/ # Flujo público
  components/            # Componentes de interfaz
  lib/                   # Reglas compartidas y utilidades
    db/                  # Cliente Prisma
  repositories/          # Acceso a datos
  services/              # Lógica de negocio
  types/                 # Tipos compartidos
```

Las reglas de negocio viven en `services/`, el acceso a datos en
`repositories/`, y lo que comparten cliente y servidor en `lib/`.

## Modelo de datos

| Modelo | Descripción |
|---|---|
| `User` | Personal del sistema. El administrado se guarda con contraseña inutilizable |
| `Business` | Negocio, con RUC único y representante legal |
| `Application` | Trámite de licencia |
| `Document` | Plano, ficha RUC y adicionales (binario en la base) |
| `Payment` | Pagos del trámite y de renovación |
| `Inspection` | Inspecciones primera y segunda |
| `License` | Licencia emitida, con su PDF |
| `Fine` | Multas sobre licencias vigentes |
| `CashSession` | Turno de caja del cajero |
| `Notification` | Avisos internos de la campana |
| `AuditLog` | Registro de acciones sensibles |
| `SystemConfig` | Reloj del simulador |
| `SimulationRun`, `SimulationChange` | Corridas de simulación y sus cambios |
| `RucCache`, `DniCache` | Caché de consultas externas (30 días) |

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción (detener antes el servidor) |
| `npm run start` | Servir la compilación |
| `npm run lint` | ESLint |
| `npm run db:setup` | Migraciones + cuentas del seed |
| `npm run db:deploy` | Aplicar migraciones pendientes |
| `npm run db:status` | Estado de las migraciones |
| `npm run db:seed` | Solo las cuentas |
| `npm run db:studio` | Prisma Studio |
| `npm run db:generate` | Regenerar el cliente de Prisma |

`npm run db:push` existe pero **no debe usarse**: ver *Problemas frecuentes*.

## Convenciones

- Todo en español: interfaz, mensajes de error y comentarios.
- Los comentarios explican **por qué**, no qué.
- **Validar siempre en el servidor.** Lo del cliente es comodidad: se saltea con
  una petición directa.
- Las operaciones auxiliares —auditoría, avisos, caché— van en `try/catch` y
  nunca interrumpen la operación de negocio.
