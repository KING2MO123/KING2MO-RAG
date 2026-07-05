# Notes de build & durcissement — KING2MO

## Validation avant distribution

En un clic depuis la racine :

```bat
validate.bat
```

Ce script reconstruit le frontend (`frontend/out`) puis lance la suite de tests backend. Équivalent manuel :

```bash
cd frontend && npm install && npm run build
cd ../backend && pip install pytest httpx && pytest -q
```

Ensuite, lancer l'application une fois pour vérifier l'auto-connexion en fenêtre native :

```bash
cd backend && python main.py
```

## Intégration continue

`.github/workflows/ci.yml` exécute automatiquement, à chaque push/PR : les tests backend (`pytest`) et le build frontend (`npm run build`). Les tests dépendant de la fenêtre native sont ignorés en CI (pas d'affichage).

## Chiffrement des secrets au repos (optionnel)

Le token et les clés API restent, par défaut, en clair dans `backend/.env`. C'est le comportement standard et il n'expose rien sur le réseau (cf. C-1). L'exposition résiduelle est un autre processus tournant **sous le même utilisateur** qui lirait le fichier.

Pour durcir ce point, `backend/secure_store.py` fournit un chiffrement **DPAPI Windows** (lié au compte utilisateur, sans dépendance externe) :

```python
from secure_store import protect, unprotect, is_available
```

C'est un utilitaire **opt-in, volontairement non câblé** dans le chemin critique : l'intégrer au flux `.env` doit être fait **puis testé** explicitement (un chiffrement mal géré rendrait la config illisible). Test rapide :

```bash
cd backend && python secure_store.py "mon-secret"
```

## Signature de l'exécutable (à faire côté distributeur)

La signature réduit les alertes SmartScreen/antivirus. Elle **nécessite un certificat de signature de code** (Authenticode) que seul le distributeur possède — elle ne peut donc pas être automatisée ici. Procédure type, après le build PyInstaller (`scripts/build_standalone.bat`) :

```bat
REM Avec un certificat .pfx :
signtool sign /fd SHA256 /f mon_certificat.pfx /p MOT_DE_PASSE ^
  /tr http://timestamp.digicert.com /td SHA256 ^
  "dist\KING2MO_Standalone\KING2MO_Standalone.exe"
```

`signtool` fait partie du Windows SDK. Pour un certificat stocké dans le magasin Windows, remplacer `/f /p` par `/n "Nom du sujet"`. Toujours horodater (`/tr`) pour que la signature reste valide après expiration du certificat.
