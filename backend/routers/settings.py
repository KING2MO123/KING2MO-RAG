import os
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from security import require_token
from config import _VALID_PROVIDERS, _mask_key, _env_file_path

router = APIRouter()

class SettingsUpdate(BaseModel):
    llm_provider: Optional[str] = None
    gemini_api_key: Optional[str] = Field(default=None, max_length=300)
    tavily_api_key: Optional[str] = Field(default=None, max_length=300)
    # Fournisseur "custom" : toute API compatible OpenAI
    llm_base_url: Optional[str] = Field(default=None, max_length=300)
    llm_model: Optional[str] = Field(default=None, max_length=120)
    clear_llm_key: Optional[bool] = None
    clear_tavily_key: Optional[bool] = None

@router.get("/api/settings")
async def get_settings(_auth: bool = Depends(require_token)):
    return {
        "llm_provider": os.environ.get("LLM_PROVIDER", ""),
        "llm_api_key_masked": _mask_key(os.environ.get("GEMINI_API_KEY", "")),
        "tavily_api_key_masked": _mask_key(os.environ.get("TAVILY_API_KEY", "")),
        "llm_base_url": os.environ.get("LLM_BASE_URL", ""),
        "llm_model": os.environ.get("LLM_MODEL", ""),
    }

@router.post("/api/settings")
async def update_settings(update: SettingsUpdate, _auth: bool = Depends(require_token)):
    provider = (update.llm_provider or "").strip().lower()
    if provider and provider not in _VALID_PROVIDERS:
        return {"status": "error", "message": f"Fournisseur inconnu : {provider}"}

    changes = {}
    removals = set()

    if provider:
        changes["LLM_PROVIDER"] = provider
        
    if update.gemini_api_key and update.gemini_api_key.strip():
        val = update.gemini_api_key.strip()
        if "…" not in val and "•" not in val and "\n" not in val and '"' not in val:
            changes["GEMINI_API_KEY"] = val
    elif update.clear_llm_key:
        removals.add("GEMINI_API_KEY")
            
    if update.tavily_api_key and update.tavily_api_key.strip():
        val = update.tavily_api_key.strip()
        if "…" not in val and "•" not in val and "\n" not in val and '"' not in val:
            changes["TAVILY_API_KEY"] = val
    elif update.clear_tavily_key:
        removals.add("TAVILY_API_KEY")

    # Fournisseur "custom" : URL de base + nom du modèle (mêmes gardes anti-injection).
    if update.llm_base_url and update.llm_base_url.strip():
        val = update.llm_base_url.strip()
        if val.startswith(("http://", "https://")) and "\n" not in val and '"' not in val:
            changes["LLM_BASE_URL"] = val

    if update.llm_model is not None:
        val = update.llm_model.strip()
        if val == "":
            removals.add("LLM_MODEL")
        elif "\n" not in val and '"' not in val:
            changes["LLM_MODEL"] = val

    if not changes and not removals:
        return {"status": "warning", "message": "Aucun changement fourni."}

    # Relit le .env existant en préservant l'ordre et les clés non modifiées
    env_path = _env_file_path()
    values, order = {}, []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for raw in f.read().splitlines():
                s = raw.strip()
                if not s or s.startswith("#") or "=" not in s:
                    continue
                k, v = s.split("=", 1)
                k = k.strip()
                if k not in values:
                    order.append(k)
                values[k] = v.strip()

    for k, v in changes.items():
        values[k] = f'"{v}"'
        if k not in order:
            order.append(k)
        os.environ[k] = v  # effet immédiat, sans redémarrage

    for k in removals:
        if k in values:
            del values[k]
        if k in order:
            order.remove(k)
        os.environ.pop(k, None)

    with open(env_path, "w", encoding="utf-8") as f:
        for k in order:
            if k in values:
                f.write(f"{k}={values[k]}\n")

    return {"status": "success", "message": "Paramètres enregistrés ✓"}
