@echo off
setlocal
cd /d "%~dp0"

echo.
echo   SOLYD // LABS  -  plataforma local de treinamento ofensivo
echo   ---------------------------------------------------------
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo   [ERRO] Python nao encontrado no PATH.
  echo   Instale em https://www.python.org/downloads/ e marque "Add python.exe to PATH".
  echo.
  pause
  exit /b 1
)

echo   [1/3] Verificando dependencias...
python -c "import importlib.metadata as m, sys; sys.exit(0 if int(m.version('flask').split('.')[0]) >= 3 else 1)" >nul 2>nul
if errorlevel 1 (
  echo         Flask ausente ou antigo. Instalando...
  python -m pip install --disable-pip-version-check -r requirements.txt
  if errorlevel 1 (
    echo   [ERRO] Falha ao instalar as dependencias.
    pause
    exit /b 1
  )
)

echo   [2/3] Preparando aplicacoes-alvo...
python -c "import lab_targets" >nul 2>nul

echo   [3/3] Subindo o servidor em http://127.0.0.1:5000
echo.
echo   Dica: use CTRL+C para encerrar. Tudo roda apenas na sua maquina.
echo.
python -X utf8 app.py

echo.
echo   Servidor encerrado.
pause
