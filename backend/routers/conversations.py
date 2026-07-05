import os
import sys
import re
import json
import tempfile
from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from security import require_token

router = APIRouter()

# ---------------------------------------------------------------------
# Conversations : sauvegarde sur disque (fichiers JSON à côté de l'exe),
# durable et sans limite de quota navigateur.
# ---------------------------------------------------------------------
_CONV_ID_RE = re.compile(r"^[a-f0-9]{32}$")

def _conversations_dir() -> str:
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    d = os.path.join(base, "conversations")
    os.makedirs(d, exist_ok=True)
    return d


def _atomic_write_json(path: str, data: Any) -> None:
    """Écriture atomique : on écrit dans un fichier temporaire du même dossier,
    on force le vidage disque, puis on renomme (os.replace est atomique sur un
    même système de fichiers). Une coupure de courant en plein milieu laisse
    donc soit l'ancien fichier intact, soit le nouveau complet — jamais un
    JSON tronqué et illisible."""
    directory = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    except BaseException:
        # En cas d'échec, on ne laisse pas de fichier .tmp orphelin.
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except OSError:
            pass
        raise


class ConversationSave(BaseModel):
    id: Optional[str] = Field(default=None, max_length=64)
    title: str = Field(default="Conversation", max_length=200)
    messages: List[Dict[str, Any]] = Field(default=[], max_length=200)


@router.get("/api/conversations")
async def list_conversations(_auth: bool = Depends(require_token)):
    items = []
    d = _conversations_dir()
    for fn in os.listdir(d):
        if not fn.endswith(".json"):
            continue
        path = os.path.join(d, fn)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            items.append({
                "id": fn[:-5],
                "title": data.get("title", "Conversation"),
                "updated": os.path.getmtime(path),
            })
        except Exception:
            continue  # fichier corrompu : on l'ignore
    items.sort(key=lambda x: x["updated"], reverse=True)
    return {"conversations": items, "status": "success"}


@router.get("/api/conversations/{conv_id}")
async def get_conversation(conv_id: str, _auth: bool = Depends(require_token)):
    if not _CONV_ID_RE.match(conv_id):
        raise HTTPException(status_code=400, detail="Identifiant de conversation invalide.")
    path = os.path.join(_conversations_dir(), f"{conv_id}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return {"conversation": data, "id": conv_id, "status": "success"}
    except Exception as e:
        import logging
        logging.error(f"Read conversation error: {e}")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue.")


@router.post("/api/conversations")
async def save_conversation(payload: ConversationSave, _auth: bool = Depends(require_token)):
    import uuid as _uuid
    conv_id = payload.id or _uuid.uuid4().hex
    if not _CONV_ID_RE.match(conv_id):
        raise HTTPException(status_code=400, detail="Identifiant de conversation invalide.")
    path = os.path.join(_conversations_dir(), f"{conv_id}.json")
    try:
        _atomic_write_json(path, {"title": payload.title, "messages": payload.messages})
        return {"id": conv_id, "status": "success"}
    except Exception as e:
        import logging
        logging.error(f"Save conversation error: {e}")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue.")


class ConversationRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


@router.patch("/api/conversations/{conv_id}")
async def rename_conversation(conv_id: str, payload: ConversationRename, _auth: bool = Depends(require_token)):
    """(M-4) Renomme une conversation sans toucher à ses messages."""
    if not _CONV_ID_RE.match(conv_id):
        raise HTTPException(status_code=400, detail="Identifiant de conversation invalide.")
    path = os.path.join(_conversations_dir(), f"{conv_id}.json")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Conversation introuvable.")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["title"] = payload.title.strip() or data.get("title", "Conversation")
        _atomic_write_json(path, data)
        return {"id": conv_id, "title": data["title"], "status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        import logging
        logging.error(f"Rename conversation error: {e}")
        raise HTTPException(status_code=500, detail="Une erreur interne est survenue.")


@router.delete("/api/conversations/{conv_id}")
async def delete_conversation(conv_id: str, _auth: bool = Depends(require_token)):
    if not _CONV_ID_RE.match(conv_id):
        raise HTTPException(status_code=400, detail="Identifiant de conversation invalide.")
    path = os.path.join(_conversations_dir(), f"{conv_id}.json")
    if os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            raise HTTPException(status_code=500, detail="Suppression impossible.")
    return {"status": "success"}
