# Rapport de session — Audit QA & corrections (KING2MO / Agentic CRAG App)

**Date :** 4 juillet 2026
**Périmètre :** backend FastAPI + moteur LangGraph (`crag_engine.py`, `main.py`), frontend Next.js (`page.tsx`), scripts de seed et configuration.
**Déroulé :** (1) test en tant que testeur QA → rapport des bugs ; (2) correction des bugs critiques et majeurs + correctifs mineurs rapides.

> ⚠️ **Limite de la session :** l'environnement d'exécution Linux (sandbox) n'a jamais démarré (erreur `EXDEV` côté machine). Tout a donc été fait en **revue statique** : aucune exécution réelle de l'app ni de tests runtime. Les correctifs doivent être re-validés en lançant l'app.

---

## Partie 1 — Ce qui a été testé / analysé

Revue complète des fichiers du projet :
- `backend/main.py` — API FastAPI (chat SSE, upload, gestion des documents).
- `backend/crag_engine.py` — pipeline LangGraph (contextualize → route → retrieve → grade → web → generate → self-check).
- `backend/seed_data.py`, `backend/seed_handbook.py` — initialisation ChromaDB.
- `frontend/app/page.tsx` — interface complète (chat, sidebar, dashboard coûts, upload).
- `frontend/app/layout.tsx`, `package.json`, `next.config.ts`, `.streamlit/*`, `.gitignore`.

**Bilan chiffré du rapport initial :** 4 bugs critiques, 7 majeurs, 9 mineurs. Détail complet dans `RAPPORT_TEST_QA.md`.

---

## Partie 2 — Bugs identifiés et statut

### 🔴 Critiques

| ID | Problème | Statut |
|----|----------|--------|
| C1 | Clé API DeepSeek réelle en clair et versionnée dans `.streamlit/secrets.toml` (non exclue par `.gitignore`) | ✅ Corrigé |
| C2 | Requêtes qui gèlent indéfiniment (spinner infini) quand une clé requise est vide → réponse 422 non-SSE non gérée | ✅ Corrigé |
| C3 | `lucide-react: "^1.23.0"` — version inexistante, casse `npm install` | ✅ Corrigé |
| C4 | Upload non sécurisé : nom de fichier client utilisé tel quel (path traversal), aucune validation type/taille serveur | ✅ Corrigé |

### 🟠 Majeurs

