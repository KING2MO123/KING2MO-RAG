from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import json
import time
import os
from dotenv import load_dotenv

load_dotenv()

from crag_engine import build_crag_graph, initial_state

app = FastAPI(title="KING2MO RAG API")

# CORS : uniquement les origines explicitement autorisées (M1).
# Configurable via ALLOWED_ORIGINS (valeurs séparées par des virgules).
_allowed = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
ALLOWED_ORIGINS = [o.strip() for o in _allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Auth obligatoire : exige le BACKEND_API_TOKEN défini dans le .env
def require_token(x_api_token: Optional[str] = Header(default=None)):
    expected = os.environ.get("BACKEND_API_TOKEN")
    if not expected:
        raise HTTPException(status_code=500, detail="BACKEND_API_TOKEN non configuré sur le serveur.")
    if x_api_token != expected:
        raise HTTPException(status_code=401, detail="Mot de passe d'accès invalide ou manquant.")
    return True

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=10000)
    mode: str = "hybrid"
    history: List[Dict[str, str]] = [] # Ajout de l'historique
    image_base64: Optional[str] = None

@app.post("/api/chat")
async def chat(request: ChatRequest, _auth: bool = Depends(require_token)):
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    tavily_key = os.environ.get("TAVILY_API_KEY", "")
    graph = build_crag_graph(gemini_key, tavily_key)
    state = initial_state(request.query, request.history, request.mode, request.image_base64)

    async def event_stream():
        try:
            start_time = time.time()

            # Une seule exécution du graphe : on accumule l'état final
            # au fil des updates streamées (avant : stream + invoke = double exécution,
            # double latence et double coût LLM).
            final_state = dict(state)
            for update in graph.stream(state):
                for node, out in update.items():
                    if isinstance(out, dict):
                        final_state.update(out)
                    yield f"data: {json.dumps({'type': 'status', 'node': node})}\n\n"

            # Format documents (avec URL cliquable quand disponible)
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

            result = {
                "type": "result",
                "generation": final_state.get("generation", ""),
                "sources": sources,
                "corrections": final_state.get("corrections", 0),
                "web_used": final_state.get("web_search") == "yes" or request.mode == "web",
                "duration": round(time.time() - start_time, 2),
                "input_tokens": final_state.get("input_tokens", 0),
                "output_tokens": final_state.get("output_tokens", 0),
                "search_count": final_state.get("search_count", 0),
            }
            yield f"data: {json.dumps(result)}\n\n"
        except Exception as e:
            error_msg = str(e)
            if "unknown variant image_url" in error_msg:
                error_msg = "❌ Le modèle d'IA actuel (ex: DeepSeek) ne supporte pas l'analyse d'images. Veuillez utiliser un modèle compatible (ex: Gemini 1.5, GPT-4o, Claude 3) pour envoyer des images."
            yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

