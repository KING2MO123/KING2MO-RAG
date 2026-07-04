# Rapport de test QA — Agentic CRAG App (KING2MO)

**Date :** 4 juillet 2026
**Périmètre :** backend FastAPI + moteur LangGraph (`crag_engine.py`, `main.py`), frontend Next.js (`page.tsx`), scripts de seed, configuration.
**Méthode :** revue statique approfondie du code. Le test dynamique en exécution réelle n'a pas pu être réalisé (environnement d'exécution Linux indisponible sur la machine au moment du test). Les bugs marqués **[à confirmer en runtime]** sont déduits de la lecture du code et devraient être re-vérifiés une fois l'app lancée.

---

## Synthèse

| Sévérité | Nombre | Résumé |
|----------|--------|--------|
| 🔴 Critique | 4 | Clé API réelle exposée dans le repo, requêtes qui gèlent indéfiniment sans clé Tavily/Gemini, écriture de fichier non sécurisée, dépendance introuvable qui casse `npm install`. |
| 🟠 Majeur | 7 | CORS mal configuré, endpoints sans authentification, auto-correction non fonctionnelle, comptage de coûts faussé, code Markdown cassé (react-markdown v10). |
| 🟡 Mineur | 9 | Fuites de fichiers temporaires, doublons de documents, localStorage non protégé, alignements UI, code mort. |

Les deux problèmes à traiter **en priorité absolue** : la clé DeepSeek en clair dans `.streamlit/secrets.toml` (elle est versionnée dans Git), et le fait que l'app **se fige pour toujours** quand une clé requise est vide.

---

## 🔴 Bugs critiques

