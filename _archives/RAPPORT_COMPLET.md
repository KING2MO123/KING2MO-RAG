# KING2MO — Rapport complet d'audit et d'amélioration

**Projet :** KING2MO — Application desktop RAG (Corrective Retrieval-Augmented Generation)
**Version après intervention :** 3.2.0
**Date du rapport :** 5 juillet 2026
**Périmètre :** backend (FastAPI + moteur CRAG LangGraph), frontend (Next.js/React), packaging (PyInstaller), sécurité, UX et robustesse.

---

## 1. Résumé exécutif

KING2MO est une application Windows native (pywebview + Edge Chromium) qui fait tourner, **entièrement en local**, un assistant IA capable de dialoguer avec les documents de l'utilisateur (PDF, Word, Excel, PowerPoint, texte) et de compléter par une recherche web temps réel. L'architecture repose sur un serveur FastAPI local, un moteur de décision LangGraph (CRAG), une base vectorielle ChromaDB et des embeddings FastEmbed, le tout présenté dans une interface soignée.

L'intervention s'est déroulée en deux passes. La **première** a corrigé cinq points d'amélioration prioritaires identifiés à la lecture du code. La **seconde**, menée en posture de test offensif, a mis au jour 24 problèmes classés par gravité, dont deux critiques. Au total, **la grande majorité des points ont été corrigés dans le code** ; les rares points restants sont documentés avec leur solution.

Le produit était déjà solide sur les fondamentaux (authentification par token, comparaison en temps constant, protection anti zip-bomb, bornage des uploads, arrêt propre du graphe à la déconnexion client). Les faiblesses corrigées portaient surtout sur : un bug fonctionnel rendant inopérant le choix du modèle, un modèle par défaut en fin de vie, des embeddings inadaptés au français, l'absence totale de limitation de débit (risque de facturation incontrôlée), et divers défauts d'UX et de cohérence.

| Gravité | Identifiés | Corrigés | Restants (documentés) |
|---|---|---|---|
| 🔴 Critique | 2 | 2 (C-1 vecteur réseau éliminé, C-2 corrigé) | durcissement `.env` (optionnel) |
| 🟠 Élevée | 5 | 5 | — |
| 🟡 Moyenne | 8 | 8 | — |
| 🔵 Faible / cosmétique | 9 | 5 | F-4, F-6 |
| ➕ Robustesse / produit (R-1…R-13) | 13 | 13 | — (R-13 fait, opt-in) |

---

## 2. Présentation du projet

### 2.1 Architecture

Le projet est un **monolithe desktop** : un seul processus Python démarre le serveur FastAPI **et** ouvre la fenêtre native pywebview. En production, le frontend Next.js est exporté en statique (`frontend/out`) et servi directement par FastAPI, ce qui place l'interface et l'API sur la même origine (pas de CORS en jeu).

Le flux de traitement d'une question suit un graphe LangGraph (CRAG) :

1. **Contextualize** — reformulation de la question en tenant compte de l'historique de conversation.
2. **Route** — décision automatique entre recherche locale, web, ou hybride (sauf mode forcé par l'utilisateur).
3. **Retrieve** — recherche sémantique dans ChromaDB via les embeddings FastEmbed.
4. **Grade documents** — filtrage rapide ; déclenche le repli web si aucun document pertinent.
5. **Web search** — appel à l'API Tavily (repli ou mode web).
6. **Generate** — génération de la réponse avec citations numérotées `[1]`, `[2]`, streamée mot à mot.
7. **Self-check** (mode Qualité optionnel) — auto-évaluation anti-hallucination avec garde anti-boucle.

### 2.2 Pile technique

- **Backend :** FastAPI, Uvicorn, LangChain, LangGraph, ChromaDB, FastEmbed, pywebview.
- **Frontend :** Next.js 16, React 19, react-markdown, react-syntax-highlighter, recharts, lucide-react.
- **Fournisseurs LLM supportés :** Gemini, DeepSeek, Gemini via API OpenAI, Ollama (local), et tout endpoint compatible OpenAI (`custom`).
- **Packaging :** PyInstaller en mode ONEDIR (démarrage rapide).

### 2.3 Points forts constatés avant intervention

L'authentification exige un token fort auto-généré au premier lancement, comparé en temps constant (résistant aux attaques temporelles). Les uploads sont bornés en taille et protégés contre les zip-bombs Office (vérification de la taille décompressée). Les chemins de fichiers sont assainis (`os.path.basename`, IDs de conversation validés par expression régulière). La déconnexion du client interrompt proprement le graphe, évitant de payer les appels LLM inutiles. L'interface gère correctement les états de chargement, d'erreur et d'annulation.

---

## 3. Méthode d'audit

L'audit a combiné une **revue de code offensive** (chercher activement à casser le produit plutôt qu'à confirmer qu'il marche), une **cartographie des surfaces d'attaque** (réseau local, uploads, injection de configuration, XSS, déni de service), et une **revue d'expérience utilisateur** (états d'erreur, cohérence visuelle, accessibilité, performance perçue).

