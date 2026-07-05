import os
import queue
import threading
import time
import json
import asyncio
from functools import lru_cache
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from security import require_token
from security import (
    _chat_semaphore, _record_spend, _check_rate_limit, _check_spend_cap,
    _validate_image_base64
)

router = APIRouter()

@lru_cache(maxsize=1)
def _queue_handler_cls():
    # (PERF) Import paresseux de langchain_core, au premier chat seulement.
    from langchain_core.callbacks.base import BaseCallbackHandler

    class QueueCallbackHandler(BaseCallbackHandler):
        def __init__(self, q: queue.Queue):
            self.q = q
        def on_llm_new_token(self, token: str, **kwargs) -> None:
            self.q.put({"type": "token", "content": token})

    return QueueCallbackHandler


def _warmup_engine():
    """(PERF) Précharge le moteur RAG (imports lourds + modèle d'embeddings)
    en arrière-plan pendant que l'utilisateur découvre l'interface. Si une
    requête arrive avant la fin, elle attend simplement le chargement."""
    try:
        import crag_engine
        crag_engine.get_retriever()
    except Exception:
        pass  # au pire, le chargement se refera à la première requête


threading.Thread(target=_warmup_engine, daemon=True).start()


class HistoryItem(BaseModel):
    role: str = Field(..., max_length=50)
    content: str = Field(..., max_length=10000)

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10000)
    mode: str = "hybrid"
    history: List[HistoryItem] = Field(default=[], max_length=50) # (N5) Historique avec limite de taille
    image_base64: Optional[str] = Field(default=None, max_length=15000000)
    quality: bool = False  # Mode qualité : réactive l'auto-évaluation (plus cher)
    scope: Optional[str] = Field(default=None, max_length=64)  # (R-13) portée documentaire (id de conversation)


@router.post("/api/chat")
async def chat(payload: ChatRequest, http_request: Request, _auth: bool = Depends(require_token)):
    # (C-2) Gardes anti-abus avant toute allocation de ressource.
    _check_rate_limit()
    _check_spend_cap()
    # Concurrence bornée : on refuse proprement plutôt que d'empiler les threads.
    if not _chat_semaphore.acquire(blocking=False):
        raise HTTPException(
            status_code=429,
            detail="Trop de requêtes simultanées. Attendez la fin d'une réponse en cours.",
        )

    # (M-6) Valide l'image avant tout traitement (et libère le sémaphore si KO).
    if payload.image_base64:
        try:
            _validate_image_base64(payload.image_base64)
        except HTTPException:
            _chat_semaphore.release()
            raise

    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    tavily_key = os.environ.get("TAVILY_API_KEY", "")

    q = queue.Queue()
    from crag_engine import build_crag_graph, initial_state  # (PERF) lazy
    cb = _queue_handler_cls()(q)
    graph = build_crag_graph(gemini_key, tavily_key, callbacks=[cb])
    # Convertir l'historique (HistoryItem) en liste de dictionnaires pour initial_state
    history_dicts = [{"role": h.role, "content": h.content} for h in payload.history]
    state = initial_state(payload.query, history_dicts, payload.mode, payload.image_base64, quality=payload.quality, scope=payload.scope or "")

    # (N1) Signal d'arrêt : posé quand le client se déconnecte (bouton Stop,
    # fermeture d'onglet…). Le graphe s'arrête entre deux nœuds, ce qui évite
    # de payer les appels LLM suivants.
    stop_event = threading.Event()

    def run_graph():
        try:
            final_state = dict(state)
            for update in graph.stream(state):
                if stop_event.is_set():
                    return  # client parti : on n'exécute plus aucun nœud
                for node, out in update.items():
                    if isinstance(out, dict):
                        final_state.update(out)
                    q.put({"type": "status", "node": node})
            q.put({"type": "final_state", "state": final_state})
        except Exception as e:
            q.put({"type": "error", "message": str(e)})

    async def event_stream():
        start_time = time.time()
        last_activity = time.time()
        threading.Thread(target=run_graph, daemon=True).start()

        try:
            while True:
                # (N1) Le client a-t-il coupé la connexion ?
                if await http_request.is_disconnected():
                    stop_event.set()
                    break

                try:
                    item = q.get_nowait()
                except queue.Empty:
                    # (R2) Timeout d'inactivité de 120 s conservé.
                    if time.time() - last_activity > 120:
                        err_data = {"type": "error", "message": "❌ Délai d'attente dépassé (timeout du serveur)."}
                        yield f"data: {json.dumps(err_data)}\n\n"
                        break
                    await asyncio.sleep(0.1)
                    continue

                last_activity = time.time()
                if item["type"] == "token":
                    yield f"data: {json.dumps({'type': 'token', 'content': item['content']})}\n\n"
                    # Force Uvicorn à vider son buffer réseau pour ne pas coller tout d'un coup
                    await asyncio.sleep(0.01)
                elif item["type"] == "status":
                    yield f"data: {json.dumps({'type': 'status', 'node': item['node']})}\n\n"
                elif item["type"] == "error":
                    error_msg = item["message"]
                    if "unknown variant image_url" in error_msg:
                        error_msg = "❌ Le modèle d'IA actuel (ex: DeepSeek) ne supporte pas l'analyse d'images. Veuillez utiliser un modèle compatible (ex: Gemini 1.5, GPT-4o, Claude 3) pour envoyer des images."
                    yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
                    break
                elif item["type"] == "final_state":
                    final_state = item["state"]
                    sources = []
                    for doc in final_state.get("documents", []):
                        meta = doc.metadata or {}
                        source_name = meta.get("source", "local")
                        url = meta.get("url") or (source_name if str(source_name).startswith("http") else None)
                        snippet = doc.page_content[:300]
                        if len(doc.page_content) > 300:
                            snippet += "..."
                        sources.append({
                            "source": meta.get("title") or source_name,
                            "url": url,
                            "content": snippet,
                        })

                    # (C-2) Alimente le plafond de dépense quotidien.
                    _record_spend(
                        final_state.get("input_tokens", 0),
                        final_state.get("output_tokens", 0),
                        final_state.get("search_count", 0),
                    )

                    result = {
                        "type": "result",
                        "generation": final_state.get("generation", ""),
                        "sources": sources,
                        "corrections": final_state.get("corrections", 0),
                        "web_used": final_state.get("web_search") == "yes" or payload.mode == "web",
                        "duration": round(time.time() - start_time, 2),
                        "input_tokens": final_state.get("input_tokens", 0),
                        "output_tokens": final_state.get("output_tokens", 0),
                        "search_count": final_state.get("search_count", 0),
                        "model": os.environ.get("LLM_PROVIDER", "gemini"),
                        # Nom du modèle réellement utilisé (résolu : .env ou défaut).
                        "model_name": (
                            "deepseek-chat"
                            if os.environ.get("LLM_PROVIDER", "").strip().lower() == "deepseek"
                            else __import__("crag_engine").resolve_model()
                        ),
                    }
                    yield f"data: {json.dumps(result)}\n\n"
                    break
        finally:
            # (N1) Quoi vent il arrive (fin normale, déconnexion, erreur),
            # on signale au thread du graphe de s'arrêter.
            stop_event.set()
            # (C-2) Libère systématiquement le jeton de concurrence.
            _chat_semaphore.release()

    return StreamingResponse(event_stream(), media_type="text/event-stream")
