from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict
import json
import time

from crag_engine import build_crag_graph, initial_state

app = FastAPI(title="KING2MO RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str
    gemini_key: str
    tavily_key: str
    mode: str = "hybrid"

@app.post("/api/chat")
async def chat(request: ChatRequest):
    graph = build_crag_graph(request.gemini_key, request.tavily_key)
    state = initial_state(request.query, request.mode)

    async def event_stream():
        try:
            for update in graph.stream(state):
                for node, out in update.items():
                    # Send status update
                    yield f"data: {json.dumps({'type': 'status', 'node': node})}\n\n"
            
            # Find the final state inside the graph output
            # We can run invoke to get the final state or just extract it from the last update
            # Wait, graph.stream yields partial updates. Let's just run invoke for simplicity, 
            # OR we can collect the state. Since the frontend expects a streaming experience:
            # We already streamed status. Now we yield the final result.
            final_state = graph.invoke(state)
            
            # Format documents
            sources = []
            for doc in final_state.get("documents", []):
                sources.append({
                    "source": doc.metadata.get("source", "local"),
                    "content": doc.page_content[:300] + "..."
                })

            result = {
                "type": "result",
                "generation": final_state.get("generation", ""),
                "sources": sources,
                "corrections": final_state.get("corrections", 0)
            }
            yield f"data: {json.dumps(result)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

from fastapi import UploadFile, File
import shutil
import os
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

@app.post("/api/upload")
async def upload_document(file: UploadFile = File(...)):
    try:
        temp_file = f"temp_{file.filename}"
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        loader = PyPDFLoader(temp_file)
        docs = loader.load()
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)
        
        from crag_engine import _get_embeddings, CHROMA_DB_DIR
        from langchain_community.vectorstores import Chroma
        
        vectorstore = Chroma(
            persist_directory=CHROMA_DB_DIR,
            embedding_function=_get_embeddings(),
        )
        vectorstore.add_documents(splits)
        
        os.remove(temp_file)
        return {"message": f"{len(splits)} segments ajoutés à la base.", "status": "success"}
    except Exception as e:
        return {"message": str(e), "status": "error"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
