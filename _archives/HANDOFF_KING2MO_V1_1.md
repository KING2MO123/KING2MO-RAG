# RAPPORT DE TRANSFERT DE CONTEXTE (HANDOFF) - KING2MO v1.1

> **Note pour la nouvelle instance d'IA :** Ce document contient l'intégralité du contexte architectural, technique et fonctionnel du projet "KING2MO". Lis-le attentivement avant de proposer des modifications au code.

## 1. Contexte et Vision du Projet
KING2MO est une application d'Intelligence Artificielle basée sur une architecture **Agentic RAG (Corrective Retrieval Augmented Generation)**. 
L'objectif est d'avoir une interface web moderne et ultra-réactive, tout en packageant l'ensemble (Frontend + Backend + IA) sous la forme d'une **application de bureau standalone (fichier `.exe`)** pour Windows via PyInstaller.

## 2. Stack Technique
* **Frontend** : Next.js 14, React, Vanilla CSS (`index.css`), Lucide Icons, Recharts (graphiques), `react-markdown`. (Pas de Tailwind).
* **Backend** : Python 3.12, FastAPI, Uvicorn, LangChain, LangGraph, ChromaDB (Vector Store local).
* **Modèles supportés** : Google Gemini (1.5 Flash/Pro), DeepSeek (via proxy OpenAI), avec support multimodal (Vision).
* **Outils d'Agent** : Tavily (recherche Web), PythonREPLTool (Exécution de code Python local).
* **Build & Déploiement** : PyInstaller (en mode `--onedir` pour éviter la lenteur de décompression du mode `--onefile`). Scripts `.bat` pour automatiser les lancements et les builds.

## 3. Structure du Codebase
Le projet se trouve dans : `C:\Users\diaba\.gemini\antigravity\scratch\agentic_crag_app`

* `backend/`
  * `main.py` : Serveur FastAPI. Gère les endpoints `/api/chat` (streaming SSE), `/api/upload` (ajout de documents), la gestion de `MemorySaver` (Checkpointing) et l'authentification statique.
  * `crag_engine.py` : Moteur IA avec **LangGraph**. Gère le pipeline CRAG (Retrieve -> Grade -> Web Search (Tavily) -> Generate). Utilise `create_react_agent` dans le nœud "generate" pour doter l'IA de l'outil `PythonREPLTool`.
  * `chroma_db/` : Base de données vectorielle locale.
* `frontend/`
  * `app/page.tsx` : Composant React principal. Gère le chat, l'historique local (localStorage), l'UI dynamique (glassmorphism, animations canvas de réseau neuronal), et la lecture du flux Server-Sent Events (SSE) du backend.
  * `app/index.css` : Design system complet et tokens CSS (Dark mode, gradients, glow matrix).
* `scripts/`
  * `debug_run.bat` : Script principal pour le développement quotidien. Lance le backend Python en direct sans le compiler. (Le frontend doit être lancé à côté via `npm run dev`).
  * `rebuild_full.bat` : Script de compilation finale. Construit le frontend (Next.js export statique), l'intègre au backend, et utilise PyInstaller pour générer l'exécutable final.

## 4. Fonctionnalités Implémentées (Mise à jour v1.1 complétée)
Nous venons de terminer une refonte massive (Phase 1 & Phase 3) :
1. **Streaming de Texte (Typewriter effect)** : Le backend utilise un `QueueCallbackHandler` et des Threads pour envoyer les tokens du LLM en temps réel vers le frontend via SSE.
2. **Vision (Analyse d'Images)** : Le frontend encode les images en Base64 et les envoie au backend. `crag_engine.py` injecte l'image dans le prompt (compatible avec Gemini).
3. **Mémoire à Long Terme (Checkpointing)** : Utilisation de `MemorySaver` de LangGraph dans `main.py` avec un `thread_id` persistant pour que le graphe se souvienne de l'état complet.
4. **Exécution de Code Python** : Le nœud final `generate` de LangGraph a été converti en un mini-agent réactif (`create_react_agent` + `PythonREPLTool`). L'IA peut calculer et analyser des données elle-même.
5. **Historique Persistant UI** : Les messages du chat survivent au rafraîchissement de la page via `localStorage.getItem("rag_chat_messages")`.

## 5. Règles de Développement pour la suite
* **Pas de compilation PyInstaller pendant le développement !** Le build prend trop de temps (Numpy/SciPy/Torch pèsent lourd). Pour coder et tester, l'utilisateur lance `debug_run.bat` (Backend sur le port 8000) et `npm run dev` (Frontend sur le port 3000). Le code est déjà prévu pour ce CORS.
* **Modification du Backend** : Toutes les modifications du comportement de l'IA (LangGraph) se font dans `backend/crag_engine.py`. Le routage et le SSE sont dans `backend/main.py`.
* **Modification du Frontend** : Tout est concentré dans `frontend/app/page.tsx`. Si on ajoute des fonctionnalités (ex: Modal de source), il faut modifier l'état React de ce fichier.

## 6. Prochaines Étapes Possibles (À décider par l'utilisateur)
* Ajouter un outil SQL / Base de données dans `crag_engine.py`.
* Créer une Modal React dans `page.tsx` pour afficher les sources complètes au clic.
* Affiner les thèmes visuels.
* Refaire un `rebuild_full.bat` propre pour livrer la version finale (actuellement l'application tourne parfaitement en environnement dev).

---
**FIN DU RAPPORT.** L'agent IA qui lit ceci est maintenant à jour et prêt à assister l'utilisateur pour la suite !
