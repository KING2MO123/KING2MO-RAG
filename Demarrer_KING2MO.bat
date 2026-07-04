@echo off
title KING2MO - Agentic RAG v3.0
color 0A

echo ===================================================
echo   Lancement de KING2MO - Agentic RAG v3.0
echo ===================================================
echo.

echo [1/3] Demarrage du moteur IA (Backend FastAPI)...
start "KING2MO - Moteur IA" cmd /c "cd backend && uvicorn main:app --port 8000"

echo [2/3] Demarrage de l'interface (Frontend Next.js)...
start "KING2MO - Interface Utilisateur" cmd /c "cd frontend && npm run dev"

echo [3/3] Preparation de l'environnement... patientez quelques secondes.
timeout /t 6 /nobreak >nul

echo.
echo Ouverture de l'application dans votre navigateur web...
start http://localhost:3000

echo.
echo ===================================================
echo KING2MO est en cours d'execution !
echo - Ne fermez pas les deux autres fenetres noires si vous voulez utiliser l'app.
echo - Pour arreter completement l'application, fermez simplement ces fenetres.
echo ===================================================
pause
