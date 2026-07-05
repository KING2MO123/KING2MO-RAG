# SPECS — Correctifs UX Paramètres (vague 7)

**Auteur :** Claude (relecteur) · **Date :** 2026-07-05
**Contexte :** deux bugs constatés en usage réel par l'utilisateur, plus deux améliorations mineures. Le premier a produit une erreur bloquante en production locale (`404 models/ornith is not found`).

**Règles habituelles :** un seul rédacteur de code (Antigravity). Changements de comportement VOULUS ici (ce n'est plus du refactoring), mais périmètre strict : ne toucher qu'aux fichiers listés. Ne PAS toucher au flux SSE, ni à `crag_engine.py`, ni à `desktop.py`. `validate.bat` vert exigé. Rapport à déposer : `rapport_vague7.md` dans `C:\Users\diaba\Downloads\reglage dette technique`.

---

## U-1 — BUG : `LLM_MODEL` obsolète après changement de fournisseur (priorité haute)

### Symptôme constaté
L'utilisateur avait configuré un modèle personnalisé (`LLM_MODEL="ornith"` via Ollama/custom), puis est repassé sur Google Gemini dans les Paramètres. Au chat suivant : `404 NOT_FOUND models/ornith`.

### Cause racine
- `page.tsx` (`saveSettings`) n'envoie `llm_model` QUE si le fournisseur est `custom` ou `ollama`. En repassant sur `gemini`, la variable `LLM_MODEL` du `.env` n'est jamais réécrite.
- `resolve_model()` (crag_engine) donne — à juste titre, c'est le correctif H-1 — priorité à `LLM_MODEL` sur le défaut. Le nom de modèle Ollama fuit donc vers l'API Gemini.

### Correctif demandé

**Backend (`routers/settings.py`) :** distinguer « champ absent » de « champ vide ».
- Aujourd'hui `llm_model: None` et `llm_model: ""` sont tous deux ignorés. Nouveau contrat :
  - `None` (absent) → inchangé (comportement actuel) ;
  - `""` (chaîne vide explicite) → **supprimer** `LLM_MODEL` : retirer la clé du `.env` réécrit ET faire `os.environ.pop("LLM_MODEL", None)`.
- Attention au piège : la boucle actuelle de réécriture du `.env` préserve toutes les clés existantes ; il faut retirer la clé de `values`/`order` avant écriture, pas seulement ne pas l'ajouter.

**Frontend (`page.tsx` et/ou `SettingsModal.tsx`) :**
- Afficher le champ « Modèle » aussi pour `gemini` et `gemini-openai` (placeholder : `gemini-2.5-flash (défaut si vide)`). C'est cohérent avec H-1 : l'utilisateur doit pouvoir choisir `gemini-2.5-pro`.
- À l'enregistrement :
  - fournisseur `gemini` / `gemini-openai` / `custom` / `ollama` → envoyer `llm_model` avec le contenu du champ, **ou `""` si le champ est vide** (ce qui purge un modèle obsolète) ;
  - fournisseur `deepseek` → envoyer `llm_model: ""` (le modèle est codé en dur `deepseek-chat`, toute valeur résiduelle est du bruit).
- À l'ouverture des Paramètres, préremplir le champ avec `data.llm_model` (déjà retourné par `GET /api/settings`).

### Test exigé (pytest, `backend/tests/test_api.py`)
Nouveau test : POST `/api/settings` avec `{"llm_model": ""}` → vérifier que `LLM_MODEL` disparaît de `os.environ` et du `.env`. Utiliser `tmp_path`/monkeypatch pour ne pas écraser le vrai `.env` (patcher `_env_file_path`). Ajouter aussi le cas nominal : `{"llm_model": "gemini-2.5-pro"}` → présent.

---

## U-2 — Suppression d'une clé API depuis l'interface (priorité moyenne)

### Constat
« Laisser vide = inchangée » est un bon garde-fou, mais il n'existe AUCUN moyen de supprimer une clé sans éditer `backend\.env` à la main.

### Correctif demandé

**Backend (`routers/settings.py`) :** ajouter à `SettingsUpdate` deux booléens optionnels :
- `clear_llm_key: Optional[bool] = None` → si `True`, supprimer `GEMINI_API_KEY` (`.env` + `os.environ.pop`) ;
- `clear_tavily_key: Optional[bool] = None` → idem pour `TAVILY_API_KEY`.
- Priorité : si `clear_*` ET une nouvelle valeur sont fournis dans la même requête, la **nouvelle valeur gagne** (le clear est ignoré).

**Frontend :** à côté de « Clé LLM actuelle : xxx…xxx », un petit bouton/lien « Supprimer » (icône poubelle), avec confirmation **inline** (pas de `window.confirm`, peu fiable en WebView2 — même leçon que R-3 : afficher « Confirmer la suppression ? [Oui] [Non] » dans le modal). Après suppression : rafraîchir le message (« Aucune clé LLM configurée. ») et rappeler `checkApiKey()` pour que la bannière R-8 réapparaisse si nécessaire. Idem pour Tavily si une clé est configurée.

### Test exigé
POST `/api/settings` avec `{"clear_llm_key": true}` → `GEMINI_API_KEY` absent de l'env et du `.env` (même technique d'isolation que U-1). Et le cas de priorité : `{"clear_llm_key": true, "gemini_api_key": "nouvelle"}` → la clé vaut `nouvelle`.

---

## U-3 — Avertissement de cohérence clé/fournisseur (priorité basse, frontend seul)

Constat réel : une clé `sk-…` (format OpenAI/DeepSeek) était en place avec le fournisseur Gemini — aucune alerte, l'erreur ne sort qu'au premier chat.

Correctif : à la saisie d'une clé dans le champ, avertissement **non bloquant** (texte discret sous le champ, pas de blocage de l'enregistrement) :
- fournisseur `gemini`/`gemini-openai` et clé commençant par `sk-` → « ⚠️ Cette clé ressemble à une clé OpenAI/DeepSeek, pas Google. » ;
- fournisseur `deepseek` et clé commençant par `AIza` → avertissement symétrique.
- Ne JAMAIS bloquer : les formats de clés évoluent, l'heuristique doit rester un simple indice. Pas d'autre préfixe à tester.

---

## U-4 — Cosmétique (priorité basse, avec U-3)

- Titre du modal : « Paramètres API » → « Paramètres » (il contient des réglages de comportement, pas seulement d'API).
- Alignement des cases à cocher : la case doit être alignée sur la première ligne du libellé (ex. `align-items: flex-start` + léger `margin-top` sur la case), pas flotter au milieu du pavé multi-lignes.

---

## Ordre et validation

1. U-1 (avec ses tests) → `validate.bat` vert.
2. U-2 (avec ses tests) → `validate.bat` vert.
3. U-3 + U-4 (frontend seul) → `npm run build` vert.
4. Rapport `rapport_vague7.md` : liste de ce qui a été fait, fichiers touchés, ET ce qui n'a pas été fait. **Pas de déclaration « tout est testé/stable » sans exécution réelle de `validate.bat`.**

Vérification indépendante par Claude ensuite, comme d'habitude : le code réel fera foi, pas le rapport.

## Note pour l'utilisateur (hors périmètre Antigravity)
En attendant U-1, le contournement manuel reste : éditer `backend\.env`, supprimer la ligne `LLM_MODEL="ornith"`, relancer l'application.
