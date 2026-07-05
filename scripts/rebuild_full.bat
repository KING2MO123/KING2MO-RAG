@echo off
REM Rebuild COMPLET : frontend (Next.js) puis exe (PyInstaller).
REM A utiliser quand l'interface a change (ex: panneau Parametres API).
cd /d "%~dp0.."
cd frontend
call npm run build
if errorlevel 1 (
    echo BUILD FRONTEND FAILED
    pause
    exit /b 1
)
cd ..
call rebuild_standalone.bat
