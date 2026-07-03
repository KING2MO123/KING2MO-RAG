"""
Agentic CRAG engine — Corrective Retrieval-Augmented Generation.
(rev. 2 — refonte complète)

Pipeline LangGraph :
    retrieve -> grade_documents -> (web_search?) -> generate -> self-check
Avec garde anti-boucle infinie sur la phase d'auto-correction.
"""

import os
import json
import urllib.request
from functools import lru_cache
from typing import List, Dict, Any, Literal
from typing_extensions import TypedDict

from pydantic import BaseModel, Field

from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document

from langgraph.graph import StateGraph, END

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DEFAULT_MODEL = "gemini-1.5-flash"
MAX_CORRECTIONS = 2  # nombre max de cycles d'auto-correction avant acceptation
CHROMA_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
class GraphState(TypedDict):
    question: str
    generation: str
    web_search: str            # "yes" / "no"
    documents: List[Document]
    steps: List[Dict[str, Any]]  # trace enrichie pour l'UI
    corrections: int           # compteur anti-boucle


# ---------------------------------------------------------------------------
# Structured outputs
# ---------------------------------------------------------------------------
class GradeDocuments(BaseModel):
    """Binary score for relevance on retrieved documents."""
    binary_score: str = Field(description="Documents are relevant to the question, 'yes' or 'no'")


class GradeHallucination(BaseModel):
    """Binary score for hallucination check on generator output."""
    binary_score: str = Field(description="Answer is grounded in / supported by the facts, 'yes' or 'no'")


class GradeAnswer(BaseModel):
    """Binary score to assess if answer addresses the query."""
    binary_score: str = Field(description="Answer addresses the question, 'yes' or 'no'")


# ---------------------------------------------------------------------------
# LLM / retriever helpers
# ---------------------------------------------------------------------------
def get_llm(api_key: str, temperature: float = 0, model: str = DEFAULT_MODEL):
    key = api_key or GEMINI_API_KEY
    if key.startswith("AQ."):
        return ChatOpenAI(
            model=model,
            api_key=key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            temperature=temperature,
        )
    elif key.startswith("sk-"):
        return ChatOpenAI(
            model="deepseek-chat",
            api_key=key,
            base_url="https://api.deepseek.com/v1",
            temperature=temperature,
        )
    return ChatGoogleGenerativeAI(model=model, google_api_key=key, temperature=temperature)


@lru_cache(maxsize=1)
def _get_embeddings():
    # Coûteux à instancier : mis en cache pour tout le process.
    return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def get_retriever():
    vectorstore = Chroma(
        persist_directory=CHROMA_DB_DIR,
        embedding_function=_get_embeddings(),
    )
    return vectorstore.as_retriever(search_kwargs={"k": 5})


# ---------------------------------------------------------------------------
# Web search (Tavily via urllib, sans dépendance supplémentaire)
# ---------------------------------------------------------------------------
def search_web_api(query: str, api_key: str) -> str:
    if not api_key:
        return (
            f"[Résultats web simulés pour : {query}] — "
            "Clé Tavily requise pour la recherche temps réel."
        )

    url = "https://api.tavily.com/search"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    data = json.dumps({
        "query": query,
        "search_depth": "basic",
        "include_answer": True,
        "max_results": 3,
    }).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=8) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            results = [
                f"Title: {r.get('title')}\nContent: {r.get('content')}\nURL: {r.get('url')}"
                for r in res_data.get("results", [])
            ]
            return "\n\n".join(results) or "Aucun résultat web."
    except Exception as e:
        return f"Échec de la recherche web : {e}"


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------
def _step(node: str, detail: str) -> Dict[str, Any]:
    return {"node": node, "detail": detail}


def retrieve(state: GraphState) -> Dict[str, Any]:
    question = state["question"]
    documents = get_retriever().invoke(question)
    steps = list(state.get("steps", []))
    steps.append(_step("retrieve", f"{len(documents)} document(s) récupéré(s) depuis ChromaDB"))
    return {"documents": documents, "steps": steps}


def grade_documents(state: GraphState, api_key: str, model: str) -> Dict[str, Any]:
    question = state["question"]
    documents = state["documents"]

    grader = get_llm(api_key, 0, model)
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an expert evaluator grading the relevance of a retrieved document to a user question.\n"
         "If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant.\n"
         "Give a binary score 'yes' or 'no' to indicate whether the document is relevant to the question.\n"
         "Return ONLY the word 'yes' or 'no'."),
        ("human", "Retrieved document:\n\n{document}\n\nUser question: {question}"),
    ])
    chain = prompt | grader

    filtered_docs = []
    for doc in documents:
        res = chain.invoke({"document": doc.page_content, "question": question})
        if "yes" in res.content.lower():
            filtered_docs.append(doc)

    web_search = "yes" if len(filtered_docs) < len(documents) or not filtered_docs else "no"

    steps = list(state.get("steps", []))
    steps.append(_step(
        "grade_documents",
        f"{len(filtered_docs)}/{len(documents)} document(s) jugé(s) pertinent(s)"
        + (" — fallback web déclenché" if web_search == "yes" else ""),
    ))
    return {"documents": filtered_docs, "web_search": web_search, "steps": steps}