### C1 — Clé API réelle exposée et versionnée dans Git
`/.streamlit/secrets.toml` contient une clé en clair :
```
GEMINI_API_KEY = "sk-971ff8b59914496591e4e7aa25cdb91e"
```
Le `.gitignore` ignore `.env` mais **pas** `.streamlit/secrets.toml` — le fichier est donc suivi par Git et poussé avec le code. La clé (format `sk-`, donc DeepSeek d'après la logique de `get_llm`) est compromise.

**À faire :** révoquer immédiatement cette clé, la retirer de l'historique Git (`git filter-repo` / BFG), et ajouter `.streamlit/secrets.toml` au `.gitignore`.

### C2 — L'application se fige indéfiniment si une clé requise est vide
Dans `main.py`, `ChatRequest` impose `gemini_key` et `tavily_key` comme **obligatoires non vides** :
```python
gemini_key: str = Field(..., min_length=1)
tavily_key: str = Field(..., min_length=1)
```
Or le frontend envoie `tavily_key: ""` par défaut (aucune clé Tavily saisie). FastAPI renvoie alors une **422** dont le corps est du JSON classique, pas du SSE. Côté `page.tsx`, le code lit le flux sans vérifier `response.ok` ; aucune ligne `data: ` n'est trouvée, donc ni l'événement `result` ni `error` n'arrive, et **`setLoading(false)` n'est jamais appelé**. Résultat : le message assistant tourne (spinner) à l'infini.

Même symptôme si l'utilisateur n'a saisi aucune clé Gemini, ou pour toute réponse non-SSE du backend (500, etc.).

**À faire :** rendre `tavily_key` optionnel (défaut `""`), vérifier `response.ok` côté frontend et afficher une erreur claire, et garantir `setLoading(false)` dans un bloc `finally`.

### C3 — Dépendance `lucide-react` introuvable → `npm install` casse
`frontend/package.json` déclare `"lucide-react": "^1.23.0"`. Cette version n'existe pas (lucide-react est publié en `0.x`). L'installation échouera ou récupérera un paquet inattendu, empêchant le build du frontend.

**À faire :** corriger vers une version réelle, par ex. `"lucide-react": "^0.5xx"` (dernière stable).

### C4 — Écriture de fichier non sécurisée à l'upload (path traversal + type non validé)
Dans `/api/upload` :
```python
temp_file = f"temp_{file.filename}"
with open(temp_file, "wb") as buffer: ...
```
Le nom de fichier vient directement du client. Un nom comme `../../config` permet d'écrire hors du dossier de travail. De plus, aucune validation serveur du type de fichier (seul le frontend vérifie `application/pdf`) ni de la taille — un appel direct à l'API peut envoyer n'importe quoi, sans limite.

**À faire :** assainir le nom (`os.path.basename` + slug), valider l'extension/type et la taille côté serveur, écrire dans un dossier temp dédié (`tempfile`).

---

## 🟠 Bugs majeurs

### M1 — CORS mal configuré (wildcard + credentials)
```python
allow_origins=["*"], allow_credentials=True
```
Combinaison invalide/non sécurisée : les navigateurs rejettent les credentials avec un wildcard, et exposer `*` est une mauvaise pratique. **À faire :** lister explicitement l'origine du frontend (`http://localhost:3000`) et ne garder `allow_credentials` que si nécessaire.

### M2 — Aucune authentification sur les endpoints destructifs
`DELETE /api/documents` vide toute la base vectorielle, `DELETE /api/documents/{filename}` supprime un document, `/api/upload` ajoute du contenu — le tout **sans aucune authentification**. N'importe qui ayant accès au port 8000 peut tout effacer. **À faire :** ajouter une auth (au minimum un token), surtout avant tout déploiement.

### M3 — L'« auto-correction » ne corrige rien
Dans le graphe, quand une réponse échoue au contrôle (`not supported` / `not useful`), `_bump_corrections` **incrémente juste un compteur** puis relance `generate` avec exactement les mêmes documents, la même question et la même température. Aucune nouvelle recherche ni reformulation n'est déclenchée. La génération produira quasi la même réponse et échouera à nouveau jusqu'à `MAX_CORRECTIONS`, consommant des appels LLM (donc du coût et de la latence) **sans bénéfice**. Le « Corrective RAG » n'est donc pas correctif. **À faire :** sur échec, déclencher réellement une action différente (recherche web, ré-extraction, reformulation) avant de régénérer.

### M4 — Comptage de tokens/coûts faussé (mutation d'état dans un edge conditionnel)
`grade_generation` fait 1 à 2 appels LLM (hallucination + pertinence) et tente de comptabiliser leurs tokens via **mutation in-place** de l'état (le commentaire du code admet l'« astuce »). Or `main.py` accumule l'état à partir des updates streamés par `graph.stream(...)` ; les mutations faites dans une fonction d'edge conditionnel ne sont pas garanties d'apparaître dans ces updates. Les tokens des étapes de validation sont donc probablement **perdus**, et le coût affiché à l'utilisateur est sous-évalué. **[à confirmer en runtime]** **À faire :** faire du grading un vrai nœud qui retourne l'état, ou centraliser le comptage.

### M5 — Rendu du code Markdown cassé avec react-markdown v10
`package.json` fige `react-markdown@^10`. Le composant custom `code({inline, ...})` s'appuie sur la prop `inline`, **supprimée dans react-markdown v10**. `inline` sera toujours `undefined`, donc la logique `!inline && match` se comporte mal : le code inline peut être rendu en bloc, ou le highlighting cassé. **[à confirmer en runtime]** **À faire :** adapter au nouveau modèle (détecter l'inline via la présence de `\n` / le parent), ou revenir à react-markdown v8/v9.

### M6 — Fichier temporaire non nettoyé en cas d'erreur
`os.remove(temp_file)` n'est appelé que sur le chemin de succès. Si `PyPDFLoader` ou l'indexation lève une exception, le fichier `temp_*.pdf` **reste sur le disque**. Uploads concurrents du même nom → collision. **À faire :** `try/finally` pour supprimer le fichier temp systématiquement + nom unique.

