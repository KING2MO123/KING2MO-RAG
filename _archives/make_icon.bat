@echo off
REM Genere app.ico + favicon a partir du design K-eclair (option D)
cd /d "%~dp0"
python -m pip install --quiet pillow
python make_icon.py
pause
