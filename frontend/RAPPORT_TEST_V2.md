# Rapport de test QA — v2 (après corrections)

**Projet :** Agentic CRAG App (KING2MO) — backend FastAPI + LangGraph, frontend Next.js
**Date :** 4 juillet 2026
**Type :** re-test après application des correctifs (audit initial : 4 critiques, 7 majeurs, 9 mineurs)
**Méthode :** revue statique complète du code à jour. L'exécution réelle n'a pas pu être faite (environnement d'exécution Linux indisponible) — les constats restent statiques.

---

## Verdict global

**Aucune faille critique ni majeure restante.** Les 4 bugs critiques et les 7 bugs majeurs de l'audit initial sont réglés. Il ne subsiste que du cosmétique, du code mort et des avertissements de lint. L'application est dans un état sain.

| Sévérité | Audit initial | Restant | Statut |
|----------|:-------------:|:-------:|--------|
| 🔴 Critique | 4 | 0 | ✅ Tout réglé |
| 🟠 Majeur | 7 | 0 | ✅ Tout réglé |
| 🟡 Mineur | 9 | 3 optionnels | ⏳ Cosmétique / nettoyage |

---

## 1. Corrections confirmées

### Critiques
- **C1 — Fuite de clé API.** `.streamlit/secrets.toml` supprimé, clés déplacées dans `backend/.env` (chargé via `python-dotenv`). Les clés ne transitent **plus jamais** par le frontend : elles sont lues côté serveur depuis l'environnement. `.env` / `secrets.toml` ignorés par Git.
- **C2 — Gel infini du spinner.** Le frontend vérifie `response.ok` (extraction du détail d'erreur) et un bloc `finally` garantit l'arrêt du chargement, même en réponse non-SSE (401/422/500).
- **C3 — `npm install` cassé.** `lucide-react` corrigé sur une version réelle (`^0.544.0`).
- **C4 — Upload non sécurisé.** Nom de fichier assaini (`os.path.basename`, anti path-traversal), fichier temporaire unique (`uuid`) dans le dossier temp système, validation type PDF + taille (25 Mo), lecture bornée.

### Majeurs
- **M1 — CORS.** Restreint aux origines explicites (`http://localhost:3000`, `127.0.0.1:3000`), configurable via `ALLOWED_ORIGINS`.
- **M2 — Endpoints non protégés.** Authentification **obligatoire** par en-tête `X-API-Token` sur `/api/chat`, `/api/upload`, `/api/documents` (GET + DELETE). Le frontend envoie le token (mot de passe) sur tous les appels ; sans token configuré côté serveur, l'API répond 500 volontairement.
- **M3 — Auto-correction inefficace.** Sur échec de la réponse, le graphe déclenche désormais une **recherche web fraîche** (via `decide_after_correction`) avant de régénérer, au lieu de répéter une génération identique.
- **M4 — Comptage de coûts faussé.** `grade_generation` est devenu un **vrai nœud** du graphe qui retourne l'état (grade + tokens) ; les tokens des évaluateurs sont maintenant correctement comptabilisés.
- **M5 — Rendu Markdown cassé.** Composant `code` adapté à react-markdown v10 (détection de bloc via la classe `language-*`, sans la prop `inline` supprimée).
- **M6 — Fichier temporaire non nettoyé.** Suppression du temp dans un bloc `finally`.
- **M7 — Trop d'appels LLM séquentiels.** `grade_documents` utilise désormais `chain.batch()` : les documents sont évalués en parallèle au lieu d'un appel par document.

### Mineurs réglés
- **m1** — Lecture de `localStorage` encapsulée dans des `try/catch` (plus d'écran blanc sur donnée corrompue).
- **m2** — Historique de coûts borné à 100 entrées.
- **m3** — Déduplication à l'upload : un document déjà présent renvoie un statut `warning` (affiché ⚠️, plus en erreur rouge).
- **m4** — Messages d'erreur basés sur le vrai détail HTTP.
- **m5** — URL backend via `NEXT_PUBLIC_API_URL` (`API_BASE`), plus de `localhost:8000` en dur.

### Dépendances (ajoutées lors du re-test)
- `python-dotenv` — requis par `load_dotenv()` (sinon crash au démarrage).
- `python-multipart` — requis par FastAPI pour l'upload de fichiers (sinon échec de tout upload).

---

## 2. Problèmes restants (mineurs, non bloquants)

### R1 — `web_used` cosmétique
Dans `grade_documents`, le retour anticipé lorsqu'aucun document n'est récupéré force `web_search="yes"` sans appliquer l'exception du mode « local ». En mode local sans document, l'UI peut afficher « Web : Oui » alors qu'aucune recherche web n'a réellement eu lieu. Impact : affichage uniquement.

### R2 — Code mort / avertissements de lint
- État `chartMode` / `setChartMode` défini mais jamais utilisé.
- Imports inutilisés : `Eye`, `EyeOff`, `Key` (frontend, depuis la suppression de `showKeys`) ; `Request` (`main.py`).
- `streamlit` encore listé dans `requirements.txt` alors que l'interface est en Next.js.
- Logique `temp_` résiduelle dans `get_documents` / `delete_document` (les uploads utilisent désormais le nom assaini directement).

### R3 — Points optionnels non traités (déjà signalés)
- Erreurs de parsing SSE avalées silencieusement (`catch {}`).
- Boutons icône sans `aria-label` (accessibilité).
- Fichiers obsolètes à supprimer : `old_streamlit_app.py`, dossier `chroma_db/` à la racine (doublon de `backend/chroma_db/`).

---

## 3. À faire pour lancer l'application (setup, pas des bugs)

1. Créer `backend/.env` à partir de `.env.example` : renseigner `BACKEND_API_TOKEN`, `GEMINI_API_KEY`, et `TAVILY_API_KEY` (optionnel).
2. Saisir dans l'interface (champ « Mot de passe ») **exactement** la même valeur que `BACKEND_API_TOKEN`.
3. `pip install -r backend/requirements.txt` (nouvelles dépendances).
4. `npm install` dans `frontend/` (version de `lucide-react` modifiée).
5. Démarrer le backend **depuis le dossier `backend/`** (`uvicorn main:app`) pour que `load_dotenv()` trouve le `.env`, puis `npm run dev` côté frontend.

---

## 4. Conclusion

Le projet est passé de **11 problèmes critiques/majeurs** à **0**. Les correctifs sont cohérents entre backend et frontend (auth de bout en bout, clés côté serveur, gestion d'erreurs robuste). Reste uniquement du nettoyage cosmétique optionnel.

**Réserve :** tous les constats sont issus d'une revue statique ; une validation en exécution réelle (lancer l'app, envoyer une requête, uploader un PDF, tester un mauvais mot de passe) reste recommandée pour confirmer le comportement runtime.
