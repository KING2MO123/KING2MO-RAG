# Rapport de session — KING2MO Standalone
**Date : 4 juillet 2026**

## Contexte

Projet **KING2MO** (`agentic_crag_app`) : application RAG agentique (CRAG) avec backend FastAPI + LangGraph + ChromaDB + embeddings sentence-transformers, frontend Next.js exporté en statique, packagée en exe Windows via PyInstaller (`KING2MO_Standalone`). L'exe plantait au lancement.

## Problèmes résolus, dans l'ordre

### 1. Crash scipy (`NameError: name 'obj' is not defined`)
Signature classique d'un bytecode compilé avec optimisation `-OO` (docstrings supprimées, scipy ne le supporte pas). Le `.spec` avait pourtant `optimize=0` : le build avait été fait avec `PYTHONOPTIMIZE=2` dans l'environnement ou un PyInstaller < 6.4 ignorant ce réglage.
**Fix** : `rebuild_standalone.bat` vide `PYTHONOPTIMIZE`, force PyInstaller ≥ 6.4, nettoie et recompile. ✅ Résolu après rebuild.

### 2. Crash uvicorn (`'NoneType' object has no attribute 'isatty'`)
Exe compilé `console=False` → `sys.stdout`/`stderr` sont `None`, le formatter de logs uvicorn plante.
**Fix** : redirection vers `os.devnull` en tête de `main.py` + `log_config=None`. ✅

### 3. « L'appli ne se lance pas »
C'était un serveur invisible sans fenêtre.
**Ajouts dans `main.py`** : journal d'erreurs `king2mo_error.log` à côté de l'exe, détection d'instance déjà lancée (fichier `king2mo.port`), bind sur `127.0.0.1` (évite l'alerte pare-feu) au lieu de `0.0.0.0`.

### 4. « Connexion refusée » (ERR_CONNECTION_REFUSED)
Le bind sur le port 8000 peut échouer via `SystemExit` non capturé (plages de ports réservées Hyper-V/WSL sur Windows).
**Fix** : sélection automatique d'un port libre (8000 → 8080 → 8501 → 3050 → port attribué par l'OS), capture de `BaseException` dans le log, attente du serveur avant d'ouvrir la fenêtre.

### 5. « Ça devait être une application »
L'exe ouvre maintenant une fenêtre dédiée via Edge en mode `--app` (sans barre d'adresse) ; fermer la fenêtre arrête le serveur (`os._exit`). Relancer l'exe rouvre la fenêtre de l'instance existante. Même principe que Discord/Slack : une interface web dans une fenêtre native.

