# KING2MO - Agentic RAG Application

Ce projet implémente **KING2MO**, une application desktop Windows (pywebview + Edge Chromium) d'**Agentic Retrieval-Augmented Generation (Corrective RAG)**, fonctionnant entièrement en local. Elle associe une interface Next.js à un moteur IA propulsé par FastAPI, LangGraph et Google Gemini.

---

> [!TIP]
> *Insère ici une capture d'écran de l'interface principale (ex: `![Interface Principale](docs/screenshot1.png)`)*

## ✨ Fonctionnalités Clés

* 🔒 **100% Local & Privé :** Tes clés API restent sur ta machine, tes documents ne sont pas envoyés sur des serveurs tiers pour l'entraînement.
* 🧠 **Agentic RAG Intelligent :** Route dynamiquement entre tes documents locaux et la recherche web (Tavily) selon le contexte de la question.
* 🎨 **Design Premium :** Interface moderne, Dark Mode natif, glassmorphism, et streaming de texte ultra-fluide.
* 💰 **Contrôle des coûts :** Suivi en temps réel du coût de chaque requête via un compteur intégré.
* 📦 **Standalone :** Compilable en un seul fichier exécutable `.exe` pour Windows, sans installation complexe.

---

## ⚙️ Architecture du Système

### 1. Le Moteur IA (Backend - FastAPI)
Situé dans le dossier `/backend`. Point d'entrée : `main.py` (serveur API **et** fenêtre native pywebview).
Un graphe de décision avancé (CRAG) implémenté avec **LangGraph** :
- **Contextualize & Route** : reformulation de la question selon l'historique, puis routage intelligent (web / local / hybride).
- **Retrieve** : recherche sémantique dans la base vectorielle locale (ChromaDB + FastEmbed).
- **Web Search Fallback** : si les documents locaux sont insuffisants, recherche web via l'API **Tavily**.
- **Generate & Self-Correction** : génération avec citations [1], [2]…, puis auto-évaluation optionnelle (mode Qualité) anti-hallucination.

### 2. L'Interface Utilisateur (Frontend - Next.js)
Situé dans le dossier `/frontend`, exporté en statique (`frontend/out`) et servi par FastAPI.
- **Design System** : dark mode, glassmorphism, typographie JetBrains Mono & Outfit.
- **Chat** : streaming mot-à-mot, Markdown, coloration syntaxique, sources cliquables.
- **Documents** : glisser-déposer PDF / TXT / DOCX / XLSX / PPTX (25 Mo max, anti zip-bomb).

---

## 🛠️ Installation & Démarrage

### Prérequis
- Node.js (v18+), Python (3.10+)
- Une clé [Google AI Studio (Gemini)](https://aistudio.google.com/) et une clé [Tavily](https://tavily.com/)

### Mode application (recommandé)

```bash
cd backend
pip install -r requirements.txt
python main.py   # démarre le serveur ET ouvre la fenêtre native
```

Le serveur choisit automatiquement un port libre (8000, 8080, 8501, 3050, sinon aléatoire) et n'écoute que sur 127.0.0.1.

### Mode développement (frontend à chaud)

```bash
# Terminal 1
cd backend && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Pour reconstruire le frontend statique servi par l'application : `cd frontend && npm run build` (produit `frontend/out`).

---

## 🔧 Configuration (`backend/.env`)

| Variable | Rôle | Défaut |
|---|---|---|
| `BACKEND_API_TOKEN` | Token d'accès à l'API (généré automatiquement au 1er lancement) | généré |
| `LLM_PROVIDER` | `gemini`, `deepseek`, `gemini-openai`, `ollama`, `custom` | `gemini` |
| `GEMINI_API_KEY` | Clé API du fournisseur LLM | — |
| `TAVILY_API_KEY` | Clé Tavily (recherche web) | — |
| `LLM_MODEL` | Nom du modèle (tous fournisseurs) | `gemini-2.5-flash` |
| `LLM_BASE_URL` | URL de base (fournisseurs `custom` / `ollama`) | — |
| `EMBED_MODEL` | Modèle d'embeddings FastEmbed | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| `RELEVANCE_THRESHOLD` | Seuil [0-1] de déclenchement du repli web (0 = désactivé) | 0 |
| `ALLOWED_ORIGINS` | Origines CORS autorisées | localhost:3000 / 3050 |
| `MAX_UPLOAD_MB` | Taille max d'un fichier uploadé | 25 |
| `MAX_CONCURRENT_CHATS` | Requêtes chat simultanées max (au-delà : 429) | 3 |
| `MAX_CHATS_PER_MINUTE` | Requêtes chat/minute max (au-delà : 429) | 30 |
| `DAILY_SPEND_CAP_USD` | Plafond de dépense estimée par jour (0 = illimité) | 0 |
| `KING2MO_DEBUG` | `1` = active les DevTools de la fenêtre | désactivé |

### Tests

```bash
cd backend
pip install pytest httpx
pytest -q
```

## ⚠️ Migration embeddings (juillet 2026)

Le modèle d'embeddings par défaut est passé de `BAAI/bge-small-en-v1.5` (anglais uniquement) à un modèle **multilingue**, bien meilleur sur les documents français. Les anciens vecteurs ne sont pas compatibles : après mise à jour, **videz la base documentaire** (bouton dans l'interface, ou supprimez `backend/chroma_db/`) puis ré-uploadez vos documents.

---

## 📂 Structure du Projet

```text
/
├── backend/
│   ├── main.py             # API FastAPI + fenêtre native pywebview
│   ├── crag_engine.py      # Graphe CRAG (LangGraph)
│   ├── seed_data.py        # Script d'ingestion de la base Chroma
│   └── requirements.txt    # Dépendances Python
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx        # Application React principale
│   │   ├── layout.tsx      # Structure HTML et métadonnées
│   │   └── globals.css     # CSS pur, thèmes et animations
│   ├── package.json        # Dépendances NPM
│   └── out/                # Build statique servi par FastAPI
```

---

## 🤝 Contribuer

Les contributions, signalements de bugs et demandes de fonctionnalités sont les bienvenues ! N'hésitez pas à consulter les *issues* ou à ouvrir une *Pull Request*.

---

## 📄 Licence

Ce projet est sous licence MIT. Consultez le fichier `LICENSE` pour plus de détails.

---

## 👥 Crédits
Design de l'interface et architecture développés en collaboration avec des assistants IA (**Antigravity**, **Claude**).