### M7 — Latence et coût élevés : trop d'appels LLM par requête
Pour une seule question en mode hybride : `contextualize_query` (si historique) + `route_question` + `grade_documents` (**un appel LLM par document**, soit jusqu'à 5 avec `k=5`) + `generate` + `grade_generation` (jusqu'à 2). Cela fait facilement **9–10 appels LLM séquentiels**, tous sérialisés. Sur une clé gratuite/limitée, risque de throttling et latence importante. **À faire :** batcher le grading des documents en un seul appel, ou paralléliser.

---

## 🟡 Bugs mineurs / améliorations

### m1 — localStorage parsé sans protection → écran blanc possible
Au montage, `JSON.parse(savedHistory)` et `JSON.parse(savedCostHistory)` s'exécutent sans `try/catch`. Une entrée corrompue fait planter tout le rendu (pas d'error boundary). **À faire :** entourer de `try/catch`.

### m2 — Historique de coûts jamais purgé
`costHistory` grossit indéfiniment dans localStorage (l'historique de requêtes, lui, est limité à 5). À long terme, saturation du localStorage. **À faire :** borner la taille (ex. 100 dernières entrées).

### m3 — Doublons de documents à l'upload
Aucune déduplication : ré-uploader le même PDF double les segments dans ChromaDB (et les coûts d'embedding). **À faire :** vérifier l'existence par hash/nom avant insertion.

### m4 — Messages d'erreur trompeurs
Toute erreur réseau/HTTP tombe dans le `catch` générique affichant « Erreur de connexion au serveur Backend », y compris pour une 422 (clé manquante) qui n'est pas une panne de connexion. **À faire :** différencier les cas (statut HTTP).

### m5 — URL backend en dur
`http://localhost:8000` est codé en dur dans tous les appels frontend → inutilisable en déploiement. **À faire :** variable d'environnement (`NEXT_PUBLIC_API_URL`).

### m6 — Overlay Dashboard mal aligné
Le tableau de bord se positionne avec `left: 320px` (sidebar ouverte) alors que la sidebar fait 300px ailleurs dans le code → léger décalage visuel. **À faire :** unifier la largeur de sidebar via une variable CSS.

### m7 — Erreurs de parsing SSE silencieuses
`catch (e) {}` autour du `JSON.parse` de chaque événement avale toute erreur sans trace. **À faire :** logguer au moins en `console.debug`.

### m8 — Accessibilité
Les boutons afficher/masquer clé (icône œil) et certains boutons icône n'ont pas d'`aria-label`. **À faire :** ajouter des labels ARIA.

### m9 — Code mort / artefacts
`old_streamlit_app.py` (ancienne UI Streamlit) et un dossier `chroma_db/` à la racine (doublon de `backend/chroma_db/`) traînent dans le repo. Le `.streamlit/` sert Streamlit alors que le frontend est désormais Next.js. **À faire :** supprimer le code obsolète pour éviter la confusion.

---

## Points positifs relevés

- Le streaming SSE gère correctement le buffering des chunks coupés en plein événement (bon réflexe côté `page.tsx`).
- La garde anti-boucle (`MAX_CORRECTIONS`) évite un cycle infini de régénération.
- Le passage d'une double exécution du graphe (stream + invoke) à une seule est bien documenté et corrige un vrai gaspillage.
- La compression/extraction des documents pertinents dans `grade_documents` est une bonne idée pour réduire le contexte.

---

## Recommandations prioritaires (ordre d'action)

1. **Révoquer** la clé DeepSeek exposée et la sortir de Git (C1).
2. **Corriger le gel infini** : `tavily_key` optionnel + vérif `response.ok` + `finally { setLoading(false) }` (C2).
3. **Réparer `npm install`** : version correcte de `lucide-react` (C3).
4. **Sécuriser l'upload** : assainir le nom de fichier, valider type/taille, `try/finally` (C4, M6).
5. **Verrouiller CORS + ajouter une auth** avant tout déploiement (M1, M2).
6. **Rendre l'auto-correction réellement corrective** (M3) et fiabiliser le comptage de coûts (M4).
