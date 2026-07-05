# Spécifications — Découpage de `backend/main.py`

**Contexte :** `main.py` (~1150 lignes) mélange trois métiers : serveur d'API, gestion de config/token, et lanceur desktop pywebview. On le découpe en modules, en gardant `main.py` comme **racine de composition** (crée l'app, inclut les routers, monte le statique, lance le desktop).

## ⚠ Cette passe est plus risquée que le frontend — lire avant de coder

- **Circular imports :** tous les routers dépendent de `require_token` et de l'état de config. Mettre les helpers partagés dans des modules *feuilles* (`config.py`, `security.py`) qui n'importent RIEN des routers. Les routers importent depuis ces feuilles, jamais l'inverse.
- **État global partagé :** le sémaphore `_chat_semaphore`, `_chat_timestamps`, `_spend_today/_spend_day`, et les fonctions `_check_rate_limit/_check_spend_cap/_record_spend` doivent vivre dans **un seul** module (`security.py`) et être importés par le router chat. Ne pas les dupliquer.
- **Ordre d'initialisation :** `_ensure_backend_token()` doit s'exécuter au chargement de la config, AVANT la création de l'app et l'enregistrement des dépendances. Le garder tôt.
- **Imports paresseux conservés :** les `from crag_engine import ...` / `from vectorstore import ...` **à l'intérieur** des fonctions d'endpoint restent paresseux (c'est voulu pour le démarrage rapide). Ne pas les remonter en tête de module.
- **Le bloc `__main__`** (choix de port, `loading_html`, `webview.create_window/start`, `atexit`, logging rotatif) part dans `desktop.py`, appelé depuis `main.py`.

## Contrat (identique aux vagues frontend)
ZÉRO changement de comportement. Aucune route renommée, aucun statut HTTP changé. **`validate.bat` doit rester vert (18 tests + build)** après CHAQUE étape. Faire **une étape à la fois**, dans l'ordre.

## Layout cible

```
backend/
  config.py        # chemins .env, _ensure_backend_token, _env_file_path, _mask_key, constantes (_PLACEHOLDER_TOKENS, _VALID_PROVIDERS)
  security.py      # require_token + rate-limit (sémaphore, timestamps, spend cap) + _validate_image_base64 + _IMAGE_MAGIC
  routers/
    chat.py        # ChatRequest, HistoryItem, /api/chat (SSE)
    documents.py   # upload_document, get/clear/delete documents, limites d'upload
    conversations.py # _conversations_dir, _atomic_write_json, ConversationSave/Rename, CRUD
    settings.py    # SettingsUpdate, get/post settings, pricing (_DEFAULT_PRICING, /api/pricing)
  desktop.py       # WindowApi, loading_html, port picking, logging rotatif, lancement pywebview + atexit
  main.py          # racine : crée app FastAPI, middlewares (TrustedHost, CORS), monte le statique + 404 + /api/ping, include_router(...), et __main__ -> desktop.launch(app)
```

## Étapes ordonnées

**Étape 1 — `config.py` (feuille, aucun import de router).**
Déplacer : `_env_file_path`, `_PLACEHOLDER_TOKENS`, `_ensure_backend_token`, `_mask_key`, `_VALID_PROVIDERS`. `main.py` importe et appelle `_ensure_backend_token()` tôt. Vérifier `validate.bat`.

**Étape 2 — `security.py` (feuille).**
Déplacer : `require_token`, les globals de rate-limit + `_check_rate_limit`, `_check_spend_cap`, `_record_spend`, le `_chat_semaphore`, et `_validate_image_base64` + `_IMAGE_MAGIC`. Les endpoints feront `Depends(require_token)` en important depuis `security`. Vérifier.

**Étape 3 — Routers, un par un, via `APIRouter()`.**
Pour chacun : créer le module avec `router = APIRouter()`, y déplacer les endpoints (décorateurs `@router.get/post/...` au lieu de `@app....`), et dans `main.py` faire `app.include_router(module.router)`. Ordre suggéré : `conversations` → `settings` → `documents` → `chat` (chat en dernier car le plus gros et dépendant de security). **Vérifier `validate.bat` après CHAQUE router.**

**Étape 4 — `desktop.py`.**
Déplacer `WindowApi`, `loading_html`, le choix de port, le logging rotatif, le lancement pywebview et `atexit`. Exposer une fonction `launch(app)` appelée dans `if __name__ == "__main__":` de `main.py`. La logique « instance déjà lancée » (fichier `.port`) et l'injection `WindowApi(token)` doivent être préservées à l'identique.

**Étape 5 — `main.py` final.**
Ne reste que : création de `app`, middlewares, montage statique + handler 404 + `/api/ping`, `include_router` des 4 routers, et le `__main__`. Objectif : sous ~150 lignes.

## Points de vérification spécifiques (pour le relecteur)
- Le serveur démarre sans `ImportError` / import circulaire.
- Les 18 tests passent SANS modification (ils importent `main` : `main.app`, `main.WindowApi`, `main.ChatRequest`, `main._validate_image_base64`, `main._check_rate_limit`, `main._MAX_CHATS_PER_MINUTE`, `main._DAILY_SPEND_CAP_USD`, `main._chat_timestamps`). ⚠ **Ces symboles doivent rester accessibles via `main`** (ré-exports) OU les tests seront mis à jour pour pointer vers les nouveaux modules. Choisir une approche et la documenter — c'est le point le plus susceptible de casser les tests.
- Aucune route disparue : `/api/chat`, `/api/upload`, `/api/documents` (GET/DELETE + /{filename}), `/api/conversations` (GET/POST/PATCH/DELETE + /{id}), `/api/settings` (GET/POST), `/api/pricing`, `/api/ping`, `/` et le fallback statique.
- Le `TrustedHostMiddleware` et le CORS restent en place.

## Recommandation
Vu le couplage tests↔`main`, l'option la plus sûre est que `main.py` **ré-exporte** les symboles attendus par les tests (`from security import require_token, _check_rate_limit, _validate_image_base64, _MAX_CHATS_PER_MINUTE, _DAILY_SPEND_CAP_USD, _chat_timestamps` ; `from routers.chat import ChatRequest` ; `from desktop import WindowApi`). Ainsi la suite de tests reste inchangée et sert de filet.
