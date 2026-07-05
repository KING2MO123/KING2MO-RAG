# Rapport d'audit — KING2MO (Application Desktop RAG)

**Date :** 5 juillet 2026
**Portée :** backend (FastAPI + moteur CRAG), frontend (Next.js/React), packaging (PyInstaller), UX et sécurité.
**Méthode :** revue de code offensive (on cherche à casser), analyse des surfaces d'attaque, des états d'erreur et de l'expérience utilisateur.

> Les entrées marquées **✅ CORRIGÉ** ont été traitées dans cette session. Les autres sont documentées avec la solution proposée, par ordre de gravité.

---

## Synthèse

Le produit est solide pour un projet local : authentification par token, comparaison en temps constant, protection anti zip-bomb, bornage des uploads, gestion propre de la déconnexion client (arrêt du graphe), et un frontend soigné avec bons états de chargement. L'architecture « FastAPI local + fenêtre native » est bien pensée.

Les faiblesses principales sont : (1) une **surface réseau locale sous-estimée** — le serveur distribue son token à quiconque parle en 127.0.0.1, ce qui ouvre le DNS-rebinding et l'accès inter-processus ; (2) une **absence de tests automatisés** ; (3) plusieurs **petits bugs fonctionnels** (export cassé, historique tronquable, tarifs de coût périmés) ; (4) des **détails UX** qui gênent en usage réel.

| Gravité | Nombre | Corrigés |
|---|---|---|
| 🔴 Critique | 2 | 2 (C-1 atténué, C-2 corrigé) |
| 🟠 Élevée | 5 | 5 (H-5 amorcé) |
| 🟡 Moyenne | 8 | 6 |
| 🔵 Faible / cosmétique | 9 | 4 |

