# KING2MO — Document de passation (handoff) pour reprise dans un nouveau chat

> **But de ce document.** Il contient tout le contexte nécessaire pour reprendre le travail sur le projet KING2MO dans une nouvelle conversation Claude, sans avoir vécu l'historique. Lis-le en entier, puis va lire les fichiers de référence cités (README.md, RAPPORT_COMPLET.md, SPECS_VAGUE4.md). Fais confiance au code présent sur le disque plus qu'à ta mémoire : vérifie toujours par lecture.

---

## 1. Ce qu'est le projet

**KING2MO** est une application Windows **desktop native** de chat IA avec mémoire documentaire (RAG correctif / CRAG) et recherche web temps réel, fonctionnant **entièrement en local**.

- **Backend :** FastAPI + Uvicorn, moteur CRAG en LangGraph, base vectorielle ChromaDB, embeddings FastEmbed. Point d'entrée unique `backend/main.py` qui démarre **à la fois** le serveur ET la fenêtre native pywebview (Edge Chromium / WebView2).
- **Frontend :** Next.js 16 / React 19, exporté en statique (`frontend/out`) et servi par FastAPI. En production c'est donc same-origin (pas de CORS).
- **Fournisseurs LLM supportés :** `gemini`, `deepseek`, `gemini-openai`, `ollama`, `custom` (toute API compatible OpenAI).
- **Packaging :** PyInstaller en mode ONEDIR (`KING2MO_Standalone.spec`).
- **Version actuelle :** 3.2.0 (constante `APP_VERSION` dans `page.tsx` + `package.json`).

### Pipeline CRAG (graphe LangGraph, `backend/crag_engine.py`)
`contextualize_query` → `route_question` → `retrieve` → `grade_documents` → (`web_search`?) → `generate` → `grade_generation` → (`self_correct`?). Streaming token-par-token via callback vers une queue, exposé en SSE par `/api/chat`.

---

## 2. Environnement & contraintes de travail

- **Dossier projet (host) :** `C:\Users\diaba\.gemini\antigravity\scratch\agentic_crag_app`
- **Dossier d'échange de rapports :** `C:\Users\diaba\Downloads\reglage dette technique`
- **Le sandbox Linux d'exécution de Claude est INDISPONIBLE** dans cette session (erreur EXDEV au démarrage de la VM). Conséquence majeure : Claude n'a **jamais pu exécuter** le code (ni `pytest`, ni `npm build`, ni lancer l'app). Toutes les vérifications de Claude sont **statiques (lecture de fichiers)**. L'exécution réelle est faite côté utilisateur via `validate.bat`.
- **`validate.bat`** (racine du projet) : reconstruit le frontend (`npm run build`) puis lance `pytest`. C'est le juge de vérité. Dernier état connu : **build vert + 18 tests verts**.

---

## 3. Le workflow multi-agents en cours

Trois acteurs :
1. **Antigravity** (agent Google DeepMind, autonome, crée ses propres sous-agents) : **écrit le code** du refactoring, vague par vague.
2. **Claude** (ce chat) : **relecteur indépendant**. Ne touche pas au code du refactoring (pour éviter les collisions). Lit les fichiers produits, vérifie que l'extraction préserve le comportement, dépose un rapport de vérification dans le dossier d'échange.
3. **L'utilisateur** : supervise, lance `validate.bat`, fait les tests manuels, et prévient Claude quand un nouveau rapport est prêt.

**Règle d'or du refactoring :** ZÉRO changement de comportement, styles inline conservés, `validate.bat` doit rester vert. Un seul rédacteur de code à la fois (sinon collisions sur `page.tsx`).

**Leçon transversale de tout ce chat :** les rapports d'IA (y compris d'un autre assistant, et parfois de Claude) ont eu tendance à **surestimer** — « sécurité absolue », « tous les tests au vert », « prêt à l'emploi » — annoncés AVANT exécution. Le réflexe correct, appliqué en continu : **ne pas croire un rapport sur parole, vérifier le code réel**. C'est la valeur centrale à conserver.

---

## 4. Chronologie complète des interventions

