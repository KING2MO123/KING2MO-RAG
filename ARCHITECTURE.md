# Architecture Technique — KING2MO RAG

Ce document présente l'architecture globale de l'application **KING2MO RAG**, une solution *Agentic Retrieval-Augmented Generation* conçue pour fonctionner entièrement en local et distribuée sous forme d'exécutable autonome (Standalone) pour Windows.

---

## 1. Vue d'ensemble du Système

L'application suit une architecture découplée classique (Client/Serveur) mais packagée dans un monobloc pour l'utilisateur final.

- **Frontend (Client)** : Next.js exporté statiquement (SSG).
- **Backend (Serveur)** : API FastAPI embarquant le moteur d'IA (LangGraph) et servant les fichiers statiques du frontend.
- **Base de données** : SQLite (historique) + ChromaDB (vecteurs).
- **Conteneur natif** : `pywebview` utilisant le moteur Edge Chromium natif de Windows.
- **Packaging** : PyInstaller (OneDir) + Inno Setup pour la distribution.

---

## 2. Le Moteur IA (Agentic CRAG)

Le cœur de l'application repose sur un graphe d'état implémenté avec **LangGraph**, implémentant le pattern **Corrective RAG (CRAG)**.

### Le flux de traitement (Workflow)

1. **Contextualize** : Le système reformule la question de l'utilisateur en tenant compte de l'historique de la conversation (gestion de la mémoire à court terme).
2. **Retrieve** : Interrogation de la base vectorielle locale (ChromaDB) pour extraire les fragments de documents pertinents.
3. **Route & Grade** : Un agent évalue la pertinence des documents locaux trouvés. 
   - Si les documents répondent à la question : routage direct vers la génération.
   - Si les documents sont insuffisants ou hors-sujet : déclenchement d'une recherche web de repli (API Tavily) pour augmenter le contexte (*Fallback*).
4. **Generate** : Le LLM (Google Gemini, DeepSeek, ou modèle local Ollama) génère la réponse finale en intégrant des citations précises `[1]`, `[2]` pointant vers les sources (locales ou web).
5. **Self-Correction (Mode Qualité)** : (Optionnel) Un agent de validation relit la réponse générée pour vérifier l'absence d'hallucinations avant de l'afficher à l'utilisateur.

---

## 3. Gestion des Embeddings et Modèles

- **Embeddings 100% Locaux** : Afin de garantir la confidentialité absolue des documents locaux, les embeddings sont calculés localement via **FastEmbed** (`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`). Aucun texte de document n'est envoyé à une API tierce lors de l'indexation.
- **Fournisseurs LLM Flexibles** : L'architecture est agnostique au fournisseur. L'utilisateur peut basculer dynamiquement entre Google Gemini, DeepSeek, un serveur OpenAI-compatible, ou un LLM local (Ollama) directement depuis l'interface.

---

## 4. Frontend & Expérience Utilisateur

Le frontend est construit en **Next.js** (React) et utilise du CSS pur pour le design system (zéro dépendance lourde type Tailwind).

- **Design System** : Thème sombre natif, effets de *Glassmorphism*, animations fluides et typographie moderne (Inter / JetBrains Mono).
- **Performances** : Le frontend est exporté en HTML/CSS/JS statique (SSG) via `next build`. Aucun serveur Node.js n'est requis en production. FastAPI se charge de servir ces fichiers.
- **Streaming** : Les réponses du LLM sont streamées mot-à-mot à l'utilisateur (Server-Sent Events), offrant une sensation de rapidité immédiate.
- **Sécurité WebView** : Communication restreinte entre la WebView et le serveur local sur `127.0.0.1` (CORS strict).

---

## 5. Stratégie de Distribution (Standalone)

La distribution sous Windows se fait sans nécessiter l'installation de Python, Node.js ou Git chez l'utilisateur final.

1. **PyInstaller** : Compile le code source Python, les dépendances, le modèle FastEmbed et le dossier statique du frontend en un seul dossier d'exécution (`dist`). L'approche *OneDir* est privilégiée face à *OneFile* pour garantir un démarrage instantané de l'application (pas de décompression en cache).
2. **Inno Setup** : Compresse le dossier d'exécution dans un assistant d'installation (`Setup.exe`). L'installation se fait dans `{localappdata}` (Profil de l'utilisateur), évitant ainsi le besoin de droits Administrateur et facilitant les permissions d'écriture pour les bases de données (SQLite/Chroma).
3. **Sécurité des clés** : L'application n'embarque aucune clé API développeur en dur. Un fichier `.env` neutre est généré au build. Un Token de sécurité dynamique protège le serveur local contre les accès externes.
