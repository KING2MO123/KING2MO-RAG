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
from langchain_community.embeddings.fastembed import FastEmbedEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_core.messages import SystemMessage, HumanMessage

from langgraph.graph import StateGraph, END

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# gemini-1.5-flash est en fin de vie chez Google : 2.5-flash est le successeur direct.
DEFAULT_MODEL = "gemini-2.5-flash"


def resolve_model(model: str = None) -> str:
    """Priorité : paramètre explicite > LLM_MODEL du .env > défaut.
    Corrige le bug où le modèle choisi dans les Paramètres était ignoré
    pour les fournisseurs gemini / gemini-openai."""
    return (model or os.environ.get("LLM_MODEL", "").strip() or DEFAULT_MODEL)
MAX_CORRECTIONS = 2  # nombre max de cycles d'auto-correction avant acceptation
from vectorstore import CHROMA_DB_DIR, get_embeddings, get_vectorstore, get_retriever, invalidate_caches


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
    quality: bool              # Mode qualité : auto-évaluation activée
    retrieval_score: float     # (R-4) meilleur score de pertinence des documents
    scope: str                 # (R-13) portée documentaire (id de conversation) ou vide


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
def get_llm(api_key: str, temperature: float = 0, model: str = None, streaming: bool = False, callbacks: list = None):
    key = api_key or GEMINI_API_KEY
    model = resolve_model(model)
    # Fournisseur explicite via LLM_PROVIDER (gemini | deepseek | gemini-openai).
    # Évite le routage fragile par préfixe de clé.
    provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
    if provider == "gemini":
        return ChatGoogleGenerativeAI(model=model, google_api_key=key, temperature=temperature, streaming=streaming, callbacks=callbacks)
    if provider == "deepseek":
        return ChatOpenAI(
            model="deepseek-chat",
            api_key=key,
            base_url="https://api.deepseek.com/v1",
            temperature=temperature,
            streaming=streaming,
            callbacks=callbacks
        )
    if provider == "ollama":
        # Ollama local : gratuit et 100% hors-ligne (API compatible OpenAI).
        return ChatOpenAI(
            model=os.environ.get("LLM_MODEL", "llama3.1"),
            api_key=key or "ollama",  # Ollama n'exige pas de vraie clé
            base_url=os.environ.get("LLM_BASE_URL", "http://localhost:11434/v1"),
            temperature=temperature,
            streaming=streaming,
            callbacks=callbacks,
        )
    if provider == "custom":
        # Fournisseur générique : toute API compatible OpenAI
        # (OpenAI, Mistral, Groq, OpenRouter, Ollama local, Anthropic…).
        return ChatOpenAI(
            model=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
            api_key=key,
            base_url=os.environ.get("LLM_BASE_URL") or None,
            temperature=temperature,
            streaming=streaming,
            callbacks=callbacks,
        )
    if provider == "gemini-openai":
        return ChatOpenAI(
            model=model,
            api_key=key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            temperature=temperature,
            streaming=streaming,
            callbacks=callbacks
        )
    # Heuristique héritée (si LLM_PROVIDER absent)
    if key.startswith("AQ."):
        return ChatOpenAI(
            model=model,
            api_key=key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            temperature=temperature,
            streaming=streaming,
            callbacks=callbacks
        )
    elif key.startswith("sk-"):
        return ChatOpenAI(
            model="deepseek-chat",
            api_key=key,
            base_url="https://api.deepseek.com/v1",
            temperature=temperature,
            streaming=streaming,
            callbacks=callbacks
        )
    return ChatGoogleGenerativeAI(model=model, google_api_key=key, temperature=temperature, streaming=streaming, callbacks=callbacks)