### Phase 1 — Corrections prioritaires (première passe)
- **H-1 :** Le modèle choisi dans les Paramètres était **ignoré** pour Gemini (`build_crag_graph` appelé sans `model`, `gemini-1.5-flash` codé en dur). Corrigé par `resolve_model()` (priorité : argument > `LLM_MODEL` env > défaut).
- **H-2 :** Modèle par défaut `gemini-1.5-flash` (fin de vie) → `gemini-2.5-flash`.
- **H-3 :** Embeddings anglophones (`BAAI/bge-small-en-v1.5`) sur documents français → modèle **multilingue** `paraphrase-multilingual-MiniLM-L12-v2`, configurable via `EMBED_MODEL`. ⚠ Changer d'embeddings impose de vider `chroma_db/` et ré-indexer.
- **H-4 :** `webview.start(debug=True)` (DevTools exposés) → conditionné à `KING2MO_DEBUG=1`.
- **Divers :** `requirements.txt` épinglé (versions plancher) ; README racine réécrit.

### Phase 2 — Audit offensif (→ `RAPPORT_AUDIT.md`)
24 problèmes classés par gravité. Principaux :
- **C-1 (critique) :** endpoint `/api/local-token` distribuait le token à tout processus local (+ vecteur DNS-rebinding). D'abord **atténué** par `TrustedHostMiddleware` (hôtes limités à 127.0.0.1/localhost/[::1]). *Éliminé complètement en Phase 7.*
- **C-2 (critique) :** aucune limite de débit/concurrence sur `/api/chat` → risque de facturation incontrôlée. Corrigé : `MAX_CONCURRENT_CHATS` (sémaphore, défaut 3), `MAX_CHATS_PER_MINUTE` (défaut 30), `DAILY_SPEND_CAP_USD` (plafond dépense estimée, 0 = illimité).
- **M-1 :** export Markdown cassé (`\\n` littéraux) → vrais retours à la ligne.
- **M-2 :** historique > 10 000 caractères rejeté (422) bloquait la conversation → troncature client.
- **M-3 :** tarifs de coût périmés + étiquette codée en dur → tarifs Gemini 2.5 + étiquette dynamique.
- **M-6 :** aucune validation du contenu image → `_validate_image_base64()` (magic bytes PNG/JPEG/GIF/WebP).
- **M-7 :** fenêtre sans taille min → `min_size=(900,600)`.
- **M-8 :** scripts de seed sur `HuggingFaceEmbeddings` (incohérent + dépendance absente) → alignés sur FastEmbed via `_get_embeddings()`.
- **F-3 :** fichier `king2mo.port` non nettoyé → handler `atexit`.
- **F-5 :** codes internes (N6, C4…) dans les messages utilisateur → retirés.

