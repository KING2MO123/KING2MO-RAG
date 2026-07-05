@echo off
REM Lance l'appli depuis les sources AVEC console pour voir les erreurs en direct
cd /d "%~dp0.."
python backend\main.py
echo.
echo (Serveur arrete)
pause
