import { useState, useEffect } from 'react';
import { apiSend } from '../lib/api';

const MAX_COST_HISTORY = 100;

interface UseChatOptions {
  systemPassword: string;
  mode: string;
  qualityMode: boolean;
  scopedDocs: boolean;
  currentConvId: string | null;
  pricing: any;
  selectedImage: string | null;
  setSelectedImage: (val: string | null) => void;
  query: string;
  setQuery: (val: string) => void;
}

export function useChat({
  systemPassword,
  mode,
  qualityMode,
  scopedDocs,
  currentConvId,
  pricing,
  selectedImage,
  setSelectedImage,
  query,
  setQuery
}: UseChatOptions) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const [history, setHistory] = useState<string[]>([]);
  const [costHistory, setCostHistory] = useState<any[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  // Initialize state from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("rag_history");
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.warn("rag_history illisible, réinitialisé.", e);
      localStorage.removeItem("rag_history");
    }

    try {
      const savedCostHistory = localStorage.getItem("rag_cost_history");
      if (savedCostHistory) {
        const parsed = JSON.parse(savedCostHistory);
        if (Array.isArray(parsed)) {
          setCostHistory(parsed);
          const tot = parsed.reduce((acc: number, item: any) => acc + (item?.cost || 0), 0);
          setTotalCost(tot);
        }
      }
    } catch (e) {
      console.warn("rag_cost_history illisible, réinitialisé.", e);
      localStorage.removeItem("rag_cost_history");
    }
    
    try {
      const savedMessages = localStorage.getItem("rag_chat_messages");
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        // Filter out any messages that were stuck in "loading" state
        setMessages(parsed.filter((m: any) => !m.loading));
      }
    } catch (e) {
      console.warn("rag_chat_messages illisible, réinitialisé.", e);
      localStorage.removeItem("rag_chat_messages");
    }
  }, []);

  // Save messages to local storage whenever they change (bounded to last 50)
  useEffect(() => {
    if (messages.length > 0) {
      const boundedMessages = messages.slice(-50);
      try {
        localStorage.setItem("rag_chat_messages", JSON.stringify(boundedMessages));
      } catch (e) {
        console.warn("localStorage quota exceeded, clearing chat messages.");
        localStorage.removeItem("rag_chat_messages");
      }
    } else {
      localStorage.removeItem("rag_chat_messages");
    }
  }, [messages]);

  const saveToHistory = (q: string) => {
    if (!q) return;
    const newHistory = [q, ...history.filter(h => h !== q)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem("rag_history", JSON.stringify(newHistory));
  };

  const handleSearch = async (searchQuery: string = query, opts?: { retry?: boolean; history?: any[] }) => {
    const newQuery = searchQuery.trim();
    if (!newQuery || loading) return;

    const isRetry = !!opts?.retry;
    if (!isRetry) {
      setQuery("");
      saveToHistory(newQuery);
    }

    // 1. Add User Message
    const userMsgId = Date.now().toString();
    const userMsg = { id: userMsgId, role: "user", content: newQuery };

    // 2. Build conversational history.
    const sourceHistory = opts?.history || messages;
    const chatHistory = sourceHistory
      .filter((m: any) => !m.loading && m.content)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 10000) }));

    // 3. Add Assistant Loading Message
    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      sources: [],
      metrics: null,
      loading: true,
      status: "Initialisation..."
    };

    setMessages(prev => isRetry ? [...prev, assistantMsg] : [...prev, userMsg, assistantMsg]);
    setLoading(true);

    const WATCHDOG_MS = 130000;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let timedOut = false;
    let controllerRef: AbortController | null = null;
    const armWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        timedOut = true;
        controllerRef?.abort();
      }, WATCHDOG_MS);
    };

    try {
      const controller = new AbortController();
      controllerRef = controller;
      setAbortController(controller);
      armWatchdog();
      const response = await apiSend("/api/chat", systemPassword, "POST", {
        query: newQuery,
        mode,
        history: chatHistory,
        image_base64: selectedImage,
        quality: qualityMode,
        scope: (scopedDocs && currentConvId) ? currentConvId : ""
      }, false, controller.signal);

      setSelectedImage(null);

      if (!response.ok) {
        let detail = `Erreur serveur (HTTP ${response.status}).`;
        try {
          const errBody = await response.json();
          if (errBody?.detail) {
            detail = Array.isArray(errBody.detail)
              ? errBody.detail.map((d: any) => d.msg || JSON.stringify(d)).join(" ; ")
              : String(errBody.detail);
          }
        } catch { /* corps non-JSON */ }
        throw new Error(detail);
      }

      if (!response.body) throw new Error("ReadableStream not yet supported in this browser.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          armWatchdog();
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";
          for (const line of events) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                if (data.type === "token") {
                  setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: (m.content || "") + data.content } : m));
                } else if (data.type === "status") {
                  setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, status: `TRAITEMENT : ${data.node.toUpperCase()}` } : m));
                } else if (data.type === "result") {
                  const inTok = data.input_tokens || 0;
                  const outTok = data.output_tokens || 0;
                  const sCount = data.search_count || 0;
                  
                  let provider = data.model || "gemini";
                  const priceRow = (pricing && pricing[provider]) || null;
                  const searchCost = (pricing && typeof pricing._search_cost === 'number') ? pricing._search_cost : 0.005;
                  
                  let usedModel = data.model_name || priceRow?.label || (provider === "deepseek" ? "DeepSeek V3" : (provider === "gemini-openai" ? "Gemini (OpenAI API)" : "Gemini 2.5 Flash"));
                  let inPrice = priceRow ? Number(priceRow.in) : (provider === "deepseek" ? 0.14 : 0.30);
                  let outPrice = priceRow ? Number(priceRow.out) : (provider === "deepseek" ? 0.28 : 2.50);
                  if (provider === "ollama") {
                    usedModel = data.model_name || priceRow?.label || "Ollama (local)";
                    inPrice = priceRow ? Number(priceRow.in) : 0;
                    outPrice = priceRow ? Number(priceRow.out) : 0;
                  }
                  if (provider === "custom") {
                    usedModel = data.model_name || "Modèle personnalisé";
                    try {
                      const p = JSON.parse(localStorage.getItem("custom_pricing") || "{}");
                      inPrice = Number(p.in) || 0;
                      outPrice = Number(p.out) || 0;
                    } catch { inPrice = 0; outPrice = 0; }
                  }

                  const msgCost = (inTok / 1000000) * inPrice + (outTok / 1000000) * outPrice + sCount * searchCost;
                  
                  const now = new Date();
                  const detailedTime = `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR')}.${now.getMilliseconds().toString().padStart(3, '0')}`;

                  const newHistoryItem = {
                    time: detailedTime,
                    cost: msgCost,
                    inTokens: inTok,
                    outTokens: outTok,
                    searchCount: sCount,
                    model: usedModel
                  };
                  setCostHistory(prev => {
                    const updated = [...prev, newHistoryItem].slice(-MAX_COST_HISTORY);
                    localStorage.setItem("rag_cost_history", JSON.stringify(updated));
                    return updated;
                  });
                  setTotalCost(prev => prev + msgCost);
                  
                  setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
                    ...m, 
                    content: data.generation,
                    sources: data.sources || [],
                    metrics: { 
                        corrections: data.corrections, 
                        duration: data.duration, 
                        webUsed: data.web_used,
                        cost: msgCost,
                        inTokens: inTok,
                        outTokens: outTok
                    },
                    loading: false, 
                    status: null 
                  } : m));
                  setLoading(false);
                } else if (data.type === "error") {
                  setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
                    ...m, 
                    content: `❌ Erreur : ${data.message}`, 
                    loading: false, 
                    status: null 
                  } : m));
                  setLoading(false);
                }
              } catch (e) {
                console.debug("Erreur de parsing SSE :", e, line);
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        const note = timedOut
          ? "\n\n*[Connexion interrompue : aucune réponse du serveur pendant 130 s]*"
          : "\n\n*[Génération annulée]*";
        const emptyNote = timedOut
          ? "❌ Connexion interrompue : le serveur n'a rien renvoyé pendant 130 s."
          : "*[Génération annulée]*";
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          content: m.content ? m.content + note : emptyNote,
          loading: false,
          status: null
        } : m));
      } else {
        const msg = error?.message || "Erreur de connexion au serveur Backend.";
        setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
          ...m,
          content: `❌ ${msg}`,
          loading: false,
          status: null
        } : m));
      }
    } finally {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      setLoading(false);
      setMessages(prev => prev.map(m =>
        (m.id === assistantMsgId && m.loading)
          ? { ...m, loading: false, status: null, content: m.content || "❌ Aucune réponse reçue du serveur." }
          : m
      ));
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const regenerateLast = () => {
    if (loading) return;
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user" && messages[i].content) { lastUserIdx = i; break; }
    }
    if (lastUserIdx < 0) return;
    const question = messages[lastUserIdx].content;
    const base = messages.slice(0, lastUserIdx + 1);
    const history = base.slice(0, lastUserIdx).filter((m: any) => !m.loading && m.content);
    setMessages(base);
    handleSearch(question, { retry: true, history });
  };

  const editUserMessage = (msgId: string) => {
    if (loading) return;
    const idx = messages.findIndex((m: any) => m.id === msgId);
    if (idx < 0) return;
    setQuery(messages[idx].content);
    setMessages(messages.slice(0, idx));
  };

  return {
    messages,
    setMessages,
    loading,
    setLoading,
    abortController,
    history,
    setHistory,
    costHistory,
    setCostHistory,
    totalCost,
    setTotalCost,
    saveToHistory,
    handleSearch,
    regenerateLast,
    editUserMessage,
    handleStop
  };
}
