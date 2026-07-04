"""
Agentic CRAG engine — Corrective Retrieval-Augmented Generation.
(rev. 2 — refonte complète)

Pipeline LangGraph :
    retrieve -> grade_documents -> (web_search?) -> generate -> self-check
Avec garde anti-boucle infinie sur la phase d'auto-correction.
"""

import os
import sys
import json
import urllib.request
from functools import lru_cache
from typing import List, Dict, Any, Literal, Tuple
from typing_extensions import TypedDict

from pydantic import BaseModel, Field

from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_core.messages import SystemMessage, HumanMessage

from langgraph.graph import StateGraph, END

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
DEFAULT_MODEL = "gemini-1.5-flash"
MAX_CORRECTIONS = 2  # nombre max de cycles d'auto-correction avant acceptation
# En mode exe (PyInstaller), la base doit vivre à côté de l'exe (persistante),
# pas dans le dossier temporaire d'extraction (_MEIPASS) qui disparaît.
if getattr(sys, "frozen", False):
    CHROMA_DB_DIR = os.path.join(os.path.dirname(sys.executable), "chroma_db")
else:
    CHROMA_DB_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------
class GraphState(TypedDict):
    question: str
    chat_history: List[Dict[str, str]] # [{'role': 'user', 'content': '...'}, {'role': 'assistant', 'content': '...'}]
    generation: str
    web_search: str            # "yes" / "no"
    documents: List[Document]
    steps: List[Dict[str, Any]]  # trace enrichie pour l'UI
    corrections: int           # compteur anti-boucle
    mode: str                  # "web", "local", "hybrid"
    input_tokens: int
    output_tokens: int
    search_count: int
    generation_grade: str      # "supported" / "not supported" / "not useful"
    image_base64: str          # Image base64 optionnelle


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
    # Fournisseur explicite via LLM_PROVIDER (gemini | deepseek | gemini-openai).
    # Évite le routage fragile par préfixe de clé.
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if provider == "gemini":
        return ChatGoogleGenerativeAI(model=model, google_api_key=key, temperature=temperature)
    if provider == "deepseek":
        return ChatOpenAI(
            model="deepseek-chat",
            api_key=key,
            base_url="https://api.deepseek.com/v1",
            temperature=temperature,
        )
    if provider == "gemini-openai":
        return ChatOpenAI(
            model=model,
            api_key=key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            temperature=temperature,
        )
    # Heuristique héritée (si LLM_PROVIDER absent)
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
    # En mode exe : utilise le modèle embarqué s'il est présent (hors-ligne),
    # sinon retombe sur le téléchargement/cache HuggingFace.
    bundled = os.path.join(getattr(sys, "_MEIPASS", ""), "models", "all-MiniLM-L6-v2")
    model_ref = bundled if os.path.isdir(bundled) else "all-MiniLM-L6-v2"
    return HuggingFaceEmbeddings(model_name=model_ref)


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
def search_web_api(query: str, api_key: str) -> List[Dict[str, str]]:
    """Retourne une liste de résultats structurés {title, content, url}
    afin que chaque source web soit une carte distincte et cliquable dans l'UI."""
    if not api_key:
        return [{
            "title": "Recherche web simulée",
            "content": (
                f"[Résultats web simulés pour : {query}] — "
                "Clé Tavily requise pour la recherche temps réel."
            ),
            "url": "",
        }]

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
                {
                    "title": r.get("title") or "Résultat web",
                    "content": r.get("content") or "",
                    "url": r.get("url") or "",
                }
                for r in res_data.get("results", [])
            ]
            return results or [{"title": "Recherche web", "content": "Aucun résultat web.", "url": ""}]
    except Exception as e:
        return [{"title": "Recherche web", "content": f"Échec de la recherche web : {e}", "url": ""}]


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------
def _step(node: str, detail: str) -> Dict[str, Any]:
    return {"node": node, "detail": detail}

def _extract_usage(res) -> Tuple[int, int]:
    try:
        if hasattr(res, "usage_metadata") and res.usage_metadata:
            return res.usage_metadata.get("input_tokens", 0), res.usage_metadata.get("output_tokens", 0)
        elif hasattr(res, "response_metadata") and res.response_metadata and "token_usage" in res.response_metadata:
            usage = res.response_metadata["token_usage"]
            return usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)
    except Exception:
        pass
    return 0, 0