def web_search(state: GraphState, tavily_key: str) -> Dict[str, Any]:
    question = state["question"]
    documents = list(state["documents"])

    results = search_web_api(question, tavily_key)
    documents.append(Document(page_content=results, metadata={"source": "tavily_search"}))

    steps = list(state.get("steps", []))
    steps.append(_step("web_search", "Recherche web Tavily effectuée (sources locales insuffisantes)"))
    return {"documents": documents, "steps": steps}


def generate(state: GraphState, api_key: str, model: str) -> Dict[str, Any]:
    question = state["question"]
    documents = state["documents"]

    llm = get_llm(api_key, 0.2, model)
    context = "\n\n".join(doc.page_content for doc in documents)
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an assistant for question-answering tasks.\n"
         "Use the following pieces of retrieved context to answer the question. "
         "If you don't know the answer, say that you don't know.\n"
         "Keep the answer concise and professional. Respond in the same language as the question."),
        ("human", "Context:\n\n{context}\n\nQuestion: {question}"),
    ])
    generation = (prompt | llm).invoke({"context": context, "question": question}).content

    steps = list(state.get("steps", []))
    steps.append(_step("generate", "Réponse synthétisée par Gemini à partir du contexte validé"))
    return {"generation": generation, "steps": steps}


# ---------------------------------------------------------------------------
# Conditional edges
# ---------------------------------------------------------------------------
def decide_to_generate(state: GraphState) -> Literal["web_search", "generate"]:
    return "web_search" if state["web_search"] == "yes" else "generate"


def grade_generation(state: GraphState, api_key: str, model: str) -> Literal["supported", "not supported", "not useful"]:
    # Garde anti-boucle : au-delà de MAX_CORRECTIONS on accepte la réponse.
    if state.get("corrections", 0) >= MAX_CORRECTIONS:
        return "supported"

    question = state["question"]
    documents = state["documents"]
    generation = state["generation"]
    context_str = "\n\n".join(d.page_content for d in documents)

    hallucination_grader = get_llm(api_key, 0, model)
    p1 = ChatPromptTemplate.from_messages([
        ("system",
         "You are an evaluator assessing whether an LLM generation is grounded in / supported by a set of retrieved facts.\n"
         "Give a binary score 'yes' or 'no'. 'yes' means the answer is grounded in and fully supported by the facts.\n"
         "Return ONLY the word 'yes' or 'no'."),
        ("human", "Facts:\n\n{documents}\n\nLLM generation: {generation}"),
    ])
    res1 = (p1 | hallucination_grader).invoke(
        {"documents": context_str, "generation": generation}
    )
    grounded = "yes" in res1.content.lower()

    if not grounded:
        return "not supported"

    answer_grader = get_llm(api_key, 0, model)
    p2 = ChatPromptTemplate.from_messages([
        ("system",
         "You are an evaluator assessing whether an LLM generation addresses the user question.\n"
         "Give a binary score 'yes' or 'no'. 'yes' means the answer fully addresses the question.\n"
         "Return ONLY the word 'yes' or 'no'."),
        ("human", "User question: {question}\n\nLLM generation: {generation}"),
    ])
    res2 = (p2 | answer_grader).invoke(
        {"question": question, "generation": generation}
    )
    useful = "yes" in res2.content.lower()

    return "supported" if useful else "not useful"


def _bump_corrections(state: GraphState) -> Dict[str, Any]:
    steps = list(state.get("steps", []))
    steps.append(_step("self_check", "Auto-correction : la réponse n'a pas passé le contrôle, nouvel essai"))
    return {"corrections": state.get("corrections", 0) + 1, "steps": steps}


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------
def build_crag_graph(gemini_key: str, tavily_key: str, model: str = DEFAULT_MODEL):
    workflow = StateGraph(GraphState)

    workflow.add_node("retrieve", retrieve)
    workflow.add_node("grade_documents", lambda s: grade_documents(s, gemini_key, model))
    workflow.add_node("web_search", lambda s: web_search(s, tavily_key))
    workflow.add_node("generate", lambda s: generate(s, gemini_key, model))
    workflow.add_node("self_correct", _bump_corrections)

    workflow.set_entry_point("retrieve")
    workflow.add_edge("retrieve", "grade_documents")
    workflow.add_conditional_edges(
        "grade_documents",
        decide_to_generate,
        {"web_search": "web_search", "generate": "generate"},
    )
    workflow.add_edge("web_search", "generate")
    workflow.add_conditional_edges(
        "generate",
        lambda s: grade_generation(s, gemini_key, model),
        {
            "supported": END,
            "not supported": "self_correct",
            "not useful": "self_correct",
        },
    )
    workflow.add_edge("self_correct", "generate")

    return workflow.compile()


def initial_state(question: str) -> GraphState:
    return {
        "question": question,
        "generation": "",
        "web_search": "no",
        "documents": [],
        "steps": [],
        "corrections": 0,
    }
