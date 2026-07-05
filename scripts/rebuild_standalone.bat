@echo off
REM ============================================================
REM  Rebuild complet KING2MO_Standalone (frontend + backend exe)
REM  1. Recompile le frontend Next.js (frontend\out)
REM  2. Recompile l'exe PyInstaller
REM  3. Genere un .env PROPRE pour la distribution (pas de cles !)
REM ============================================================
cd /d "%~dp0.."

REM --- 1. FRONTEND -------------------------------------------------
echo [1/3] Compilation du frontend Next.js...
cd frontend
call npm run build
if errorlevel 1 (
    echo.
    echo BUILD FRONTEND ECHOUE - voir les erreurs ci-dessus.
    pause
    exit /b 1
)
cd ..

REM --- 2. BACKEND / EXE --------------------------------------------
REM PYTHONOPTIMIZE=2 strips docstrings and breaks scipy/nltk in the bundle - clear it
set PYTHONOPTIMIZE=

REM PyInstaller >= 6.4 requis pour que optimize=0 du .spec soit respecte
python -m pip install --upgrade "pyinstaller>=6.4"

REM Stoppe une eventuelle instance invisible encore en cours
taskkill /f /im KING2MO_Standalone.exe 2>nul

REM Clean previous build artifacts
rmdir /s /q build 2>nul
rmdir /s /q dist 2>nul

echo [2/3] Compilation de l'executable...
REM Rebuild (spec already has optimize=0). Never invoke with "python -OO".
python -m PyInstaller --clean --noconfirm KING2MO_Standalone.spec

if errorlevel 1 (
    echo.
    echo BUILD FAILED - see errors above.
    pause
    exit /b 1
)

REM --- 3. CONFIG DE DISTRIBUTION -----------------------------------
echo [3/3] Generation du .env propre pour la distribution...
REM SECURITE : on ne copie PAS backend\.env (il contient VOS cles API
REM et VOTRE token). On genere un .env neutre : le token "changez_moi_svp"
REM est un placeholder que l'application remplace automatiquement par un
REM token aleatoire au premier lancement sur la machine de destination.
(
echo BACKEND_API_TOKEN="changez_moi_svp"
echo LLM_PROVIDER="gemini"
echo GEMINI_API_KEY=""
echo TAVILY_API_KEY=""
) > "dist\KING2MO_Standalone\.env"

REM Base documentaire pre-chargee (optionnel) : commentez la ligne suivante
REM si vous ne voulez PAS distribuer vos documents locaux avec l'appli.
xcopy /E /I /Y backend\chroma_db "dist\KING2MO_Standalone\chroma_db" >nul

echo.
echo ============================================================
echo Build OK : dist\KING2MO_Standalone\KING2MO_Standalone.exe
echo Le dossier dist\KING2MO_Standalone est pret a etre partage.
echo ============================================================
pause