def contextualize_query(state: GraphState, api_key: str, model: str) -> Dict[str, Any]:
    question = state["question"]
    chat_history = state.get("chat_history", [])
    
    if not chat_history:
        return {} # pas d'historique, on garde la question telle quelle
        
    llm = get_llm(api_key, 0, model)
    history_text = "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in chat_history])
    
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "Given a chat history and the latest user question which might reference context in the chat history, "
         "formulate a standalone question which can be understood without the chat history. "
         "Do NOT answer the question, just reformulate it if needed and otherwise return it as is. "
         "Respond ONLY with the reformulated question in the same language as the original question."),
        ("human", "Chat History:\n{history}\n\nLatest Question: {question}")
    ])
    
    res = (prompt | llm).invoke({"history": history_text, "question": question})
    in_tok, out_tok = _extract_usage(res)
    standalone_q = res.content.strip()
    
    steps = list(state.get("steps", []))
    if standalone_q.lower() != question.lower():
        steps.append(_step("contextualize", f"Question reformulée pour la recherche : {standalone_q}"))
        
    return {
        "question": standalone_q, 
        "steps": steps,
        "input_tokens": state.get("input_tokens", 0) + in_tok,
        "output_tokens": state.get("output_tokens", 0) + out_tok
    }


def route_question(state: GraphState, api_key: str, model: str) -> Dict[str, Any]:
    # Si l'utilisateur force un mode, on ne route pas intelligemment.
    if state.get("mode") in ["web", "local"]:
        return {"steps": list(state.get("steps", [])) + [_step("route_question", f"Routage ignoré (Mode forcé: {state['mode']})")]}
    
    question = state["question"]
    router = get_llm(api_key, 0, model)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are an expert router deciding whether to route a user's question to a web search, a local vector database (PDFs), or both.\n"
         "Use the following criteria:\n"
         "- If the question is about recent news, current events, weather, or real-time information -> Route to 'web'\n"
         "- If the question specifically asks about a document, contract, specific private knowledge, or implies local context -> Route to 'local'\n"
         "- If it's ambiguous, general knowledge, or might require both -> Route to 'hybrid'\n"
         "Return ONLY a single word: 'web', 'local', or 'hybrid'."),
        ("human", "{question}")
    ])
    
    res = (prompt | router).invoke({"question": question})
    in_tok, out_tok = _extract_usage(res)
    decision = res.content.strip().lower()
    if decision not in ["web", "local", "hybrid"]:
        decision = "hybrid" # fallback
        
    steps = list(state.get("steps", []))
    steps.append(_step("route_question", f"Super-Routeur a analysé la question et décidé du mode : {decision.upper()}"))
    
    return {
        "mode": decision, 
        "steps": steps,
        "input_tokens": state.get("input_tokens", 0) + in_tok,
        "output_tokens": state.get("output_tokens", 0) + out_tok
    }