# (R-4) Seuil de pertinence pour raviver le repli web du CRAG.
# 0.0 = désactivé (comportement historique : web seulement si 0 document).
# Sinon, si le meilleur score de pertinence est sous ce seuil, on considère
# les documents locaux trop faibles et on déclenche la recherche web.
# Les scores de Chroma sont dans [0, 1] (1 = très pertinent). Valeur de départ
# raisonnable si activé : 0.25–0.4 selon le modèle d'embeddings.
RELEVANCE_THRESHOLD = float(os.environ.get("RELEVANCE_THRESHOLD", "0") or "0")


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
    except Exception as e:
        import logging
        logging.warning(f"Erreur extraction usage LLM (sous-estimation des coûts) : {e}")
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
        return {"documents": [], "retrieval_score": 0.0, "steps": list(state.get("steps", [])) + [_step("retrieve", "Recherche locale ignorée (Mode Web)")]}

    question = state["question"]
    top_score = 0.0

    # (R-13) Portée documentaire optionnelle. Si un scope (id de conversation)
    # est fourni, on ne récupère que les documents de cette conversation OU
    # marqués "global". Sans scope (défaut), aucun filtre : comportement
    # historique inchangé, tous les documents sont visibles.
    scope = state.get("scope")
    search_filter = {"scope": {"$in": [scope, "global"]}} if scope else None

    try:
        # (R-4) On récupère les scores de pertinence pour pouvoir juger la
        # qualité des documents locaux (et non plus seulement leur présence).
        scored = get_vectorstore().similarity_search_with_relevance_scores(
            question, k=5, filter=search_filter
        )
        documents = [doc for doc, _ in scored]
        if scored:
            top_score = max((s for _, s in scored), default=0.0)
    except Exception:
        # Repli robuste sur l'ancien chemin si le scoring n'est pas disponible.
        try:
            documents = get_vectorstore().similarity_search(question, k=5, filter=search_filter)
        except Exception:
            documents = get_retriever().invoke(question)

    steps = list(state.get("steps", []))
    score_note = f", meilleur score {top_score:.2f}" if top_score else ""
    steps.append(_step("retrieve", f"{len(documents)} document(s) récupéré(s) depuis ChromaDB{score_note}"))
    return {"documents": documents, "retrieval_score": top_score, "steps": steps}