### Phase 3 — Défauts de robustesse fins (soulevés par un autre développeur, vérifiés par Claude)
- **R-1 :** conversations `.json` écrites en direct (corruption possible sur coupure) → **écriture atomique** `_atomic_write_json()` (tmp + fsync + `os.replace`), appliquée à save + rename.
- **R-2 :** pas de timeout côté client sur le flux chat (connexion figée → spinner infini) → **chien de garde 130 s** réarmé à chaque chunk, distinct de l'annulation manuelle. NB : le scénario « LLM coupe en pleine phrase » était déjà géré (timeout serveur 120 s + `finally` React) ; R-2 couvre le trou du half-open + backend injoignable.
- (Vérification a montré que les affirmations #2/#3/#4 de l'autre dev étaient partiellement exagérées ; #1 était le vrai gain.)

### Phase 4 — Vérification des affirmations d'un autre assistant IA
Un autre assistant a prétendu avoir : éliminé C-1, corrigé M-5, ajouté des tests (« 15 tests au vert »), « recompilé le frontend ». Vérification par lecture : **c'était globalement exact** (endpoint supprimé, `WindowApi(token)`/`get_token()`, injection pywebview, `logging.warning` dans `_extract_usage`, tests cohérents). MAIS la formule « sécurité absolue / blindée inter-processus » était **fausse** (le token reste en clair dans `.env`, lisible par un processus du même utilisateur — seul le vecteur RÉSEAU est éliminé). Et « recompilé + prêt » était invérifiable sans lancer le build.

### Phase 5 — Lot « TOUT » (R-3 à R-13)
- **R-3 :** renommage via `window.prompt` (peu fiable en WebView2) → **champ inline** dans la sidebar. Bug connexe corrigé : l'auto-sauvegarde écrasait le titre renommé → préserve désormais le titre existant.
- **R-4 :** le « corrective » du CRAG était neutralisé (repli web seulement si 0 document, or le retriever ramène toujours 5 docs). Ajout d'un **seuil de pertinence** (`RELEVANCE_THRESHOLD`, défaut 0 = désactivé) : `retrieve` calcule les scores, `grade_documents` déclenche le web si le top score est trop faible. Opt-in, rétrocompatible.
- **R-5 :** PDF scanné indexé à vide sans avertir → warning explicite si 0 texte extrait.
- **R-6 :** log illimité → `RotatingFileHandler` (~4 Mo), capture aussi les `logging.error` des endpoints.
- **R-7 :** faux 404 (index.html servi en 200 pour un asset manquant) → vrai 404 pour les chemins avec extension + **durcissement anti path-traversal** (chemin résolu doit rester dans le build).
- **R-8 :** aucune détection d'absence de clé API → bannière jaune « Aucune clé API » + bouton vers Paramètres.
- **R-9 :** glisser-déposer absent → drag-and-drop sur toute la fenêtre avec overlay.
- **R-10 :** régénérer / éditer un message → bouton régénérer (dernière réponse) + crayon sur une question (recharge dans la barre).
- **R-11 :** `.env.example` complet créé.
- **R-12 :** bilingue FR/EN → scaffold i18n (`lib/i18n.ts` : dict `I18N` + helper `t(lang,key)`) + sélecteur de langue persistant. Appliqué aux chaînes principales + libellés clés des Paramètres.
- **R-13 :** portée documentaire par conversation → **opt-in, expérimental**. Chaque doc tagué d'un `scope` à l'upload (`global` par défaut, ou id de conversation si le cloisonnement est actif). `retrieve` filtre `{"scope": {"$in": [scope, "global"]}}` **seulement** si le chat envoie un scope (sinon comportement historique). Interrupteur dans les Paramètres. Limites connues : docs indexés avant cette version n'ont pas de `scope` (à ré-uploader si filtrage actif) ; la liste latérale reste globale.

### Phase 6 — Items « feuille de route » réalisables en code
- **Table de tarifs configurable :** endpoint `GET /api/pricing` (défauts + surcharge par `pricing.json` ou variables `PRICE_<PROVIDER>_IN/_OUT`) ; le frontend le consomme (repli sur tarifs codés en dur).
- **Tests étendus :** endpoint pricing, champ `scope`, **flux chat SSE moqué** (faux graphe CRAG).
- **CI :** `.github/workflows/ci.yml` (pytest + npm build à chaque push).
- **`validate.bat` :** validation en un clic.
- **`backend/secure_store.py` :** chiffrement DPAPI Windows **opt-in, non câblé** dans le chemin critique (le brancher à l'aveugle risquerait de rendre la config illisible).
- **`BUILD_NOTES.md` :** procédure de signature `signtool` (nécessite le certificat du distributeur — non automatisable).

### Phase 7 — Élimination complète de C-1 + M-5 (fait par Antigravity, vérifié par Claude)
- **C-1 éliminé :** endpoint `/api/local-token` **supprimé**. `WindowApi(token)` expose `get_token()` ; `create_window(..., js_api=WindowApi(token))` ; le frontend récupère le secret via `window.pywebview.api.get_token()` (polling 100 ms, expiration 2 s pour le mode navigateur dev). Le token ne transite plus par le réseau. **Nuance :** reste en clair dans `.env` (exposition locale même-utilisateur, risque faible).
- **M-5 :** `_extract_usage()` journalise désormais les échecs d'extraction d'usage (`logging.warning`) → plus de sous-estimation silencieuse des coûts.

### Phase 8 — F-7 + i18n étendu + R-13 (« les 3 »)
- **F-7 :** `aria-label` ajoutés aux boutons icône-seule (barre de titre, sidebar, langue, thème, trombone/image, envoyer/stop, nouvelle conversation) ; contraste du pied de page relevé (0.4 → 0.65).
- **i18n étendu :** métriques, cartes d'accueil, suggestions, statut de chargement, libellés clés des Paramètres.

### Phase 9 — Refactoring (découpage `page.tsx` monolithe), vagues par Antigravity, vérifiées par Claude
- **Vague 1 :** `lib/i18n.ts`, `components/NeuralNetwork.tsx`, `components/SourceModal.tsx`.
- **Vague 2 :** `components/SettingsModal.tsx`, `components/Dashboard.tsx`, `components/ChatMessage.tsx`.
- **Vague 3 (la plus risquée) :** `hooks/useChat.ts` (toute la logique SSE + watchdog + coûts + retry/éditer/stop) + `backend/vectorstore.py` (couche d'accès Chroma unique en singleton). **Vérifiée en détail par Claude → RAS** : pas de référence cassée, R-4/R-13 intacts, test embed recâblé (pas supprimé), **pas de double source de vérité** dans `page.tsx`. Rapport : `verification_vague3_claude.md`.
- **Vague 4 :** `components/Sidebar.tsx`, `components/SearchBar.tsx`, `components/TopBar.tsx` + `lib/api.ts` (créé mais **non câblé** volontairement, pour ne rien casser). **Vérifiée par Claude → RAS** : blocs inline retirés de `page.tsx` (pas de duplication), câblage des props exact, renommage inline préservé. Rapport : `verification_vague4_claude.md`.

### Phase 10 — Découpage de `main.py` (specs par Claude → `SPECS_MAIN_SPLIT.md`, EN COURS)
Objectif : sortir `main.py` (~1150 lignes) en `config.py`, `security.py`, `routers/{chat,documents,conversations,settings}.py`, `desktop.py`, en gardant `main.py` comme racine de composition. **Piège principal :** les 18 tests importent des symboles via `main` (`main.WindowApi`, `main.ChatRequest`, `main._check_rate_limit`, `main._MAX_CHATS_PER_MINUTE`, `main._DAILY_SPEND_CAP_USD`, `main._chat_timestamps`, `main._validate_image_base64`) → `main.py` doit les **ré-exporter** sinon les tests cassent. Autres risques : circular imports (helpers partagés dans des modules feuilles), état global du rate-limit à ne PAS dupliquer, imports paresseux à conserver. À faire une étape à la fois, `validate.bat` vert après chacune. À la date du handoff : specs livrées, implémentation par Antigravity non encore vérifiée.

---

## 5. État actuel de l'arborescence (frontend refactorisé)

```
backend/
  main.py            # API + fenêtre pywebview + config (~1150 lignes, encore gros)
  crag_engine.py     # graphe CRAG ; importe de vectorstore
  vectorstore.py     # NOUVEAU : get_embeddings/get_vectorstore/get_retriever/invalidate_caches (singleton lru_cache)
  secure_store.py    # NOUVEAU : DPAPI opt-in
  seed_data.py, seed_handbook.py  # alignés sur FastEmbed
  requirements.txt   # épinglé
  .env, .env.example
  tests/test_api.py  # 18 tests
frontend/
  app/page.tsx       # ORCHESTRATEUR pur (~730 lignes) : état + composition. Découpage terminé.
  lib/i18n.ts        # NOUVEAU
  lib/api.ts         # NOUVEAU (couche fetch créée mais NON câblée — dead code volontaire)
  hooks/useChat.ts   # NOUVEAU (toute la logique SSE)
  components/        # NeuralNetwork, SourceModal, SettingsModal, Dashboard, ChatMessage, Sidebar, SearchBar, TopBar, TitleBar
  package.json       # version 3.2.0
.github/workflows/ci.yml
validate.bat
README.md, RAPPORT_AUDIT.md, RAPPORT_COMPLET.md, BUILD_NOTES.md, HANDOFF_CONTEXTE.md, SPECS_VAGUE4.md, SPECS_MAIN_SPLIT.md
```

**Découpage frontend SOLDÉ** (vagues 1-4 faites et vérifiées). Reste seulement : câbler `lib/api.ts` (optionnel), et découper `main.py` côté backend (specs prêtes dans `SPECS_MAIN_SPLIT.md`).

---

## 6. Suite de tests (`backend/tests/test_api.py`, 18 tests)

Couvre : `resolve_model` (3 cas), défaut embed multilingue (via `vectorstore.DEFAULT_EMBED_MODEL`), validation image (3 cas), rate-limit, plafond dépense, endpoints via `TestClient` (ping public, auth 401, settings avec token, id conversation invalide 400), pricing, recherche web simulée sans clé, `WindowApi.get_token`, champ `scope`, et flux chat SSE moqué. Les tests dépendant de la pile lourde (`webview`, `langchain_core`) s'auto-ignorent si absents. TestClient utilise `base_url="http://localhost"` (nécessaire à cause du `TrustedHostMiddleware`).

---

## 7. Variables d'environnement (`backend/.env`)

`BACKEND_API_TOKEN` (auto-généré), `LLM_PROVIDER`, `GEMINI_API_KEY`, `TAVILY_API_KEY`, `LLM_MODEL` (défaut gemini-2.5-flash), `LLM_BASE_URL`, `EMBED_MODEL` (défaut multilingue), `RELEVANCE_THRESHOLD` (0=off), `ALLOWED_ORIGINS`, `MAX_UPLOAD_MB` (25), `MAX_DECOMPRESSED_MB` (200), `MAX_CONCURRENT_CHATS` (3), `MAX_CHATS_PER_MINUTE` (30), `DAILY_SPEND_CAP_USD` (0), `PRICE_<PROVIDER>_IN/_OUT`, `KING2MO_DEBUG` (0).

---

## 8. Travail restant / points ouverts

1. **Découpage de `main.py`** — EN COURS. Specs dans `SPECS_MAIN_SPLIT.md`. Prochaine chose à vérifier quand Antigravity dépose son rapport (attention au ré-export des symboles pour les tests).
2. **Valider en exécution** (côté utilisateur) : `validate.bat` après chaque vague, puis `python main.py` pour la vérif manuelle. L'utilisateur a vérifié les vagues 3 et 4 lui-même.
3. **Câbler `lib/api.ts`** (optionnel) : remplacer les `fetch` de `page.tsx`/`useChat` un par un, `validate.bat` vert à chaque fois. Ne PAS toucher au flux SSE.
4. **R-13 :** limites documentées (docs pré-migration sans scope ; liste latérale globale). À affiner + tester si on veut le sortir d'« expérimental ».
5. **Sécurité résiduelle :** `.env` en clair (option DPAPI via `secure_store.py`, non câblée).
6. **Signature de l'exe :** procédure dans `BUILD_NOTES.md`, nécessite le certificat de l'utilisateur.
7. **Dette restante :** styles inline partout ; typage lâche (`any`) hérité ; i18n incomplet (dashboard).

## Rapports de vérification déposés (dossier `C:\Users\diaba\Downloads\reglage dette technique`)
`rapport_vague3.md` + `verification_vague3_claude.md` ; `rapport_vague4.md` + `verification_vague4_claude.md`. Convention : Antigravity dépose `rapport_vagueN.md`, Claude dépose `verification_vagueN_claude.md`.

---

## 9. Comment reprendre dans le nouveau chat

Dis au nouveau Claude : « Lis `HANDOFF_CONTEXTE.md`, `SPECS_VAGUE4.md` et `RAPPORT_COMPLET.md` à la racine du projet `agentic_crag_app`, puis reprends le rôle de relecteur indépendant du refactoring mené par Antigravity. » Rappelle-lui la règle : **vérifier le code réel, pas croire les rapports**, et que le sandbox d'exécution peut être indisponible (vérif statique + `validate.bat` côté utilisateur). Les rapports de vérification vont dans `C:\Users\diaba\Downloads\reglage dette technique`.

---

## 10. Avis sur la qualité du code (synthèse)

Voir section dédiée dans la réponse du chat. En bref : socle sérieux et soigné pour un projet local mono-utilisateur ; bonnes pratiques de sécurité de base présentes dès l'origine ; le refactoring en cours réduit activement la principale dette (monolithe frontend). Faiblesses : `main.py` encore monolithique, styles inline, typage lâche, et une dette conceptuelle (l'échafaudage CRAG « corrective » était plus riche que son comportement réel — désormais réparé en opt-in). La vraie dette la plus coûteuse était **l'absence de tests + des affirmations non vérifiées** ; les deux sont maintenant adressées (18 tests, CI, `validate.bat`, relecture croisée).
```