def retrieve(state: GraphState) -> Dict[str, Any]:
    if state.get("mode") == "web":
        return {"documents": [], "steps": list(state.get("steps", [])) + [_step("retrieve", "Recherche locale ignorée (Mode Web)")]}
        
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
         "You are an expert evaluator and information compressor.\n"
         "Analyze the retrieved document content and determine if it is relevant to the user question.\n"
         "If it is NOT relevant, reply with ONLY the word 'no'.\n"
         "If it IS relevant, extract and output ONLY the key sentences or facts from the document that directly answer or support the question. Do not include introductory text, explanations or unrelated context. Keep the extracted text as short and condensed as possible."),
        ("human", "Retrieved document:\n\n{document}\n\nUser question: {question}"),
    ])
    chain = prompt | grader

    inputs = [{"document": doc.page_content, "question": question} for doc in documents]
    if not inputs:
        web_search_val = "no" if state.get("mode") == "local" else "yes"
        return {"documents": [], "web_search": web_search_val, "steps": list(state.get("steps", [])), "input_tokens": state.get("input_tokens", 0), "output_tokens": state.get("output_tokens", 0)}

    results = chain.batch(inputs)

    filtered_docs = []
    compressed_count = 0
    total_in = 0
    total_out = 0
    
    for doc, res in zip(documents, results):
        in_tok, out_tok = _extract_usage(res)
        total_in += in_tok
        total_out += out_tok
        content_stripped = res.content.strip()
        if content_stripped.lower() != "no" and len(content_stripped) > 5:
            # On crée un nouveau document contenant uniquement les faits pertinents et compressés
            filtered_docs.append(Document(
                page_content=content_stripped,
                metadata=doc.metadata
            ))
            compressed_count += 1

    web_search = "yes" if len(filtered_docs) < len(documents) or not filtered_docs else "no"
    
    # Si on est en mode local strict, on s'interdit formellement de basculer sur le web
    if state.get("mode") == "local":
        web_search = "no"

    steps = list(state.get("steps", []))
    steps.append(_step(
        "grade_documents",
        f"{compressed_count}/{len(documents)} document(s) compressé(s) et retenu(s)"
        + (" — fallback web déclenché" if web_search == "yes" else ""),
    ))
    return {
        "documents": filtered_docs, 
        "web_search": web_search, 
        "steps": steps,
        "input_tokens": state.get("input_tokens", 0) + total_in,
        "output_tokens": state.get("output_tokens", 0) + total_out
    }


def web_search(state: GraphState, tavily_key: str) -> Dict[str, Any]:
    question = state["question"]
    documents = list(state["documents"])

    results = search_web_api(question, tavily_key)
    for r in results:
        documents.append(Document(
            page_content=f"{r['title']}\n{r['content']}".strip(),
            metadata={"source": r["url"] or "tavily_search", "title": r["title"], "url": r["url"]},
        ))

    steps = list(state.get("steps", []))
    steps.append(_step("web_search", f"Recherche web Tavily : {len(results)} résultat(s)"))
    return {
        "documents": documents, 
        "steps": steps,
        "search_count": state.get("search_count", 0) + 1
    }


def generate(state: GraphState, api_key: str, model: str) -> Dict[str, Any]:
    question = state["question"]
    documents = state["documents"]
    chat_history = state.get("chat_history", [])

    llm = get_llm(api_key, 0.2, model)
    context = "\n\n".join(doc.page_content for doc in documents)
    
    # Formatage de l'historique conversationnel
    history_text = "Aucun historique récent."
    if chat_history:
        history_text = "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in chat_history])
    
    sys_content = (
         "You are an assistant for question-answering tasks.\n"
         "Use the following pieces of retrieved context to answer the question. "
         "If you don't know the answer, say that you don't know.\n"
         "Keep the answer concise and professional. Respond in the same language as the question.\n\n"
         "Here is the recent conversation history (use it if the user refers to previous messages):\n"
         f"{history_text}\n"
    )
    
    human_content = [{"type": "text", "text": f"Context:\n\n{context}\n\nQuestion: {question}"}]
    if state.get("image_base64"):
        # Format the base64 string appropriately for LangChain
        b64_str = state["image_base64"]
        if not b64_str.startswith("data:image"):
            b64_str = f"data:image/jpeg;base64,{b64_str}"
        human_content.append({"type": "image_url", "image_url": {"url": b64_str}})

    sys_msg = SystemMessage(content=sys_content)
    human_msg = HumanMessage(content=human_content)

    res = llm.invoke([sys_msg, human_msg])
    in_tok, out_tok = _extract_usage(res)
    generation = res.content

    steps = list(state.get("steps", []))
    steps.append(_step("generate", "Réponse synthétisée par l'IA à partir du contexte validé et de l'historique"))
    return {
        "generation": generation, 
        "steps": steps,
        "input_tokens": state.get("input_tokens", 0) + in_tok,
        "output_tokens": state.get("output_tokens", 0) + out_tok
    }



# ---------------------------------------------------------------------------
# Conditional edges
# ---------------------------------------------------------------------------
def decide_to_generate(state: GraphState) -> Literal["web_search", "generate"]:
    if state.get("mode") == "local":
        return "generate"
    return "web_search" if state["web_search"] == "yes" else "generate"


