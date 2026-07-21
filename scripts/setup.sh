#!/usr/bin/env bash
#
# Prepara el proyecto en una computadora nueva (macOS, Linux o Git Bash).
#
#   bash scripts/setup.sh
#
# Comprueba los requisitos, instala las dependencias y deja el .env listo.
# No instala Node ni Git: eso toca todo el sistema, así que si faltan avisa
# con el comando exacto y se detiene.

set -euo pipefail

VERDE="\033[0;32m"; AMARILLO="\033[0;33m"; ROJO="\033[0;31m"
CYAN="\033[0;36m"; GRIS="\033[0;90m"; FIN="\033[0m"

titulo() { printf "\n${CYAN}== %s${FIN}\n" "$1"; }
ok()     { printf "   ${VERDE}OK${FIN}   %s\n" "$1"; }
aviso()  { printf "   ${AMARILLO}!${FIN}    %s\n" "$1"; }
error()  { printf "   ${ROJO}X${FIN}    %s\n" "$1"; }

# Ubicarse en la raíz del proyecto, sin importar desde dónde se invoque.
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

printf "\n  Licencias Municipales - Trujillo\n"
printf "${GRIS}  Preparando el proyecto en: %s${FIN}\n" "$RAIZ"

# ── 1. Node ──────────────────────────────────────────────────────────────────
titulo "Requisitos"

if ! command -v node >/dev/null 2>&1; then
  error "No se encontró Node.js."
  printf "\n   Instalalo desde https://nodejs.org (versión LTS)\n"
  printf "   macOS con Homebrew:  brew install node\n"
  printf "   Después volvé a correr este script.\n\n"
  exit 1
fi

# Next 14 necesita 18.17 o superior.
VERSION="$(node -v | sed 's/^v//')"
MAYOR="$(echo "$VERSION" | cut -d. -f1)"
MENOR="$(echo "$VERSION" | cut -d. -f2)"

if [ "$MAYOR" -lt 18 ] || { [ "$MAYOR" -eq 18 ] && [ "$MENOR" -lt 17 ]; }; then
  error "Node $VERSION es demasiado viejo. Next 14 necesita 18.17 o superior."
  printf "\n   Actualizalo desde https://nodejs.org\n\n"
  exit 1
fi

ok "Node $VERSION"

if command -v git >/dev/null 2>&1; then
  ok "$(git --version)"
else
  aviso "Git no está instalado. No hace falta para correr el proyecto, pero sí para actualizarlo."
fi

# ── 2. Dependencias ──────────────────────────────────────────────────────────
titulo "Dependencias"

printf "${GRIS}   Instalando... (puede tardar un par de minutos)${FIN}\n"

if ! npm install --no-fund --no-audit >/dev/null 2>&1; then
  error "npm install falló. Corrélo a mano para ver el detalle:  npm install"
  exit 1
fi

ok "Paquetes instalados"

# postinstall corre prisma generate; se confirma que quedó.
if [ -d "node_modules/.prisma/client" ]; then
  ok "Cliente de Prisma generado"
else
  aviso "El cliente de Prisma no aparece. Generalo con: npm run db:generate"
fi

# ── 3. Variables de entorno ──────────────────────────────────────────────────
titulo "Variables de entorno"

if [ ! -f .env ]; then
  cp .env.example .env
  ok "Se creó el archivo .env a partir de la plantilla"
else
  ok "Ya existe un archivo .env"
fi

# Las tres sin las que el proyecto no arranca.
VACIAS=""

for CLAVE in DATABASE_URL APIPERU_TOKEN JWT_SECRET; do
  LINEA="$(grep -E "^[[:space:]]*${CLAVE}[[:space:]]*=" .env || true)"

  if [ -z "$LINEA" ]; then
    VACIAS="$VACIAS $CLAVE"
    continue
  fi

  VALOR="$(echo "$LINEA" | cut -d= -f2- | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//')"

  # El placeholder de la plantilla tampoco sirve.
  case "$VALOR" in
    ""|tu_token*|cambiar_por*|postgresql://usuario*) VACIAS="$VACIAS $CLAVE" ;;
  esac
done

if [ -n "$VACIAS" ]; then
  printf "\n"
  aviso "Faltan completar estas variables en el archivo .env:"
  for C in $VACIAS; do printf "        ${AMARILLO}%s${FIN}\n" "$C"; done
  printf "\n   Copiá los valores del .env de la computadora donde ya funciona.\n"
  printf "${GRIS}   Las demás variables son opcionales: sin ellas no salen los correos,\n"
  printf "   el WhatsApp ni el botón de pago, pero nada se rompe.${FIN}\n"
  printf "\n   Cuando las tengas, corré:  ${CYAN}npm run dev${FIN}\n\n"
  exit 0
fi

ok "Las tres variables obligatorias están completas"

# ── 4. Listo ─────────────────────────────────────────────────────────────────
titulo "Todo listo"

printf "\n   Arrancá el servidor con:\n"
printf "     ${CYAN}npm run dev${FIN}\n"
printf "\n   Y abrí http://localhost:3000\n"
printf "\n${GRIS}   Cuentas del personal (contraseña 12345678):\n"
printf "     admin@muni.pe  dev@muni.pe  inspector@muni.pe  cajero@muni.pe  cajero2@muni.pe\n"
printf "\n   Si la base todavía no tiene las tablas, corré antes:  npm run db:setup${FIN}\n\n"