### 6. Mot de passe
Le `.env` (avec `BACKEND_API_TOKEN="admin"`) était dans `backend\` et introuvable par l'exe, qui retombait sur le défaut codé en dur `KING2MO_LOCAL`. Copié dans `dist\` → **mot de passe : `admin`**. Le `.env` apporte aussi les clés DeepSeek/Tavily indispensables au chat.

### 7. « Failed to fetch » puis erreur 401
Résolu : le serveur répondait, il fallait saisir le mot de passe dans la sidebar. ✅ À ce stade, l'appli fonctionnait.

## Audit des défauts + corrections (« corrige tout »)

- **Sécurité** : suppression du mot de passe par défaut codé en dur (le `.env` devient obligatoire) ; routage LLM explicite via `LLM_PROVIDER="deepseek"` (fini l'heuristique par préfixe `sk-` qui envoyait la clé « Gemini » chez DeepSeek sans le dire).
- **Performance** : build converti de « onefile » à « **onedir** » → plus de décompression à chaque lancement, démarrage en secondes. L'appli = dossier `dist\KING2MO_Standalone\`.
- **Persistance** : `chroma_db` vivait dans le dossier temporaire d'extraction (documents perdus à chaque fermeture) → déplacé à côté de l'exe ; base pré-chargée et `.env` copiés automatiquement au build ; profil de la fenêtre Edge déplacé de `%TEMP%` vers `%LOCALAPPDATA%\KING2MO`.
- **Hors-ligne** : `prepare_model.bat` télécharge le modèle d'embeddings dans `models\` et le `.spec` l'embarque → fonctionne sur machine vierge sans internet.
- **Architecture** : `event_stream` passé de générateur async à sync → la génération LLM ne bloque plus la boucle d'événements du serveur.

## Panneau Paramètres (pour distribution)

- **Backend** : `GET/POST /api/settings` (authentifiés) — lecture avec clés masquées, écriture dans le `.env` à côté de l'exe, prise d'effet immédiate sans redémarrage.
- **Frontend** : bouton « Clés API & Fournisseur » dans la sidebar → modal avec choix Gemini/DeepSeek, clé LLM, clé Tavily.

## Fichiers créés / modifiés

**Modifiés** : `backend\main.py`, `backend\crag_engine.py`, `backend\.env`, `KING2MO_Standalone.spec`, `frontend\app\page.tsx`, `rebuild_standalone.bat`.
**Créés** : `rebuild_full.bat` (frontend + exe), `debug_exe.bat` + `KING2MO_Debug.spec` (version console pour diagnostic), `debug_run.bat` (lancement depuis les sources), `prepare_model.bat`, `dist\.env`.

## Reste à faire

1. `prepare_model.bat` (une fois), puis **`rebuild_full.bat`** → appli finale : `dist\KING2MO_Standalone\KING2MO_Standalone.exe`, mot de passe `admin`.
2. Pour distribuer : vider les clés du `.env`, zipper le dossier, prévenir les utilisateurs du clic SmartScreen (« Informations complémentaires » → « Exécuter quand même »).
3. **Régénérer les clés DeepSeek et Tavily** — elles ont circulé en clair.

**Non résolu (hors de portée)** : signature de code de l'exe (certificat payant) et fenêtre 100 % native (pywebview, en option future).

---

# Partie 2 — Suite de la session (même journée)

## 8. Crash chromadb (`No module named 'chromadb.telemetry.product.posthog'`)
Après le rebuild onedir, chromadb chargeait ses modules dynamiquement (invisibles pour PyInstaller).
**Fix** : `collect_all('chromadb')` ajouté aux deux specs (Standalone + Debug) — embarque tous les modules dynamiques **et** les fichiers de migration SQL indispensables. ✅

## 9. Application confirmée fonctionnelle
Capture d'écran à l'appui : fenêtre « KING2MO RAG », réponse RAG en 7,27 s avec 4 sources issues du CV indexé, suivi des coûts ($0.00591), bouton « Clés API & Fournisseur » visible dans la sidebar. 🎉

## 10. Bug d'affichage « Aucun document local »
La liste des documents était chargée au montage, avant la saisie du mot de passe → 401 → liste vide alors que la base contenait des documents.
**Fix** (`page.tsx`) : `useEffect` sur `systemPassword` avec debounce 500 ms — la liste se recharge dès que le mot de passe est saisi ou restauré depuis le stockage local au démarrage.

## 11. Workflow de développement (« lancer les bat perd du temps »)
Cycle rapide établi : **`debug_run.bat`** (backend depuis les sources, erreurs visibles, démarrage en secondes) pour tester ; `npm run build` dans `frontend\` quand l'interface change ; **`rebuild_full.bat` une seule fois à la fin** pour produire l'exe. Note : `npm run dev` (port 3000) est incompatible avec l'API en chemins relatifs du mode standalone.

## 12. Icône de l'application
Processus en trois itérations :
1. Six concepts proposés (éclair, monogramme K2 hexagonal, couronne, constellation, K circuit, livre + étincelle).
2. Raffinement du monogramme en « K2M » — rejeté : l'hexagone vert ressemblait trop au logo Desjardins.
3. Cinq nouvelles pistes sans hexagone (couronnement, émeraude taillée, écusson, K-éclair, sceau royal) → **choix final : le K-éclair** (barre ivoire + éclair émeraude en dégradé formant les bras du K, « 2M » en accent).

**Fichiers produits** :
- `icon.svg` — source vectorielle du design.
- `make_icon.py` + `make_icon.bat` — génèrent `app.ico` (256/128/64/48/32/16 px), `icon_256.png` (aperçu) et remplacent `frontend/app/favicon.ico` (icône de la fenêtre).
- Les deux `.spec` référencent `app.ico` (icône de l'exe dans l'Explorateur et la barre des tâches).

## Reste à faire (mis à jour)
1. `make_icon.bat` → vérifier `icon_256.png`.
2. `rebuild_full.bat` (intègre le correctif documents + le favicon).
3. Avant distribution : vider les clés du `.env`, régénérer les clés DeepSeek/Tavily, zipper `dist\KING2MO_Standalone\`, prévenir du clic SmartScreen.
