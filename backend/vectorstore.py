import os
import sys
from functools import lru_cache
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings

if getattr(sys, 'frozen', False):
    CHROMA_DB_DIR = os.path.join(os.path.dirname(sys.executable), "chroma_db")
else:
    CHROMA_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")

DEFAULT_EMBED_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

@lru_cache(maxsize=1)
def get_embeddings():
    model_name = os.environ.get("EMBED_MODEL", "").strip() or DEFAULT_EMBED_MODEL
    return FastEmbedEmbeddings(model_name=model_name)

@lru_cache(maxsize=1)
def get_vectorstore():
    return Chroma(
        persist_directory=CHROMA_DB_DIR,
        embedding_function=get_embeddings(),
    )

@lru_cache(maxsize=1)
def get_retriever():
    return get_vectorstore().as_retriever(search_kwargs={"k": 5})

def invalidate_caches():
    get_retriever.cache_clear()
    get_vectorstore.cache_clear()