Chaque constat est décrit avec : le comportement observé, l'impact concret pour l'utilisateur ou l'exploitant, et la solution — appliquée ou recommandée. Les correctifs ont été implémentés directement dans le code source du projet.

> **Limite de validation.** L'environnement d'exécution isolé (sandbox Linux) était indisponible pendant l'intervention. Les correctifs n'ont donc **pas pu être exécutés ni testés en runtime** de mon côté : ce sont des modifications ciblées, relues, mais un lancement (`python main.py`) et l'exécution de la suite `pytest` restent à faire côté utilisateur pour validation finale.

---

## 4. Première passe — améliorations prioritaires

### 4.1 Bug : le modèle choisi dans les Paramètres était ignoré (Gemini)
`build_crag_graph()` était appelé sans transmettre le modèle : la constante codée en dur `gemini-1.5-flash` s'appliquait toujours pour les fournisseurs `gemini` et `gemini-openai`. Le champ « nom du modèle » de l'interface n'avait d'effet que pour Ollama et les endpoints personnalisés.
**Correctif.** Introduction d'une fonction `resolve_model()` avec ordre de priorité clair (argument explicite > `LLM_MODEL` du `.env` > défaut), désormais utilisée par `get_llm()` et `build_crag_graph()`.

### 4.2 Modèle par défaut en fin de vie
`gemini-1.5-flash` est déprécié côté Google et cessera de répondre.
**Correctif.** Défaut porté à `gemini-2.5-flash`.

### 4.3 Embeddings anglophones sur des documents français
Le modèle `BAAI/bge-small-en-v1.5` est entraîné pour l'anglais : la recherche sémantique sur des documents français renvoyait des passages peu pertinents, dégradant toute la qualité RAG.
**Correctif.** Défaut porté à un modèle **multilingue** (`paraphrase-multilingual-MiniLM-L12-v2`), configurable via `EMBED_MODEL`. **Attention :** un changement de modèle d'embeddings impose de vider `chroma_db/` et de ré-indexer les documents (les anciens vecteurs ne sont pas comparables). Ce point est documenté dans le README.

### 4.4 DevTools activés en production
`webview.start(debug=True)` exposait la console et l'option « Inspecter » à l'utilisateur final.
**Correctif.** Comportement conditionné à la variable `KING2MO_DEBUG=1` ; désactivé par défaut.

### 4.5 Dépendances non épinglées + README obsolète
`requirements.txt` ne fixait aucune version (risque de casse à la réinstallation) et le README décrivait une architecture web à deux serveurs, périmée.
**Correctif.** Versions plancher épinglées, note sur `pip freeze` pour figer l'environnement, et README réécrit pour refléter l'application desktop réelle (tableau de configuration complet, procédure de migration des embeddings).

---

## 5. Seconde passe — audit offensif

### 5.1 Critique

**C-1 — Distribution du token à tout processus local (`/api/local-token`). — Résolu (vecteur réseau éliminé).**
L'endpoint renvoyait le token d'accès à toute requête émise depuis `127.0.0.1`. Sur une machine partagée ou compromise, une autre application locale — ou un onglet de navigateur via une attaque de **DNS-rebinding** — pouvait récupérer le token puis lire ou supprimer documents et conversations, modifier les clés API, etc.
*Correctifs appliqués, en deux temps :*
1. `TrustedHostMiddleware` (hôtes limités à `127.0.0.1`, `localhost`, `[::1]`) neutralisant le DNS-rebinding.
2. **Suppression complète de l'endpoint `/api/local-token`.** Le token est désormais injecté dans la fenêtre native : `WindowApi(token)` expose une méthode `get_token()`, transmise via `js_api=WindowApi(token)` à `create_window`, et le frontend récupère le secret par `window.pywebview.api.get_token()` (attente active jusqu'à ce que pywebview soit prêt, expiration 2 s). Le token ne transite donc **plus jamais par le réseau local**.