| ID | Problème | Statut |
|----|----------|--------|
| M1 | CORS `allow_origins=["*"]` + `allow_credentials=True` (combinaison invalide/non sécurisée) | ✅ Corrigé |
| M2 | Endpoints destructifs (suppression totale de la base) sans aucune authentification | ✅ Corrigé (auth optionnelle) |
| M3 | « Auto-correction » qui ne corrige rien (relance une génération identique) | ✅ Corrigé |
| M4 | Comptage de tokens/coûts faussé (mutation d'état in-place dans un edge conditionnel) | ✅ Corrigé |
| M5 | Rendu du code Markdown cassé (prop `inline` supprimée dans react-markdown v10) | ✅ Corrigé |
| M6 | Fichier temporaire d'upload non nettoyé en cas d'erreur | ✅ Corrigé |
| M7 | Latence/coût élevés : jusqu'à ~10 appels LLM séquentiels par requête | ⏳ Non traité (optimisation) |

### 🟡 Mineurs

| ID | Problème | Statut |
|----|----------|--------|
| m1 | `localStorage` parsé sans `try/catch` → écran blanc possible | ✅ Corrigé |
| m2 | Historique de coûts jamais purgé (saturation localStorage) | ✅ Corrigé (borné à 100) |
| m3 | Doublons de documents à l'upload (pas de déduplication) | ⏳ Non traité |
| m4 | Messages d'erreur trompeurs (« erreur de connexion » pour une 422) | ✅ Corrigé |
| m5 | URL backend `localhost:8000` codée en dur | ✅ Corrigé (`NEXT_PUBLIC_API_URL`) |
| m6 | Overlay Dashboard légèrement désaligné (320px vs 300px) | ⏳ Non traité |
| m7 | Erreurs de parsing SSE silencieuses (`catch {}`) | ⏳ Non traité |
| m8 | Boutons icône sans `aria-label` (accessibilité) | ⏳ Non traité |
| m9 | Code mort (`old_streamlit_app.py`, `chroma_db/` racine, `.streamlit/`) | ⏳ Non traité |

---

## Partie 3 — Détail des corrections appliquées

### `.streamlit/secrets.toml` + `.gitignore` (C1)
Clés vidées + commentaire d'avertissement. Ajout de `.streamlit/secrets.toml` au `.gitignore`.
**Action restante à ta charge :** révoquer la clé DeepSeek exposée chez le fournisseur et la purger de l'historique Git (`git filter-repo` / BFG).

### `frontend/package.json` (C3)
`lucide-react` : `^1.23.0` → `^0.544.0`. Nécessite un `npm install` pour prendre effet.

### `backend/main.py` (C4, M1, M2, M6)
- **CORS** limité à `http://localhost:3000`, configurable via `ALLOWED_ORIGINS`.
- **Auth optionnelle** : dépendance `require_token` vérifiant l'en-tête `X-API-Token` uniquement si `BACKEND_API_TOKEN` est défini (dev local inchangé). Appliquée à `/api/upload`, `DELETE /api/documents`, `DELETE /api/documents/{filename}`.
- **Upload sécurisé** : nom assaini via `os.path.basename` (anti path-traversal), fichier temporaire unique (`uuid`) dans le dossier temp système, validation extension `.pdf` + type MIME, limite de taille (25 Mo, `MAX_UPLOAD_MB`), lecture bornée, nettoyage du temp dans un bloc `finally`.

### `backend/crag_engine.py` (M3, M4)
- **M4** : `grade_generation` transformé en **vrai nœud** du graphe qui retourne un état (`generation_grade` + tokens) au lieu de muter l'état en place → le coût des évaluateurs est désormais correctement remonté. Nouvelle fonction de routage `route_generation`.
- **M3** : nouvelle fonction `decide_after_correction` — sur échec de la réponse, si le mode l'autorise et qu'aucune recherche web n'a encore eu lieu, le graphe déclenche une **recherche web fraîche** avant de régénérer (au lieu de répéter une génération identique). Champ `generation_grade` ajouté au `GraphState` et à `initial_state`.

### `frontend/app/page.tsx` (C2, M5, m1, m2, m4, m5)
- **C2** : vérification de `response.ok` (extraction du détail d'erreur backend), et bloc `finally` garantissant l'arrêt du spinner même si le flux se termine sans événement `result`/`error`.
- **M5** : composant `code` de react-markdown adapté à la v10 (détection d'un bloc via la classe `language-*`, sans la prop `inline`).
- **m1** : lecture de `localStorage` (`rag_history`, `rag_cost_history`) encapsulée dans des `try/catch` avec réinitialisation en cas d'entrée corrompue.
- **m2** : historique de coûts borné à 100 entrées (`MAX_COST_HISTORY`).
- **m4** : message d'erreur affiché basé sur le vrai détail HTTP.
- **m5** : constante `API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`, appliquée à tous les appels (`/api/chat`, `/api/upload`, `/api/documents`…).

---

## Partie 4 — À faire de ton côté

1. **Révoquer** la clé DeepSeek exposée + la purger de l'historique Git.
2. **`npm install`** dans `frontend/` (changement de version `lucide-react`).
3. **Lancer et tester** l'app (backend `uvicorn` + `npm run dev`) pour valider les correctifs en conditions réelles — non fait faute d'environnement d'exécution.
4. **Vérifier `page.tsx`** : ton éditeur (Antigravity) modifiait ce fichier en direct pendant les corrections ; s'assurer qu'aucune modification n'a été écrasée.
5. Optionnel : traiter les points restants (M7 perf, m3 dédup, m6 alignement, m8 accessibilité, m9 code mort).

---

## Fichiers produits

- `RAPPORT_TEST_QA.md` — rapport d'audit détaillé (tous les bugs, avec pistes de correction).
- `RAPPORT_SESSION.md` — ce document (synthèse audit + corrections).

## Fichiers modifiés

- `.streamlit/secrets.toml`
- `.gitignore`
- `frontend/package.json`
- `frontend/app/page.tsx`
- `backend/main.py`
- `backend/crag_engine.py`