def grade_generation(state: GraphState, api_key: str, model: str) -> Dict[str, Any]:
    """Nœud d'évaluation (M4) : renvoie un état mis à jour (grade + tokens),
    au lieu de muter l'état in-place, pour que le comptage de coûts soit
    correctement remonté par le stream du graphe."""
    # Garde anti-boucle : au-delà de MAX_CORRECTIONS on accepte la réponse.
    if state.get("corrections", 0) >= MAX_CORRECTIONS:
        return {"generation_grade": "supported"}

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
    in1, out1 = _extract_usage(res1)
    grounded = "yes" in res1.content.lower()

    in2 = out2 = 0
    if not grounded:
        grade = "not supported"
    else:
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
        in2, out2 = _extract_usage(res2)
        useful = "yes" in res2.content.lower()
        grade = "supported" if useful else "not useful"

    return {
        "generation_grade": grade,
        "input_tokens": state.get("input_tokens", 0) + in1 + in2,
        "output_tokens": state.get("output_tokens", 0) + out1 + out2,
    }


def route_generation(state: GraphState) -> Literal["supported", "retry"]:
    return "supported" if state.get("generation_grade") == "supported" else "retry"


def _bump_corrections(state: GraphState) -> Dict[str, Any]:
    steps = list(state.get("steps", []))
    steps.append(_step("self_check", "Auto-correction : la réponse n'a pas passé le contrôle, nouvel essai"))
    return {"corrections": state.get("corrections", 0) + 1, "steps": steps}


def decide_after_correction(state: GraphState) -> Literal["web_search", "generate"]:
    """M3 : rendre l'auto-correction réellement corrective.
    Sur un premier échec, si le mode l'autorise et qu'aucune recherche web
    n'a encore été faite, on va chercher du contexte frais sur le web avant
    de régénérer — au lieu de relancer une génération identique."""
    if state.get("mode") != "local" and state.get("search_count", 0) == 0:
        return "web_search"
    return "generate"


# ---------------------------------------------------------------------------
# Graph
# ---------------------------------------------------------------------------
def build_crag_graph(gemini_key: str, tavily_key: str, model: str = DEFAULT_MODEL):
    workflow = StateGraph(GraphState)

    workflow.add_node("contextualize_query", lambda s: contextualize_query(s, gemini_key, model))
    workflow.add_node("route_question", lambda s: route_question(s, gemini_key, model))
    workflow.add_node("retrieve", retrieve)
    workflow.add_node("grade_documents", lambda s: grade_documents(s, gemini_key, model))
    workflow.add_node("web_search", lambda s: web_search(s, tavily_key))
    workflow.add_node("generate", lambda s: generate(s, gemini_key, model))
    workflow.add_node("grade_generation", lambda s: grade_generation(s, gemini_key, model))
    workflow.add_node("self_correct", _bump_corrections)

    workflow.set_entry_point("contextualize_query")

    workflow.add_edge("contextualize_query", "route_question")
    workflow.add_edge("route_question", "retrieve")
    workflow.add_edge("retrieve", "grade_documents")

    workflow.add_conditional_edges(
        "grade_documents",
        decide_to_generate,
        {"web_search": "web_search", "generate": "generate"},
    )
    workflow.add_edge("web_search", "generate")

    # Évaluation via un vrai nœud (M4) puis routage supported/retry.
    workflow.add_edge("generate", "grade_generation")
    workflow.add_conditional_edges(
        "grade_generation",
        route_generation,
        {"supported": END, "retry": "self_correct"},
    )

    # Auto-correction réellement corrective (M3) : sur échec, on tente
    # d'abord une recherche web fraîche, sinon on régénère.
    workflow.add_conditional_edges(
        "self_correct",
        decide_after_correction,
        {"web_search": "web_search", "generate": "generate"},
    )

    return workflow.compile()


def initial_state(question: str, chat_history: List[Dict[str, str]] = None, mode: str = "hybrid", image_base64: str = None) -> GraphState:
    return {
        "question": question,
        "chat_history": chat_history or [],
        "image_base64": image_base64,
        "generation": "",
        "web_search": "no",
        "documents": [],
        "steps": [],
        "corrections": 0,
        "mode": mode,
        "input_tokens": 0,
        "output_tokens": 0,
        "search_count": 0,
        "generation_grade": "",
    }