from fastapi import UploadFile, File
import tempfile
import uuid
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Limite de taille d'upload (C4) : 25 Mo par défaut, configurable.
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_MB", "25")) * 1024 * 1024

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...), _auth: bool = Depends(require_token)):
    # Validation du type côté serveur
    safe_name = os.path.basename(file.filename or "")  # neutralise le path traversal
    ext = os.path.splitext(safe_name)[1].lower()
    allowed_exts = [".pdf", ".txt", ".docx", ".xlsx", ".pptx"]
    
    if ext not in allowed_exts:
        return {"message": f"Seuls les fichiers {', '.join(allowed_exts)} sont acceptés.", "status": "error"}

    # Lecture bornée en taille (C4) pour éviter un déni de service.
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        return {"message": f"Fichier trop volumineux (max {MAX_UPLOAD_BYTES // (1024*1024)} Mo).", "status": "error"}
    if not content:
        return {"message": "Fichier vide.", "status": "error"}

    # Nom temporaire unique et neutre (M6) — jamais dérivé du nom client.
    temp_file = os.path.join(tempfile.gettempdir(), f"upload_{uuid.uuid4().hex}{ext}")
    try:
        with open(temp_file, "wb") as buffer:
            buffer.write(content)

        docs = []
        if ext == ".pdf":
            loader = PyPDFLoader(temp_file)
            docs = loader.load()
        elif ext == ".txt":
            from langchain_core.documents import Document
            with open(temp_file, "r", encoding="utf-8") as f:
                docs = [Document(page_content=f.read())]
        elif ext == ".docx":
            from langchain_core.documents import Document
            import docx
            doc = docx.Document(temp_file)
            text = "\n".join([p.text for p in doc.paragraphs])
            docs = [Document(page_content=text)]
        elif ext == ".pptx":
            from langchain_core.documents import Document
            import pptx
            prs = pptx.Presentation(temp_file)
            text_runs = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        text_runs.append(shape.text)
            docs = [Document(page_content="\n".join(text_runs))]
        elif ext == ".xlsx":
            from langchain_core.documents import Document
            import openpyxl
            wb = openpyxl.load_workbook(temp_file, data_only=True)
            text_runs = []
            for sheet in wb.sheetnames:
                ws = wb[sheet]
                text_runs.append(f"--- Sheet: {sheet} ---")
                for row in ws.iter_rows(values_only=True):
                    row_texts = [str(cell) for cell in row if cell is not None]
                    if row_texts:
                        text_runs.append(" | ".join(row_texts))
            docs = [Document(page_content="\n".join(text_runs))]
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)

        # On force la métadonnée "source" au nom d'origine assaini (traçabilité + suppression).
        for d in splits:
            d.metadata["source"] = safe_name

        from crag_engine import _get_embeddings, CHROMA_DB_DIR
        from langchain_community.vectorstores import Chroma

        vectorstore = Chroma(
            persist_directory=CHROMA_DB_DIR,
            embedding_function=_get_embeddings(),
        )
        
        # Vérification si le document existe déjà (m3)
        db_data = vectorstore.get(include=["metadatas"])
        existing_sources = {meta.get("source") for meta in db_data.get("metadatas", [])}
        if safe_name in existing_sources:
            return {"message": f"Le document '{safe_name}' existe déjà dans la base.", "status": "warning"}
            
        vectorstore.add_documents(splits)

        return {"message": f"{len(splits)} segments ajoutés à la base.", "status": "success"}
    except Exception as e:
        return {"message": str(e), "status": "error"}
    finally:
        # Nettoyage systématique du fichier temporaire (M6).
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass

@app.get("/api/documents")
async def get_documents(_auth: bool = Depends(require_token)):
    try:
        from crag_engine import _get_embeddings, CHROMA_DB_DIR
        from langchain_community.vectorstores import Chroma
        vectorstore = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=_get_embeddings())
        
        # On récupère tous les IDs et métadonnées pour extraire les noms de fichiers uniques
        db_data = vectorstore.get(include=["metadatas"])
        metadatas = db_data.get("metadatas", [])
        
        # Extraire les sources uniques (noms de fichiers)
        unique_sources = set()
        for meta in metadatas:
            if "source" in meta and not str(meta["source"]).startswith("http"):
                # Clean up temp prefix if present
                src = meta["source"]
                if src.startswith("temp_"):
                    src = src[5:]
                unique_sources.add(src)
                
        return {"documents": list(unique_sources), "status": "success"}
    except Exception as e:
        return {"documents": [], "status": "error", "message": str(e)}

@app.delete("/api/documents")
async def clear_all_documents(_auth: bool = Depends(require_token)):
    try:
        from crag_engine import _get_embeddings, CHROMA_DB_DIR
        from langchain_community.vectorstores import Chroma
        vectorstore = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=_get_embeddings())
        
        # Récupérer tous les IDs
        db_data = vectorstore.get()
        ids = db_data.get("ids", [])
        
        if ids:
            vectorstore.delete(ids=ids)
            
        return {"message": "Base de données vidée.", "status": "success"}
    except Exception as e:
        return {"message": str(e), "status": "error"}

@app.delete("/api/documents/{filename}")
async def delete_document(filename: str, _auth: bool = Depends(require_token)):
    try:
        from crag_engine import _get_embeddings, CHROMA_DB_DIR
        from langchain_community.vectorstores import Chroma
        vectorstore = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=_get_embeddings())
        
        db_data = vectorstore.get(include=["metadatas"])
        ids = db_data.get("ids", [])
        metadatas = db_data.get("metadatas", [])
        
        # Trouver les IDs liés à ce fichier (avec ou sans préfixe temp_)
        ids_to_delete = []
        for doc_id, meta in zip(ids, metadatas):
            src = meta.get("source", "")
            if src == filename or src == f"temp_{filename}":
                ids_to_delete.append(doc_id)
                
        if ids_to_delete:
            vectorstore.delete(ids=ids_to_delete)
            return {"message": f"Document '{filename}' supprimé ({len(ids_to_delete)} segments).", "status": "success"}
        else:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Document introuvable.")
            
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