def grade_documents(state: GraphState) -> Dict[str, Any]:
    # (N9) Paramètres api_key/model retirés : plus d'appel LLM ici depuis R5.
    documents = state.get("documents", [])
    mode = state.get("mode")
    top_score = state.get("retrieval_score", 0.0)

    # (R-4) Le repli web se déclenche si :
    #   - aucun document local (comportement historique), OU
    #   - un seuil de pertinence est activé et le meilleur score est en dessous
    #     (les documents locaux existent mais sont jugés hors sujet).
    weak = RELEVANCE_THRESHOLD > 0 and top_score < RELEVANCE_THRESHOLD
    web_search = "yes" if (not documents or weak) and mode != "local" else "no"

    reason = ""
    if web_search == "yes":
        reason = " — fallback web déclenché" + (
            f" (pertinence {top_score:.2f} < {RELEVANCE_THRESHOLD:.2f})" if weak and documents else ""
        )

    steps = list(state.get("steps", []))
    steps.append(_step(
        "grade_documents",
        f"Filtrage : {len(documents)} doc(s) conservé(s){reason}",
    ))
    return {
        "documents": documents,
        "web_search": web_search,
        "steps": steps,
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


def generate(state: GraphState, api_key: str, model: str, callbacks: list = None) -> Dict[str, Any]:
    question = state["question"]
    documents = state["documents"]
    chat_history = state.get("chat_history", [])

    use_callbacks = callbacks if not state.get('quality') else None
    llm = get_llm(api_key, 0.2, model, streaming=bool(use_callbacks), callbacks=use_callbacks)
    # Contexte numéroté pour permettre les citations [1], [2]… dans la réponse.
    context = "\n\n".join(f"[{i + 1}] {doc.page_content}" for i, doc in enumerate(documents))
    
    # Formatage de l'historique conversationnel
    history_text = "Aucun historique récent."
    if chat_history:
        history_text = "\n".join([f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in chat_history])
    
    sys_content = (
         "You are an assistant for question-answering tasks.\n"
         "Use the following pieces of retrieved context to answer the question. "
         "If you don't know the answer, say that you don't know.\n"
         "Keep the answer concise and professional. Respond in the same language as the question.\n"
         "The context passages are numbered [1], [2], etc. When you use information "
         "from a passage, cite its number in square brackets at the end of the sentence, "
         "e.g. 'The margin grew by 5% [2].' Only cite numbers that exist in the context.\n\n"
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

    in_tok, out_tok = 0, 0
    messages = [SystemMessage(content=sys_content), HumanMessage(content=human_content)]
    if use_callbacks:
        generation = ''
        last_chunk = None
        for chunk in llm.stream(messages):
            generation += str(chunk.content)
            last_chunk = chunk
            if hasattr(chunk, 'content') and chunk.content:
                for cb in use_callbacks:
                    if hasattr(cb, 'on_llm_new_token'): cb.on_llm_new_token(str(chunk.content))
        if last_chunk:
            try:
                in_tok, out_tok = _extract_usage(last_chunk)
            except Exception:
                in_tok, out_tok = 0, 0
    else:
        res = llm.invoke(messages)
        generation = res.content
        in_tok, out_tok = _extract_usage(res)

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
    # (R5) Par défaut : évaluation désactivée (coûts / latence divisés par 4).
    # Mode qualité : l'utilisateur peut réactiver l'auto-évaluation pour les
    # questions importantes (interrupteur dans les paramètres).
    if not state.get("quality") or not state.get("documents"):
        return {"generation_grade": "supported"}
    if state.get("corrections", 0) >= MAX_CORRECTIONS:
        # Garde anti-boucle : on accepte la réponse après MAX_CORRECTIONS essais.
        return {"generation_grade": "supported"}

    llm = get_llm(api_key, 0, model)
    context = "\n\n".join(d.page_content for d in state["documents"])[:12000]
    prompt = ChatPromptTemplate.from_messages([
        ("system",
         "You are a strict grader. Determine whether the answer is grounded in "
         "the provided facts. Return ONLY the single word 'yes' if the answer is "
         "supported by the facts, or 'no' if it contains unsupported claims."),
        ("human", "Facts:\n{context}\n\nAnswer:\n{generation}")
    ])
    try:
        res = (prompt | llm).invoke({"context": context, "generation": state.get("generation", "")})
        in_tok, out_tok = _extract_usage(res)
        grounded = "yes" in res.content.strip().lower()
    except Exception:
        # Le grader ne doit jamais faire échouer la réponse principale.
        return {"generation_grade": "supported"}

    steps = list(state.get("steps", []))
    steps.append(_step("grade_generation", "Mode qualité : réponse " + ("validée ✓" if grounded else "jugée insuffisante, correction…")))
    return {
        "generation_grade": "supported" if grounded else "not supported",
        "steps": steps,
        "input_tokens": state.get("input_tokens", 0) + in_tok,
        "output_tokens": state.get("output_tokens", 0) + out_tok,
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
def build_crag_graph(gemini_key: str, tavily_key: str, model: str = None, callbacks: list = None):
    # model=None → resolve_model() lira LLM_MODEL du .env (choix des Paramètres).
    model = resolve_model(model)
    workflow = StateGraph(GraphState)

    workflow.add_node("contextualize_query", lambda s: contextualize_query(s, gemini_key, model))
    workflow.add_node("route_question", lambda s: route_question(s, gemini_key, model))
    workflow.add_node("retrieve", retrieve)
    workflow.add_node("grade_documents", grade_documents)
    workflow.add_node("web_search", lambda s: web_search(s, tavily_key))
    workflow.add_node("generate", lambda s: generate(s, gemini_key, model, callbacks=callbacks))
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


def initial_state(question: str, chat_history: List[Dict[str, str]] = None, mode: str = "hybrid", image_base64: str = None, quality: bool = False, scope: str = "") -> GraphState:
    return {
        "question": question,
        "chat_history": chat_history or [],
        "image_base64": image_base64,
        "quality": quality,
        "scope": scope or "",
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
        "retrieval_score": 0.0,
    }
