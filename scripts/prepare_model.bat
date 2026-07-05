@echo off
REM Telecharge le modele d'embeddings et le place dans models\ pour
REM qu'il soit embarque dans l'exe (fonctionnement hors-ligne).
REM A lancer UNE FOIS avant rebuild_standalone.bat.
cd /d "%~dp0.."
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2').save('models/all-MiniLM-L6-v2')"
if errorlevel 1 (
    echo ECHEC - verifie ta connexion internet.
) else (
    echo Modele pret dans models\all-MiniLM-L6-v2 : il sera inclus au prochain build.
)
pause
