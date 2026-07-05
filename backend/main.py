import sys
import os as _os

# Exe compilé sans console (PyInstaller console=False) : stdout/stderr sont None,
# ce qui fait planter uvicorn/logging (.isatty()). On les redirige vers le néant.
if sys.stdout is None:
    sys.stdout = open(_os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(_os.devnull, "w", encoding="utf-8")

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import asyncio
import json
import re
import secrets
import time
import os
from dotenv import load_dotenv

load_dotenv()


from config import _env_file_path, _PLACEHOLDER_TOKENS, _ensure_backend_token, _VALID_PROVIDERS, _mask_key

GENERATED_TOKEN = _ensure_backend_token()

# (PERF) Import paresseux : crag_engine (LangChain, ChromaDB, LangGraph…)
# n'est plus importé ici mais en arrière-plan après le démarrage du serveur.
# La fenêtre s'ouvre ainsi en 1-2 s au lieu d'attendre les imports lourds.

app = FastAPI(title="KING2MO RAG API")

# (S1) Anti DNS-rebinding : sans vérification du Host, un site malveillant
# pointant un domaine attaquant vers 127.0.0.1 devient "same-origin" et peut
# lire /api/local-token puis piloter toute l'API. On n'accepte que les Hosts
# locaux légitimes.
from fastapi.middleware.trustedhost import TrustedHostMiddleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "[::1]"])

# CORS : uniquement les origines explicitement autorisées (M1).
# Configurable via ALLOWED_ORIGINS (valeurs séparées par des virgules).
_allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3050,http://127.0.0.1:3050")
ALLOWED_ORIGINS = [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    # (N10) Resserré : uniquement les méthodes/en-têtes réellement utilisés.
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "X-API-Token"],
)


# Auth obligatoire : exige le BACKEND_API_TOKEN défini dans le .env
from security import require_token




from routers import chat
app.include_router(chat.router)

from routers import documents
app.include_router(documents.router)

# ---------------------------------------------------------------------
# Conversations : sauvegarde sur disque (fichiers JSON à côté de l'exe),
# durable et sans limite de quota navigateur.
# ---------------------------------------------------------------------
from routers import conversations
app.include_router(conversations.router)


# ---------------------------------------------------------------------
# Paramètres (fournisseur LLM + clés API), modifiables depuis l'interface.
# Écrits dans le .env à côté de l'exe (ou de main.py en dev).
# ---------------------------------------------------------------------
# Importés depuis config.py : _VALID_PROVIDERS, _mask_key, _env_file_path

from routers import settings
app.include_router(settings.router)



# ---------------------------------------------------------------------
# Serveur Static (Frontend Monolithe)
# ---------------------------------------------------------------------
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
import sys

# Résolution du chemin absolu du dossier "out" du frontend
base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_build_path = os.path.join(base_dir, "..", "frontend", "out")

# Si on est dans un exécutable PyInstaller (_MEIPASS), le dossier est différent
if hasattr(sys, '_MEIPASS'):
    frontend_build_path = os.path.join(sys._MEIPASS, "frontend_out")

# Si le dossier de build existe (version compilée ou standalone), on le monte sur la racine
if os.path.isdir(frontend_build_path):
    app.mount("/_next", StaticFiles(directory=os.path.join(frontend_build_path, "_next")), name="next_assets")
    
    # On gère manuellement la racine et les 404 pour l'application mono-page Next.js
    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_build_path, 'index.html'))

    @app.exception_handler(404)
    async def custom_404_handler(request, exc):
        if request.url.path.startswith("/api/"):
            return HTMLResponse(content="API Route Not Found", status_code=404)
        
        # Sert les fichiers statiques (favicon.ico, images) s'ils existent
        req_path = request.url.path.lstrip("/")
        if req_path:
            # (R-7 / sécurité) Anti path-traversal : on résout le chemin absolu
            # et on vérifie qu'il reste STRICTEMENT dans le dossier de build.
            base_abs = os.path.realpath(frontend_build_path)
            file_path = os.path.realpath(os.path.join(base_abs, req_path))
            inside = file_path == base_abs or file_path.startswith(base_abs + os.sep)
            if inside and os.path.isfile(file_path):
                return FileResponse(file_path)

            # (Faux Fichier Bug) Si ça ressemble à un fichier statique introuvable,
            # ou si le chemin tente de sortir du dossier, on renvoie un vrai 404.
            if not inside or "." in req_path.split("/")[-1]:
                return HTMLResponse(content="Fichier Introuvable", status_code=404)

        return FileResponse(os.path.join(frontend_build_path, 'index.html'))

# ---------------------------------------------------------------------
# (Feuille de route) Table de tarifs configurable.
# Le frontend consomme cet endpoint au lieu de tarifs codés en dur, ce qui
# permet d'ajuster les prix sans reconstruire l'application. Surcharge possible
# par un fichier pricing.json (à côté de l'exe / du script) ou par variables
# d'environnement PRICE_<PROVIDER>_IN / _OUT (USD par million de tokens).
# ---------------------------------------------------------------------
_DEFAULT_PRICING = {
    # provider : {in: $/1M tokens entrée, out: $/1M tokens sortie}
    "gemini":        {"in": 0.30, "out": 2.50, "label": "Gemini 2.5 Flash"},
    "gemini-openai": {"in": 0.30, "out": 2.50, "label": "Gemini (API OpenAI)"},
    "deepseek":      {"in": 0.14, "out": 0.28, "label": "DeepSeek V3"},
    "ollama":        {"in": 0.0,  "out": 0.0,  "label": "Ollama (local)"},
    "custom":        {"in": 0.0,  "out": 0.0,  "label": "Modèle personnalisé"},
    # Coût forfaitaire estimé d'une recherche web Tavily (par appel).
    "_search_cost":  0.005,
}


def _pricing_file_path() -> str:
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "pricing.json")


@app.get("/api/pricing")
def pricing(_auth: bool = Depends(require_token)):
    """Retourne la table de tarifs effective (défauts + surcharges éventuelles)."""
    import copy
    table = copy.deepcopy(_DEFAULT_PRICING)

    # 1) Surcharge par fichier pricing.json s'il existe.
    path = _pricing_file_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                override = json.load(f)
            for k, v in override.items():
                if k in table and isinstance(v, dict):
                    table[k].update(v)
                else:
                    table[k] = v
        except Exception:
            import logging
            logging.warning("pricing.json illisible, tarifs par défaut utilisés.")

    # 2) Surcharge fine par variables d'environnement.
    for prov in ("gemini", "gemini-openai", "deepseek", "ollama", "custom"):
        env_key = prov.replace("-", "_").upper()
        for side in ("in", "out"):
            val = os.environ.get(f"PRICE_{env_key}_{side.upper()}")
            if val:
                try:
                    table[prov][side] = float(val)
                except ValueError:
                    pass
    return {"pricing": table, "status": "success"}


# ---------------------------------------------------------------------
# Ré-exports pour la compatibilité avec les tests existants
# ---------------------------------------------------------------------
from security import _validate_image_base64
from routers.chat import ChatRequest, HistoryItem
from desktop import WindowApi

@app.get("/api/ping")
def ping():
    return {"status": "ok"}

if __name__ == "__main__":
    from desktop import launch
    launch(app)
