# Synthèse Globale du Projet : KING2MO - Agentic RAG v3.0

Ce document récapitule l'ensemble des discussions, choix techniques, architectures et itérations esthétiques réalisés lors du développement de l'application **KING2MO**.

---

## 1. Vision et Objectifs
L'objectif était de concevoir et réaliser un assistant de recherche intelligent de pointe basé sur le principe du **RAG Agentique (Retrieval-Augmented Generation)**, capable de :
- Interroger de grands modèles de langage (Gemini).
- Parcourir le Web en temps réel via des agents (Tavily).
- Analyser des documents locaux (PDF importés, découpés et stockés vectoriellement).
- S'auto-corriger automatiquement si les informations initialement récupérées sont jugées insuffisantes.
- Offrir une expérience utilisateur de niveau professionnel, ultra-premium, fluide et esthétique sous forme de chat conversationnel.

---

## 2. Architecture Technique

Le projet est divisé en deux entités distinctes communicant par API :

### A. Le Backend (FastAPI + Python)
- **Framework** : FastAPI pour des performances optimales et une communication asynchrone facilitée (Server-Sent Events pour le streaming).
- **Moteur RAG** : 
  - Extraction de PDF, segmentation (chunking) intelligente et stockage temporaire.
  - Calcul d'embeddings vectoriels pour la recherche sémantique locale.
- **Agent de Décision (Agentic Flow)** :
  - **Mode Local** : Recherche uniquement dans les documents importés.
  - **Mode Web** : Recherche d'actualités et données web via l'API Tavily.
  - **Mode Hybride** : Croisement des sources locales et web pour une réponse ultra-complète.
- **Boucle d'Auto-Correction** : Un agent évalue la pertinence de la réponse générée par rapport aux documents sources. Si des hallucinations sont détectées ou si l'information est incomplète, le backend relance un cycle de génération/correction (comptabilisé dans les métriques utilisateur).

### B. Le Frontend (Next.js + Tailwind / Vanilla CSS)
- **Framework** : Next.js 16 (App Router + Turbopack).
- **Mise en page** : CSS moderne (CSS Grid, Flexbox, variables HSL, Glassmorphism, animations GPU).
- **Rendu du texte** : Support complet du Markdown via `react-markdown` et coloration syntaxique du code avec `react-syntax-highlighter`.

---

## 3. Le Processus de Vectorisation Locale (RAG)

Pour le traitement des documents locaux (.pdf), l'application suit un pipeline sémantique strict exécuté entièrement sur le PC de l'utilisateur :

1. **Extraction (PyPDFLoader)** : Les documents importés par l'utilisateur sont analysés et textuellement extraits page par page.
2. **Segmentation sémantique (RecursiveCharacterTextSplitter)** :
   - Le texte est découpé en segments d'une taille de **1000 caractères**.
   - Un chevauchement (overlap) de **200 caractères** est appliqué entre chaque segment adjacent pour conserver le contexte sémantique aux frontières des découpes.
3. **Génération de Vecteurs (all-MiniLM-L6-v2)** :
   - Les segments textuels sont convertis en vecteurs numériques de **384 dimensions** représentant leur contenu sémantique.
   - Cette conversion s'effectue localement via le modèle open-source d'embeddings **HuggingFace `all-MiniLM-L6-v2`** (sans appel réseau ni frais d'API).
4. **Base de Données Vectorielle (ChromaDB)** : Les vecteurs et métadonnées associées sont sauvegardés localement dans le dossier `backend/chroma_db` pour permettre une recherche par similarité cosinus instantanée lors des requêtes.

---

## 4. Itérations et Améliorations de l'Interface (UX/UI)

### 1. Habillage de l'espace vide (Lumière et Texture)
- **Halos Ambiants (Studio Glow)** : Ajout de grands cercles de lumière diffuse (vert émeraude à gauche, rose/violet magenta à droite) animés par de légères pulsations. Ils comblent le vide sur grand écran sans surcharger l'affichage.
- **Texture Grain** : Superposition d'un filtre "bruit de film" très discret pour casser l'aspect trop lisse et "plat" du fond sombre.
- **Réseau Neuronal Interactif** : Un Canvas interactif de réseau neuronal en constellation dérive doucement en arrière-plan, reliant des nœuds de données par des rayons émeraude, symbolisant le traitement RAG.

### 2. Transition vers l'interface de Chat IA (v3.0)
L'application est passée d'un mode de recherche à turn unique à une **interface de discussion conversationnelle fluide** :
- **Fil de Discussion Continu** : Les questions de l'utilisateur et les réponses de l'assistant s'empilent verticalement, avec un défilement automatique vers le bas. Les espacements ont été resserrés pour garantir une lecture fluide (marge de 2.5rem entre les tours, 0.5rem au sein du même tour).
- **Barre de Recherche Sticky Bottom** : La barre de recherche se fixe proprement au bas de l'écran dès que la discussion commence. Sa largeur est dynamique (680px centrée sur l'accueil, extensible à 100% de la zone de chat).
- **Remplacement de la colonne latérale par un affichage Inline** :
  - **Sources Horizontales** : Pour éviter les bugs de superposition et de hauteur avec la colonne de droite, les sources de chaque message s'affichent sous forme de **carrousel à défilement horizontal** juste sous la réponse.
  - **Métriques et Actions au pied du message** : Les boutons copier/télécharger et les métriques de traitement (vitesse, corrections, appui web) se situent discrètement sous chaque message de manière intégrée.
- **Ergonomie globale** : Ajout d'une croix de retour "X" à côté du champ de recherche et bouton logo interactif pour réinitialiser le chat instantanément.

---

## 5. Statut et Prochaines Étapes
- Le code est propre, exempt d'erreurs de syntaxe ou de compilation.
- Le README du projet a été intégralement mis à jour pour documenter le lancement du Backend et du Frontend.
- Toutes les modifications ont été `commit` et `push` sur la branche principale du dépôt GitHub.
