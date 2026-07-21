# Prepara el proyecto en una computadora nueva.
#
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#
# Comprueba los requisitos, instala las dependencias y deja el .env listo.
# No instala Node ni Git: eso toca todo el sistema, así que si faltan avisa
# con el comando exacto y se detiene.

$ErrorActionPreference = "Stop"

function Titulo($texto) {
    Write-Host ""
    Write-Host "== $texto" -ForegroundColor Cyan
}

function Ok($texto)    { Write-Host "   OK   $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "   !    $texto" -ForegroundColor Yellow }
function Error2($texto){ Write-Host "   X    $texto" -ForegroundColor Red }

# Ubicarse en la raíz del proyecto, sin importar desde dónde se invoque.
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz

Write-Host ""
Write-Host "  Licencias Municipales - Trujillo" -ForegroundColor White
Write-Host "  Preparando el proyecto en: $raiz" -ForegroundColor DarkGray

# ── 1. Node ──────────────────────────────────────────────────────────────────
Titulo "Requisitos"

$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
    Error2 "No se encontró Node.js."
    Write-Host ""
    Write-Host "   Instalalo con:" -ForegroundColor White
    Write-Host "     winget install OpenJS.NodeJS.LTS" -ForegroundColor Cyan
    Write-Host "   o desde https://nodejs.org (versión LTS)."
    Write-Host "   Cerrá y volvé a abrir la terminal, y corré este script de nuevo."
    exit 1
}

# Next 14 necesita 18.17 o superior.
$versionNode = (node -v).TrimStart("v")
$partes = $versionNode.Split(".")
$mayor = [int]$partes[0]
$menor = [int]$partes[1]

if (($mayor -lt 18) -or (($mayor -eq 18) -and ($menor -lt 17))) {
    Error2 "Node $versionNode es demasiado viejo. Next 14 necesita 18.17 o superior."
    Write-Host ""
    Write-Host "   Actualizalo con:" -ForegroundColor White
    Write-Host "     winget install OpenJS.NodeJS.LTS" -ForegroundColor Cyan
    exit 1
}

Ok "Node $versionNode"

$git = Get-Command git -ErrorAction SilentlyContinue

if ($git) {
    Ok "Git $((git --version).Replace('git version ',''))"
} else {
    Aviso "Git no está instalado. No hace falta para correr el proyecto, pero sí para actualizarlo."
}

# ── 2. Dependencias ──────────────────────────────────────────────────────────
Titulo "Dependencias"

Write-Host "   Instalando... (puede tardar un par de minutos)" -ForegroundColor DarkGray
npm install --no-fund --no-audit | Out-Null

if ($LASTEXITCODE -ne 0) {
    Error2 "npm install falló. Revisá el mensaje de arriba."
    exit 1
}

Ok "Paquetes instalados"

# postinstall corre prisma generate; se confirma que quedó.
if (Test-Path "node_modules\.prisma\client") {
    Ok "Cliente de Prisma generado"
} else {
    Aviso "El cliente de Prisma no aparece. Generalo con: npm run db:generate"
}

# ── 3. Variables de entorno ──────────────────────────────────────────────────
Titulo "Variables de entorno"

$faltaCompletar = $false

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Ok "Se creó el archivo .env a partir de la plantilla"
    $faltaCompletar = $true
} else {
    Ok "Ya existe un archivo .env"
}

# Las tres sin las que el proyecto no arranca.
$obligatorias = @("DATABASE_URL", "APIPERU_TOKEN", "JWT_SECRET")
$vacias = @()

# Get-Content sin -Raw ya devuelve las líneas sueltas y sin el retorno de carro.
$lineasEnv = @(Get-Content ".env")

foreach ($clave in $obligatorias) {
    # El @(...) fuerza un arreglo: con una sola coincidencia, Where-Object
    # devuelve la cadena suelta y $linea[0] tomaría su primera LETRA.
    $coincidencias = @($lineasEnv | Where-Object { $_ -match "^\s*$clave\s*=" })

    if ($coincidencias.Count -eq 0) {
        $vacias += $clave
        continue
    }

    $partesLinea = $coincidencias[0] -split "=", 2

    if ($partesLinea.Count -lt 2) {
        $vacias += $clave
        continue
    }

    $valor = $partesLinea[1].Trim().Trim('"').Trim("'")

    # El placeholder de la plantilla tampoco sirve.
    if (($valor -eq "") -or ($valor -like "tu_token*") -or ($valor -like "cambiar_por*") -or ($valor -like "postgresql://usuario*")) {
        $vacias += $clave
    }
}

if ($vacias.Count -gt 0) {
    Write-Host ""
    Aviso "Faltan completar estas variables en el archivo .env:"
    foreach ($c in $vacias) { Write-Host "        $c" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "   Copiá los valores del .env de la computadora donde ya funciona." -ForegroundColor White
    Write-Host "   Las demás variables son opcionales: sin ellas no salen los correos," -ForegroundColor DarkGray
    Write-Host "   el WhatsApp ni el boton de pago, pero nada se rompe." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "   Cuando las tengas, corré:  npm run dev" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

Ok "Las tres variables obligatorias están completas"

# ── 4. Listo ─────────────────────────────────────────────────────────────────
Titulo "Todo listo"

Write-Host ""
Write-Host "   Arrancá el servidor con:" -ForegroundColor White
Write-Host "     npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Y abrí http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "   Cuentas del personal (contraseña 12345678):" -ForegroundColor DarkGray
Write-Host "     admin@muni.pe  dev@muni.pe  inspector@muni.pe  cajero@muni.pe  cajero2@muni.pe" -ForegroundColor DarkGray
Write-Host ""
Write-Host "   Si la base todavía no tiene las tablas, corré antes:  npm run db:setup" -ForegroundColor DarkGray
Write-Host ""
