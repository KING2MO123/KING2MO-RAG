@echo off
REM ============================================================
REM  KING2MO - Validation en un clic
REM  1) Reconstruit le frontend statique (frontend\out)
REM  2) Lance la suite de tests backend (pytest)
REM  A executer depuis la racine du projet.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo ===== [1/2] Build du frontend (npm run build) =====
pushd frontend
call npm install
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail
popd

echo.
echo ===== [2/2] Tests backend (pytest) =====
pushd backend
python -m pip install pytest httpx >nul 2>&1
python -m pytest -q
if errorlevel 1 goto :fail_tests
popd

echo.
echo ===== OK : build reussi et tests passes. =====
echo Vous pouvez lancer l'application : cd backend ^&^& python main.py
goto :end

:fail
echo.
echo !!! Echec du build frontend. Corrigez les erreurs ci-dessus. !!!
popd
exit /b 1

:fail_tests
echo.
echo !!! Des tests ont echoue. Voir le detail ci-dessus. !!!
popd
exit /b 1

:end
endlocal