**Restent ouverts (recommandations) :** C-1 (handshake token, atténué mais pas éliminé), M-5 (comptage d'usage du contextualiseur), F-4/F-6/F-7 (accessibilité notamment), et l'extension de la couverture de tests.

---

## 🔴 Critique

### C-1 — Le token est distribué à tout processus local (`/api/local-token`) ✅ atténué
**Constat.** L'endpoint `/api/local-token` renvoie le `BACKEND_API_TOKEN` en clair à toute requête venant de `127.0.0.1`. Sur une machine partagée ou infectée, **n'importe quelle autre application locale** (ou un onglet de navigateur via DNS-rebinding) peut récupérer le token puis lire/supprimer les documents et conversations, changer les clés API, etc. Le commentaire du code assume « tout processus local pourrait lire le .env de toute façon », ce qui n'est vrai que si le processus tourne sous le même utilisateur ET connaît le chemin — l'endpoint HTTP, lui, est trivial à exploiter à distance via une page web piégée.

**Correctif appliqué.** Ajout d'un `TrustedHostMiddleware` (Hosts `127.0.0.1`, `localhost`, `[::1]` uniquement) qui bloque le DNS-rebinding : un domaine attaquant résolvant vers 127.0.0.1 est rejeté avant d'atteindre l'endpoint.

**Recommandation complémentaire (non appliquée).** Remplacer le « token en libre-service » par un handshake : au démarrage, le backend écrit le token dans un fichier lisible seulement par l'utilisateur courant, et pywebview l'injecte dans la page via `window.pywebview.api` plutôt que via un endpoint HTTP. Cela supprime définitivement la fuite réseau.

### C-2 — Aucune limite de débit ni de concurrence sur `/api/chat` ✅ CORRIGÉ
**Constat.** Chaque requête `/api/chat` lançait un thread exécutant le graphe et appelant le LLM, sans aucune limite. Un client local (ou un script) pouvait ouvrir des centaines de connexions SSE : explosion mémoire, saturation CPU, et surtout **facturation API incontrôlée**.

**Correctif appliqué.** Trois garde-fous, tous configurables par variable d'environnement :
- **Concurrence** bornée par un `threading.Semaphore` (`MAX_CONCURRENT_CHATS`, défaut 3) — refus immédiat en 429 au-delà, libération garantie dans le `finally` du flux.
- **Débit** borné par minute (`MAX_CHATS_PER_MINUTE`, défaut 30) — fenêtre glissante, 429 au-delà.
- **Plafond de dépense quotidien** optionnel (`DAILY_SPEND_CAP_USD`, défaut 0 = illimité) — estimation prudente cumulée par jour, 429 quand le seuil est atteint.

---

## 🟠 Élevée

### H-1 — Le modèle choisi dans les Paramètres était ignoré (Gemini) ✅ CORRIGÉ
`build_crag_graph()` était appelé sans `model`, donc `gemini-1.5-flash` codé en dur s'appliquait toujours pour les fournisseurs `gemini`/`gemini-openai`. Le champ « nom du modèle » n'avait d'effet que pour `ollama`/`custom`.
**Correctif.** Ajout de `resolve_model()` (priorité : argument > `LLM_MODEL` du .env > défaut) utilisé par `get_llm()` et `build_crag_graph()`.

### H-2 — Modèle par défaut en fin de vie ✅ CORRIGÉ
`gemini-1.5-flash` est déprécié côté Google et cessera de répondre. **Correctif.** Défaut passé à `gemini-2.5-flash`.

### H-3 — Embeddings anglais sur des documents français ✅ CORRIGÉ
`BAAI/bge-small-en-v1.5` est un modèle **anglophone** : la recherche sémantique sur des PDF/Word français renvoyait des passages peu pertinents, dégradant toute la qualité RAG. **Correctif.** Défaut passé à un modèle **multilingue** (`paraphrase-multilingual-MiniLM-L12-v2`), configurable via `EMBED_MODEL`. ⚠ **Nécessite de vider `chroma_db/` et de ré-indexer** — documenté dans le README.
**Note additionnelle ✅ CORRIGÉ.** `seed_data.py` et `seed_handbook.py` utilisaient `HuggingFaceEmbeddings("all-MiniLM-L6-v2")`, incohérent avec le moteur. Ils importent désormais `_get_embeddings()` de `crag_engine` : mêmes vecteurs que ceux produits par l'app.

### H-4 — DevTools activés en production ✅ CORRIGÉ
`webview.start(debug=True)` exposait « Inspecter » et la console à l'utilisateur final. **Correctif.** Conditionné à `KING2MO_DEBUG=1`.

### H-5 — Pas de tests automatisés ✅ AMORCÉ
**Constat.** Aucun test unitaire ni d'intégration. Le pipeline CRAG est précisément le genre de logique qui casse silencieusement à chaque montée de version LangChain.
**Correctif appliqué.** Suite `pytest` initiale dans `backend/tests/test_api.py` : `resolve_model()` (les 3 cas de H-1), défaut d'embeddings multilingue, validation d'image (M-6), rate-limit (C-2), et endpoints via `TestClient` (ping public, auth exigée, ID de conversation invalide). Les tests dégradent proprement (`importorskip`) si la pile lourde est absente.
**Reste à faire.** Étendre à `search_web_api` (Tavily mocké), au flux SSE complet avec LLM mocké, et au test anti zip-bomb sur un vrai `.docx`. Viser ~60 % de couverture.

---

## 🟡 Moyenne

### M-1 — Export Markdown cassé (retours à la ligne littéraux) ✅ CORRIGÉ
`exportChatToMarkdown` construisait la chaîne avec `"\\n"` (double antislash) : le fichier exporté contenait des `\n` littéraux et tenait sur une seule ligne. **Correctif.** Remplacé par de vrais `\n`.

### M-2 — L'historique long bloquait la conversation ✅ CORRIGÉ
Le backend rejette (422) tout `HistoryItem` dont `content > 10 000` caractères. Après une réponse assistant très longue, la question suivante partait avec cet historique et échouait. **Correctif.** Troncature côté client à 10 000 caractères avant envoi.

### M-3 — Tarifs de coût périmés ✅ CORRIGÉ
Le calcul de coût utilisait les tarifs de `gemini-1.5-flash` ($0.075/$0.30) et affichait « Gemini 1.5 Flash » en dur. **Correctif.** Tarifs Gemini 2.5 Flash ($0.30/$2.50 par 1M) et étiquette dynamique via `model_name` renvoyé par le backend.
**Limite connue.** Le coût reste une **estimation** : les tarifs sont codés côté client et ne couvrent pas tous les modèles. Pour un suivi fiable, exposer une table de tarifs configurable.

### M-4 — Le titre de conversation n'est jamais renommable ✅ CORRIGÉ
La sauvegarde prenait les 60 premiers caractères du premier message, définitivement. **Correctif.** Endpoint `PATCH /api/conversations/{id}` (backend) + bouton crayon dans la sidebar (frontend) qui renomme via `window.prompt`. CORS élargi à `PATCH`.

### M-5 — `route_question` / `contextualize` : un appel LLM supplémentaire par requête, non compté dans le coût affiché en cas d'erreur
Les nœuds de routage et de contextualisation consomment des tokens. En cas d'exception dans `_extract_usage`, l'usage est silencieusement perdu (retourne 0,0), sous-estimant le coût. **Solution.** Logguer les échecs d'extraction d'usage ; envisager de désactiver le routeur LLM quand `mode` est déjà forcé (déjà fait pour `route_question`, mais `contextualize` tourne toujours dès qu'il y a un historique).

### M-6 — Pas de validation d'image (taille réelle / type MIME) ✅ CORRIGÉ
`image_base64` était borné en longueur mais son contenu n'était jamais vérifié : un base64 arbitraire partait tel quel au LLM. **Correctif.** `_validate_image_base64()` décode l'en-tête `data:image/...` puis vérifie les **magic bytes** (PNG, JPEG, GIF, WebP) ; rejet en 400 sinon. Appelé avant tout traitement, avec libération du sémaphore en cas d'échec.

### M-7 — Fenêtre sans contrainte de taille minimale ✅ CORRIGÉ
`create_window` sans `min_size` : en réduisant, la mise en page en positions `fixed` cassait. **Correctif.** `min_size=(900, 600)` sur les deux fenêtres.

### M-8 — Scripts de seed : dépendance non déclarée ✅ CORRIGÉ
Les scripts importaient `HuggingFaceEmbeddings` (dépendance absente de `requirements.txt`) : un seed sur install fraîche plantait. **Correctif.** Résolu par l'alignement sur FastEmbed (cf. H-3) — plus aucune dépendance HuggingFace requise.

---

## 🔵 Faible / cosmétique

- **F-1 — CORS redondant avec le mode standalone.** En standalone, le frontend est servi par FastAPI (`API_BASE = ""`), donc same-origin : la config CORS ne sert que le mode dev. À documenter pour éviter la confusion.
- **F-2 — `_pick_free_port` : petite course.** Le port est libéré puis rebindé par uvicorn ; entre les deux, un autre process peut le prendre. Rare en local, mais possible. Passer le socket déjà lié à uvicorn éliminerait la fenêtre.
- **F-3 — `king2mo.port` non nettoyé à la fermeture.** ✅ CORRIGÉ — handler `atexit` qui supprime le fichier `.port` à l'arrêt (robuste même via `WindowApi.close()`/`sys.exit`).
- **F-4 — Fuite de handles fichiers.** `sys.stdout = open(os.devnull, "w")` n'est jamais fermé (acceptable, dure toute la vie du process). *Non traité (négligeable).*
- **F-5 — Codes internes dans les messages d'erreur** (« N6 », etc.) exposés à l'utilisateur. ✅ CORRIGÉ — codes retirés des `detail` publics.
- **F-6 — `console.debug` sur erreur de parsing SSE** : silencieux en prod. *Conservé volontairement pour le debug.*
- **F-7 — Accessibilité.** Contraste du texte secondaire (`opacity: 0.4–0.7`) sous les seuils WCAG AA ; certains boutons icône-seule sans `aria-label`. *Non traité — recommandation : passe axe-core.*
- **F-8 — Canvas « réseau neuronal » en continu** même fenêtre inactive. ✅ CORRIGÉ — mise en pause sur `visibilitychange` (onglet caché/minimisé).
- **F-9 — Numéros de version incohérents.** ✅ CORRIGÉ — constante unique `APP_VERSION` (`3.2.0`) affichée en pied de page + alignée dans `package.json`.

---

## Sécurité — récapitulatif des surfaces

| Surface | État | Note |
|---|---|---|
| Auth API (token) | ✅ Bon | Token fort auto-généré, comparaison temps constant |
| Distribution du token | 🟠 Risqué | Endpoint local en libre-service (C-1), atténué par TrustedHost |
| DNS-rebinding | ✅ Corrigé | TrustedHostMiddleware ajouté |
| Path traversal (upload/delete) | ✅ Bon | `os.path.basename`, IDs regex-validés |
| Zip-bomb (Office) | ✅ Bon | Taille décompressée vérifiée |
| DoS / rate-limit | ✅ Corrigé | Concurrence + débit/min + plafond dépense (C-2) |
| Injection .env | ✅ Bon | Filtrage `"`, `\n` sur les valeurs |
| XSS | ✅ Bon | React échappe ; Markdown sans `rehype-raw` (pas de HTML brut) |
| Validation image | ✅ Corrigé | Magic bytes vérifiés (M-6) |
| Secrets au repos | 🟡 Moyen | Clés API en clair dans `.env` (standard, mais lisibles localement) |

---

## Plan d'action recommandé (priorisé)

1. **Fait dans cette session :** H-1, H-2, H-3, H-3-bis/M-8, H-4, H-5 (amorcé), C-1 (atténuation), C-2, M-1, M-2, M-3, M-4, M-6, M-7, F-3, F-5, F-8, F-9. ✅
2. **Court terme :** étendre la suite de tests (flux SSE, Tavily mocké, anti zip-bomb) ; M-5 (comptage d'usage du contextualiseur).
3. **Moyen terme :** C-1 (handshake token sans endpoint HTTP, pour éliminer et non seulement atténuer la fuite) ; F-7 (accessibilité — contraste + `aria-label`).
4. **Après modification frontend :** reconstruire le build statique (`cd frontend && npm run build`) pour que les changements de `page.tsx` soient servis par l'application.

---

*Rapport généré lors de la session d'audit du 5 juillet 2026. Les correctifs marqués ✅ CORRIGÉ sont dans le code ; les autres points sont des recommandations à planifier.*
