# KING2MO - Agentic RAG Application

Ce projet implémente **KING2MO**, une application web ultra-moderne d'**Agentic Retrieval-Augmented Generation (Corrective RAG)**. Elle associe une interface frontend Next.js à un moteur IA de pointe propulsé par FastAPI, LangGraph, et Google Gemini.

---

## ⚙️ Architecture du Système

Le projet est divisé en deux parties distinctes :

### 1. Le Moteur IA (Backend - FastAPI)
Situé dans le dossier `/backend`.
Un graphe de décision avancé (CRAG) implémenté avec **LangGraph** :
- **Retrieve** : Recherche sémantique dans la base de données vectorielle locale (Chroma).
- **Grade Documents** : Évaluation LLM de la pertinence des documents extraits.
- **Web Search Fallback** : Si les documents sont insuffisants, l'agent déclenche automatiquement une recherche web via l'API **Tavily**.
- **Generate & Self-Correction** : Le LLM (Gemini 2.5) génère une réponse, puis s'auto-évalue (Grounding Check & Usefulness Check) pour éliminer les hallucinations.

### 2. L'Interface Utilisateur (Frontend - Next.js)
Situé dans le dossier `/frontend`.
Une interface web ultra-premium et minimaliste :
- **Design System** : Thème sombre par défaut (Dark Mode), composants "Glassmorphism", et typographie élégante (Inter & JetBrains Mono).
- **Animations** : Arrière-plan génératif "Réseau Neuronal" exclusif et halos de lumière ambiante (Ambient Glow).
- **Intégration** : Upload de PDF locaux directement depuis la barre de recherche.
- **Feedback visuel** : Affichage des sources, boutons de copie et de téléchargement Markdown.

---

## 🛠️ Installation & Démarrage

### Prérequis
- Node.js (v18+)
- Python (3.10+)
- Une clé d'API [Google AI Studio (Gemini)](https://aistudio.google.com/)
- Une clé d'API [Tavily](https://tavily.com/)

### Étape 1 : Lancer le Backend (Python/FastAPI)

Ouvrez un terminal et exécutez les commandes suivantes :

```bash
cd backend

# Installer les dépendances
pip install -r requirements.txt

# Initialiser la base de données vectorielle locale
python seed_data.py

# Démarrer le serveur API
uvicorn main:app --reload --port 8000
```
L'API sera disponible sur `http://localhost:8000`.

### Étape 2 : Lancer le Frontend (Next.js)

Ouvrez un **second terminal** :

```bash
cd frontend

# Installer les paquets
npm install

# Lancer le serveur de développement
npm run dev
```
L'application sera accessible sur `http://localhost:3000` (ou 3001).

---

## 📂 Structure du Projet

```text
/
├── backend/
│   ├── main.py             # Point d'entrée de l'API FastAPI
│   ├── crag_engine.py      # Logique complexe du Graphe LangGraph
│   ├── seed_data.py        # Script d'ingestion de la base Chroma
│   └── requirements.txt    # Dépendances Python
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx        # Application React principale
│   │   ├── layout.tsx      # Structure HTML et métadonnées
│   │   └── globals.css     # CSS pur, thèmes et animations
│   ├── package.json        # Dépendances NPM
│   └── public/             # Assets statiques
```

---

## 👥 Crédits
Design de l'interface et architecture développés en collaboration avec l'assistant IA **Antigravity**.