*Nuance de sécurité (importante) :* la surface d'attaque **réseau** est éliminée, mais le token reste écrit **en clair dans `backend/.env`** (c'est ainsi qu'il est validé). Un processus s'exécutant sous **le même utilisateur** peut toujours lire ce fichier. La sécurité n'est donc pas « absolue » : elle est fortement améliorée côté réseau/navigateur, l'exposition résiduelle étant l'accès disque local (inhérent, risque faible).
*Effet de bord :* en mode développement dans un simple navigateur (`npm run dev`), `window.pywebview` n'existe pas — l'auto-connexion est indisponible et le token doit être collé manuellement dans les Paramètres (le champ existe). L'auto-connexion ne fonctionne qu'en fenêtre native.

**C-2 — Aucune limite de débit ni de concurrence sur `/api/chat`. — Corrigé.**
Chaque requête lançait un thread appelant le LLM, sans plafond. Un script local pouvait ouvrir des centaines de flux : saturation mémoire/CPU et, surtout, **facturation API incontrôlée**.
*Correctif appliqué :* trois garde-fous configurables — concurrence bornée par sémaphore (`MAX_CONCURRENT_CHATS`, défaut 3, refus 429 au-delà, libération garantie), débit par minute en fenêtre glissante (`MAX_CHATS_PER_MINUTE`, défaut 30), et plafond de dépense quotidien estimé optionnel (`DAILY_SPEND_CAP_USD`, défaut 0 = illimité).

### 5.2 Élevée

**H-1 à H-4** correspondent aux points 4.1 à 4.4 ci-dessus, tous corrigés.

