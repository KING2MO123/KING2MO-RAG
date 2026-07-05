@echo off
REM Compile puis lance la version DEBUG (avec console) de l'appli.
cd /d "%~dp0.."
set PYTHONOPTIMIZE=

taskkill /f /im KING2MO_Standalone.exe 2>nul
taskkill /f /im KING2MO_Debug.exe 2>nul

python -m PyInstaller --clean --noconfirm KING2MO_Debug.spec
if errorlevel 1 (
    echo BUILD FAILED
    pause
    exit /b 1
)

REM Config + base documentaire pour la version debug
copy /Y backend\.env "dist\.env" >nul
xcopy /E /I /Y backend\chroma_db "dist\chroma_db" >nul

echo.
echo === Lancement en mode debug : les erreurs s'afficheront ci-dessous ===
cd dist
KING2MO_Debug.exe
pause
