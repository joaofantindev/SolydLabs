# SOLYD // LABS
#
# Sobe a plataforma local de treinamento (Flask) e abre o navegador.
# Uso:  powershell -ExecutionPolicy Bypass -File .\run.ps1
#       powershell -ExecutionPolicy Bypass -File .\run.ps1 -NoBrowser
#       powershell -ExecutionPolicy Bypass -File .\run.ps1 -Port 8000

param(
  [int]$Port = 5000,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "  SOLYD // LABS  -  plataforma local de treinamento ofensivo" -ForegroundColor Red
Write-Host "  ---------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# 1) Python
$python = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $python) {
  Write-Host "  [ERRO] Python nao encontrado no PATH." -ForegroundColor Red
  Write-Host "  Instale em https://www.python.org/downloads/ e marque 'Add python.exe to PATH'." -ForegroundColor DarkGray
  exit 1
}

# 2) Dependencias
Write-Host "  [1/3] Verificando dependencias..." -ForegroundColor DarkGray
$flaskOk = $false
try {
  python -c "import importlib.metadata as m, sys; sys.exit(0 if int(m.version('flask').split('.')[0]) >= 3 else 1)" 2>$null
  if ($LASTEXITCODE -eq 0) { $flaskOk = $true }
} catch { }

if (-not $flaskOk) {
  Write-Host "         Flask ausente ou antigo. Instalando..." -ForegroundColor Yellow
  python -m pip install --disable-pip-version-check -r requirements.txt
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERRO] Falha ao instalar as dependencias." -ForegroundColor Red
    exit 1
  }
}

# 3) Bootstrap dos alvos (SQLite/Papiro)
Write-Host "  [2/3] Preparando aplicacoes-alvo..." -ForegroundColor DarkGray
python -c "import lab_targets"
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [ERRO] Falha ao preparar os alvos." -ForegroundColor Red
  exit 1
}

# 4) Servidor
$env:PORT = "$Port"
$env:PYTHONUTF8 = "1"
Write-Host "  [3/3] Subindo o servidor em http://127.0.0.1:$Port" -ForegroundColor Green
Write-Host ""
Write-Host "  CTRL+C encerra. Tudo roda apenas na sua maquina." -ForegroundColor DarkGray
Write-Host ""

if ($NoBrowser) {
  $env:SOLYD_NO_BROWSER = "1"
} else {
  Remove-Item Env:\SOLYD_NO_BROWSER -ErrorAction SilentlyContinue
}

python -X utf8 app.py
