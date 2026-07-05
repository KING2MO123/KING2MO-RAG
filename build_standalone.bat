@echo off
echo Construction du Frontend (Next.js)...
cd frontend
cmd /c npm run build
cd ..

echo.
echo Construction de l'executable Monolithe (PyInstaller)...
cmd /c pyinstaller --onefile --windowed --name "KING2MO_Standalone" --icon=app.ico --add-data "frontend/out;frontend_out" --collect-all scipy --hidden-import scipy.special._cdflib backend\main.py

echo.
echo =======================================
echo Compilation terminee !
echo L'executable se trouve dans le dossier 'dist'.
echo =======================================
pause
