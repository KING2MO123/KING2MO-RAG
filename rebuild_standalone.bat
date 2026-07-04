@echo off
REM Rebuild KING2MO_Standalone without docstring-stripping (fixes scipy NameError: 'obj')
cd /d "%~dp0"

REM PYTHONOPTIMIZE=2 strips docstrings and breaks scipy/nltk in the bundle - clear it
set PYTHONOPTIMIZE=

REM PyInstaller >= 6.4 requis pour que optimize=0 du .spec soit respecte
python -m pip install --upgrade "pyinstaller>=6.4"

REM Stoppe une eventuelle instance invisible encore en cours
taskkill /f /im KING2MO_Standalone.exe 2>nul

REM Clean previous build artifacts
rmdir /s /q build 2>nul
rmdir /s /q dist 2>nul

REM Rebuild (spec already has optimize=0). Never invoke with "python -OO".
python -m PyInstaller --clean --noconfirm KING2MO_Standalone.spec

if errorlevel 1 (
    echo.
    echo BUILD FAILED - see errors above.
) else (
    REM Config + base documentaire pre-chargee a cote de l'exe
    copy /Y backend\.env "dist\KING2MO_Standalone\.env" >nul
    xcopy /E /I /Y backend\chroma_db "dist\KING2MO_Standalone\chroma_db" >nul
    echo.
    echo Build OK : lance dist\KING2MO_Standalone\KING2MO_Standalone.exe
)
pause