**H-5 — Absence de tests automatisés. — Amorcé.**
Le pipeline CRAG est exactement le type de logique qui casse silencieusement à chaque montée de version de LangChain.
*Correctif appliqué :* suite `pytest` initiale (`backend/tests/test_api.py`) couvrant `resolve_model()` (les trois cas du bug H-1), le défaut d'embeddings multilingue, la validation d'image, le rate-limit, et les endpoints via `TestClient` (ping public, authentification exigée, rejet d'identifiant invalide). Les tests s'auto-ignorent proprement si la pile lourde est absente.
*Reste à faire :* étendre à `search_web_api` (Tavily simulé), au flux SSE complet avec LLM simulé, et au test anti zip-bomb sur un vrai `.docx`.

### 5.3 Moyenne

**M-1 — Export Markdown cassé. — Corrigé.** La fonction construisait la chaîne avec des `\\n` (double antislash) : le fichier exporté contenait des `\n` littéraux et tenait sur une seule ligne. Remplacé par de vrais retours à la ligne.

**M-2 — Historique long bloquant la conversation. — Corrigé.** Le backend rejette (422) tout élément d'historique dépassant 10 000 caractères ; après une réponse très longue, la question suivante échouait. Troncature côté client ajoutée avant l'envoi.

**M-3 — Tarifs de coût périmés. — Corrigé.** Le calcul utilisait les tarifs de `gemini-1.5-flash` et affichait un nom de modèle codé en dur. Tarifs mis à jour (Gemini 2.5 Flash) et étiquette rendue dynamique à partir du nom réel renvoyé par le backend. *Note : le coût reste une estimation, les tarifs étant côté client.*

**M-4 — Conversations non renommables. — Corrigé.** Ajout d'un endpoint `PATCH /api/conversations/{id}` et d'un bouton crayon dans la barre latérale. CORS élargi à `PATCH`.

**M-5 — Usage du contextualiseur mal comptabilisé. — Corrigé.** Les nœuds de routage et de contextualisation consomment des tokens ; en cas d'échec silencieux de l'extraction d'usage (fournisseur ne renvoyant pas ses statistiques, ex. Ollama), le coût était sous-estimé sans trace. *Correctif :* `_extract_usage()` journalise désormais l'anomalie via `logging.warning` (visible dans `king2mo_error.log`), ce qui permet d'identifier le fournisseur fautif. Le coût affiché reste une estimation, mais les défaillances de comptage ne sont plus silencieuses.

**M-6 — Absence de validation du contenu image. — Corrigé.** Un base64 arbitraire était transmis tel quel au LLM. Ajout de `_validate_image_base64()` qui vérifie l'en-tête `data:image/...` puis les **magic bytes** (PNG, JPEG, GIF, WebP) et rejette en 400 sinon.

**M-7 — Fenêtre sans taille minimale. — Corrigé.** `min_size=(900, 600)` appliqué aux deux fenêtres, évitant la casse de la mise en page en positions fixes.

**M-8 — Scripts de seed incohérents / dépendance manquante. — Corrigé.** `seed_data.py` et `seed_handbook.py` utilisaient `HuggingFaceEmbeddings` (absent de `requirements.txt` et incohérent avec le moteur). Ils importent désormais `_get_embeddings()` de `crag_engine` : mêmes vecteurs que l'application, aucune dépendance supplémentaire.

### 5.4 Faible / cosmétique

**F-3 — Fichier `.port` non nettoyé. — Corrigé.** Handler `atexit` supprimant `king2mo.port` à l'arrêt, robuste même via la fermeture par l'API de fenêtre.

**F-5 — Codes internes dans les messages d'erreur. — Corrigé.** Les références internes (« N6 », etc.) ont été retirées des messages exposés à l'utilisateur.

**F-8 — Animation de fond en continu. — Corrigé.** Le canvas « réseau neuronal » (60 fps, coût en O(n²)) tournait même fenêtre masquée. Mise en pause sur `visibilitychange`.

**F-9 — Versions incohérentes. — Corrigé.** Constante unique `APP_VERSION = 3.2.0` affichée en pied de page et alignée dans `package.json`.

**Restants (non traités, faible priorité) :** F-4 (handle `stdout` jamais fermé, négligeable), F-6 (`console.debug` conservé volontairement pour le debug), **F-7 (accessibilité)** — contraste du texte secondaire sous les seuils WCAG AA par endroits et quelques boutons icône-seule sans `aria-label` ; recommandation : passe automatisée axe-core.

### 5.5 Compléments post-audit (robustesse)

Deux points de robustesse plus subtils ont été relevés et corrigés après la seconde passe.

**R-1 — Corruption possible des historiques de conversation. — Corrigé.** Les fichiers `.json` de conversation étaient écrits en direct (`open(path, "w")` tronque avant d'écrire) : une coupure de courant pile pendant l'écriture laissait un JSON tronqué et illisible (perte de la conversation concernée ; l'application dégradait toutefois proprement en ignorant le fichier corrompu). *Correctif :* helper `_atomic_write_json()` — écriture dans un fichier temporaire du même dossier, `flush` + `fsync`, puis `os.replace()` atomique. Une coupure laisse désormais soit l'ancien fichier intact, soit le nouveau complet. Appliqué à la sauvegarde et au renommage.

**R-2 — Absence de timeout côté client sur le flux de chat. — Corrigé.** Le scénario « le LLM coupe en pleine phrase » était déjà géré (le backend émet un événement d'erreur, un timeout serveur de 120 s existe, et un `finally` React libère le spinner). En revanche, aucun **timeout côté client** ne protégeait contre une connexion figée « half-open » couplée à un backend devenu injoignable : le `reader.read()` pouvait rester suspendu jusqu'au timeout TCP de l'OS. *Correctif :* chien de garde de 130 s (juste au-dessus du timeout serveur), réarmé à chaque donnée reçue, qui interrompt proprement le flux et affiche un message explicite distinct de l'annulation manuelle.

### 5.6 Troisième passe — défauts fins et améliorations produit

**R-3 — Renommage via `window.prompt` peu fiable en fenêtre native. — Corrigé.** `window.prompt` est parfois désactivé dans WebView2 : le bouton de renommage risquait de ne rien faire. Remplacé par un champ éditable inline dans la barre latérale (Entrée = valider, Échap = annuler), avec mise à jour optimiste. Bug connexe corrigé au passage : l'auto-sauvegarde réécrivait le titre à partir du premier message et **écrasait un renommage** — elle préserve désormais le titre existant.

**R-4 — Le « corrective » du CRAG était neutralisé. — Corrigé (opt-in).** Le repli web ne se déclenchait qu'en l'absence totale de document ; or le retriever ramène presque toujours 5 documents, même hors sujet, donc le web ne se déclenchait jamais en mode hybride dès qu'un document existait. `retrieve` calcule maintenant les scores de pertinence et `grade_documents` déclenche le web quand le meilleur score passe sous `RELEVANCE_THRESHOLD`. Désactivé par défaut (seuil 0 = comportement historique) pour ne rien changer sans décision explicite.

**R-5 — PDF scanné indexé à vide sans avertissement. — Corrigé.** Si aucun texte n'est extrait (cas typique d'un PDF composé d'images), l'upload renvoie désormais un avertissement explicite au lieu d'un « 0 segment » silencieux.

**R-6 — Journal d'erreurs à croissance illimitée. — Corrigé.** `RotatingFileHandler` (≈ 4 Mo au total), qui capture aussi les `logging.error` des endpoints, jusqu'ici écrits nulle part.

**R-7 — Faux 404 + traversée de chemin. — Corrigé.** Le fallback renvoyait `index.html` (statut 200) pour un asset manquant ; désormais un vrai 404 pour tout chemin avec extension. Durcissement de sécurité ajouté : vérification anti path-traversal (le chemin résolu doit rester dans le dossier de build).

**R-8 — Aucune détection d'absence de clé API. — Corrigé.** Les cartes d'accueil lançaient des requêtes échouant en 500 sans clé. Une bannière détecte l'absence de clé et propose d'ouvrir les Paramètres.

**R-9 — Glisser-déposer absent. — Corrigé.** Dépôt d'un fichier n'importe où sur la fenêtre (avec superposition visuelle), en plus du trombone au clic.

**R-10 — Régénérer / éditer un message. — Ajouté.** Bouton « régénérer » sur la dernière réponse ; crayon sur une question pour la recharger dans la barre et la renvoyer.

**R-11 — `.env.example`. — Ajouté.** Documente toutes les variables (sans secret).

**R-12 — Bilingue FR/EN. — Amorcé.** Scaffold i18n (dictionnaire + helper `t()` + sélecteur de langue persistant) appliqué aux chaînes principales visibles (accueil, placeholders, modes, boutons, titres de sections). *Reste à faire :* traduire les chaînes secondaires (modale Paramètres, tableau de bord, métriques).

**R-13 — Portée documentaire par conversation. — Implémenté (opt-in, expérimental).** Chaque document est tagué d'un `scope` à l'upload (`global` par défaut, ou l'id de la conversation ouverte si le cloisonnement est actif). À la recherche, `retrieve` applique un filtre `{"scope": {"$in": [scope, "global"]}}` **uniquement** si le chat transmet un scope — sinon aucun filtre, comportement historique inchangé. Un interrupteur « Cloisonner les documents par conversation » dans les Paramètres (désactivé par défaut) pilote le tout. *Conception rétrocompatible et sécurisée :* le format du scope est validé (32 hex) côté backend ; les documents `global` restent visibles partout. *Limites connues (à valider en exécution) :* les documents indexés **avant** cette version n'ont pas de champ `scope` et ne remonteraient pas quand le filtrage est actif (les ré-uploader, ou rester en mode global) ; la liste de documents de la barre latérale reste globale (non filtrée par conversation) ; le dédoublonnage se fait toujours par nom de fichier, tous scopes confondus. **Cette fonctionnalité, comme tout le frontend, n'a pas été exécutée — à tester après le build.**

### 5.7 Qualité finale — accessibilité et internationalisation

**F-7 — Accessibilité. — Corrigé (principal).** `aria-label` ajoutés aux boutons icône-seule les plus utilisés : barre de titre (réduire/agrandir/fermer), bascule de barre latérale, sélecteur de langue, bascule de thème, trombone/image, bouton envoyer/arrêter, nouvelle conversation. Contraste du pied de page relevé (opacité 0.4 → 0.65). *Reste perfectible :* une passe axe-core complète pour couvrir les derniers éléments décoratifs.

**R-12 (suite) — i18n étendu.** La traduction FR/EN couvre désormais aussi les métriques (vitesse/corrections/web), les cartes d'accueil et leurs requêtes, le titre des suggestions, le statut « analyse en cours », et les principaux libellés de la modale Paramètres (fournisseur, clés, mot de passe, options qualité et cloisonnement). *Reste en français :* le tableau de bord des coûts (libellés déjà en anglais d'origine) et quelques messages transitoires.

---

## 6. Posture de sécurité — synthèse

| Surface | État | Détail |
|---|---|---|
| Authentification API (token) | ✅ Bon | Token fort auto-généré, comparaison en temps constant |
| Distribution du token | ✅ Résolu (réseau) | Endpoint `/api/local-token` supprimé, token injecté via pywebview (C-1) ; reste lisible dans `.env` en local |
| DNS-rebinding | ✅ Corrigé | `TrustedHostMiddleware` |
| Path traversal (upload/suppression) | ✅ Bon | `os.path.basename`, identifiants validés par regex |
| Zip-bomb (fichiers Office) | ✅ Bon | Taille décompressée vérifiée avant parsing |
| Déni de service / rate-limit | ✅ Corrigé | Concurrence + débit/minute + plafond de dépense (C-2) |
| Injection dans `.env` | ✅ Bon | Filtrage des guillemets et sauts de ligne |
| XSS | ✅ Bon | React échappe le contenu ; Markdown rendu sans HTML brut |
| Validation d'image | ✅ Corrigé | Magic bytes vérifiés (M-6) |
| Secrets au repos | 🟡 Standard | Clés API en clair dans `.env` (lisibles localement) |

**Sécurité — état après C-1 :** le vecteur réseau est éliminé (endpoint supprimé + injection pywebview). L'exposition résiduelle se limite au fichier `.env` lisible par un processus du même utilisateur — inhérent à un secret persistant en local, risque faible. Piste éventuelle : chiffrer le `.env` au repos (DPAPI Windows) si une protection contre un même-utilisateur malveillant devenait nécessaire.

---

## 7. Tests et vérification

Une suite `pytest` a été ajoutée dans `backend/tests/` et compte désormais **15 tests** : fonctions pures critiques (`resolve_model`, embeddings multilingues, validation d'image, rate-limit, plafond de dépense), recherche web simulée sans clé Tavily, injection du token (`WindowApi.get_token`), et endpoints via `TestClient` (ping public, auth exigée, identifiant invalide). Statut de vérification : les 15 tests sont **cohérents avec le code** (contrôlé par lecture), mais leur passage « au vert » n'a **pas pu être confirmé en exécution** de mon côté (sandbox indisponible). En environnement minimal, les tests dépendant de la pile lourde sont *skipped* plutôt que *passed* — à lancer dans l'environnement réel pour confirmation. Exécution :

```bash
cd backend
pip install pytest httpx
pytest -q
```

**À faire côté utilisateur pour clôturer la validation :**

1. Lancer `python main.py` et vérifier l'ouverture de la fenêtre, la connexion automatique, un échange de chat, un upload de document.
2. Exécuter `pytest -q` et confirmer que la suite passe dans l'environnement réel.
3. Après les modifications frontend, reconstruire le build statique : `cd frontend && npm run build` (sans quoi les changements de `page.tsx` — renommage, pause d'animation, version, correctifs d'export/historique — ne seront pas servis par l'application).
4. Comme le modèle d'embeddings par défaut a changé, vider `chroma_db/` et ré-uploader les documents existants.

---

## 8. Fichiers modifiés / ajoutés

| Fichier | Nature |
|---|---|
| `backend/crag_engine.py` | `resolve_model()`, défaut Gemini 2.5, embeddings multilingues configurables |
| `backend/main.py` | TrustedHost, rate-limit/concurrence/plafond, validation image, PATCH conversations, `min_size`, `atexit` port, nettoyage messages, `KING2MO_DEBUG`, écriture atomique des conversations (R-1) |
| `backend/seed_data.py` | Alignement sur FastEmbed |
| `backend/seed_handbook.py` | Alignement sur FastEmbed |
| `backend/requirements.txt` | Versions plancher épinglées |
| `backend/tests/test_api.py` | Suite pytest (nouveau) |
| `backend/tests/__init__.py` | Package de tests (nouveau) |
| `frontend/app/page.tsx` | Export corrigé, troncature historique, tarifs/étiquette, renommage, pause animation, `APP_VERSION`, timeout client du flux de chat (R-2) |
| `frontend/package.json` | Version 3.2.0 |
| `README.md` | Réécrit (architecture desktop, config, migration) |
| `RAPPORT_AUDIT.md` | Rapport d'audit détaillé (nouveau) |
| `RAPPORT_COMPLET.md` | Le présent document (nouveau) |

---

## 9. Variables d'environnement (`backend/.env`)

| Variable | Rôle | Défaut |
|---|---|---|
| `BACKEND_API_TOKEN` | Token d'accès (auto-généré au 1er lancement) | généré |
| `LLM_PROVIDER` | `gemini`, `deepseek`, `gemini-openai`, `ollama`, `custom` | `gemini` |
| `GEMINI_API_KEY` | Clé du fournisseur LLM | — |
| `TAVILY_API_KEY` | Clé Tavily (recherche web) | — |
| `LLM_MODEL` | Nom du modèle (tous fournisseurs) | `gemini-2.5-flash` |
| `LLM_BASE_URL` | URL de base (`custom` / `ollama`) | — |
| `EMBED_MODEL` | Modèle d'embeddings FastEmbed | multilingue MiniLM-L12 |
| `RELEVANCE_THRESHOLD` | Seuil [0-1] de repli web du CRAG (0 = désactivé) | 0 |
| `ALLOWED_ORIGINS` | Origines CORS (mode dev) | localhost:3000 / 3050 |
| `MAX_UPLOAD_MB` | Taille max d'un upload | 25 |
| `MAX_CONCURRENT_CHATS` | Requêtes chat simultanées max | 3 |
| `MAX_CHATS_PER_MINUTE` | Requêtes chat par minute max | 30 |
| `DAILY_SPEND_CAP_USD` | Plafond de dépense estimée / jour (0 = illimité) | 0 |
| `PRICE_<PROVIDER>_IN/_OUT` | Surcharge des tarifs ($/1M tokens) — ou fichier `pricing.json` | défauts intégrés |
| `KING2MO_DEBUG` | `1` = DevTools de la fenêtre | désactivé |

---

## 10. Feuille de route recommandée

### 10.1 Réglé dans cette itération

- **Table de tarifs configurable.** Endpoint `GET /api/pricing` (défauts + surcharge par `pricing.json` ou variables `PRICE_<PROVIDER>_IN/_OUT`) ; le frontend le consomme, avec repli sur les tarifs codés en dur.
- **Couverture de tests étendue.** Ajout de : endpoint pricing, validation du champ `scope` (R-13), et **flux chat SSE moqué** (faux graphe CRAG, sans vrai LLM).
- **Intégration continue.** `.github/workflows/ci.yml` : `pytest` backend + `npm run build` frontend à chaque push/PR.
- **Script de validation en un clic.** `validate.bat` (build frontend + tests backend) à la racine.
- **Chiffrement des secrets — utilitaire.** `backend/secure_store.py` (DPAPI Windows, opt-in, non câblé dans le chemin critique) + procédure dans `BUILD_NOTES.md`.
- **Signature de l'exécutable — documentée.** Procédure `signtool` complète dans `BUILD_NOTES.md` (nécessite le certificat du distributeur).
- **Accessibilité (F-7), R-13, i18n étendu** — cf. sections 5.6 / 5.7.

### 10.2 Reste — inéluctablement côté utilisateur (exécution / certificat)

1. **Valider en exécution.** Lancer `validate.bat` (ou `npm run build` puis `pytest -q`), puis `python main.py` pour confirmer l'auto-connexion native. **Prérequis absolu avant distribution** : sans rebuild, la moitié frontend de C-1 et tous les correctifs `page.tsx` ne sont pas servis.
2. **Tester R-13** manuellement (activer le cloisonnement, uploader dans une conversation, vérifier l'isolement).
3. **Signer l'exécutable** avec votre certificat (procédure fournie).
4. **Optionnel :** intégrer `secure_store` au flux `.env` si une protection même-utilisateur devient nécessaire ; compléter la traduction du tableau de bord ; passe axe-core complète.

---

*Rapport établi le 5 juillet 2026. Les correctifs décrits sont présents dans le code source ; leur validation en exécution (lancement de l'application et suite de tests) reste à réaliser dans l'environnement de l'utilisateur, la sandbox ayant été indisponible durant l'intervention.*
