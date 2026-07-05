"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Sparkles, Sidebar as SidebarIcon, Key, Link2, BookOpen, Clock, Copy, Check, Download, Book, X, Cpu, Globe, Folder, Paperclip, ExternalLink, BarChart2, Image as ImageIcon, Square, Pencil } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, BarChart, Bar } from 'recharts';

import { apiGet, apiSend, API_BASE } from "@/lib/api";

// (F-9) Version unique de l'application, source de vérité affichée en pied de page.
const APP_VERSION = "3.2.0";

import { I18N, t } from "@/lib/i18n";
import NeuralNetwork from "@/components/NeuralNetwork";
import SourceModal from "@/components/SourceModal";
import SettingsModal from "@/components/SettingsModal";
import Dashboard from "@/components/Dashboard";
import ChatMessage from "@/components/ChatMessage";
import Sidebar from "@/components/Sidebar";
import SearchBar from "@/components/SearchBar";
import TopBar from "@/components/TopBar";
import { useChat } from "@/hooks/useChat";

// Nombre max d'entrées conservées dans l'historique des coûts (m2).
const MAX_COST_HISTORY = 100;


export default function Home() {
  
  const [systemPassword, setSystemPassword] = useState("");
  const [query, setQuery] = useState("");

  
  // UI States
  const [theme, setTheme] = useState("dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState("hybrid");
  const [lang, setLang] = useState("fr");                       // (R-12) langue FR/EN
  const [editingConvId, setEditingConvId] = useState<string | null>(null); // (R-3) renommage inline
  const [editingTitle, setEditingTitle] = useState("");
  const [needsApiKey, setNeedsApiKey] = useState(false);        // (R-8) bannière clé manquante
  const [isDragging, setIsDragging] = useState(false);          // (R-9) glisser-déposer

  // Settings (clés API / fournisseur LLM)
  const [showSettings, setShowSettings] = useState(false);
  const [llmProvider, setLlmProvider] = useState("deepseek");
  const [llmKey, setLlmKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [hasTavilyKey, setHasTavilyKey] = useState(false);
  const [hasLlmKey, setHasLlmKey] = useState(false);
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [customInPrice, setCustomInPrice] = useState("0");
  const [customOutPrice, setCustomOutPrice] = useState("0");
  const [qualityMode, setQualityMode] = useState(false);
  const [scopedDocs, setScopedDocs] = useState(false); // (R-13) cloisonner les docs par conversation
  const [pricing, setPricing] = useState<any>(null);   // table de tarifs (backend, configurable)

  // Conversations sauvegardées (sur disque, via le backend)
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Upload States
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);


  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Knowledge Base States
  const [documents, setDocuments] = useState<string[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  
  // Cost State

  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardOpacity, setDashboardOpacity] = useState(0.4);

  // Selection / Edit Mode States
  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<string[]>([]);
  const [isEditingDocs, setIsEditingDocs] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<any>(null);

  const {
    messages, setMessages,
    loading, setLoading,
    abortController,
    history, setHistory, saveToHistory,
    costHistory, setCostHistory,
    totalCost, setTotalCost,
    handleSearch, regenerateLast, editUserMessage, handleStop
  } = useChat({
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
  });

  // Auto-scroll vers le dernier message (nouvelle question ou réponse reçue)
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  // Load history & token on mount
  useEffect(() => {
    const savedToken = sessionStorage.getItem("backend_token");
    if (savedToken) {
      setSystemPassword(savedToken);
    } else {
      // (C-1) Sécurité maximale : on récupère le mot de passe injecté directement
      // par la fenêtre native PyWebView, au lieu de faire une requête réseau locale.
      const checkPywebview = setInterval(async () => {
        // @ts-ignore
        if (window.pywebview && window.pywebview.api && window.pywebview.api.get_token) {
          clearInterval(checkPywebview);
          try {
            // @ts-ignore
            const token = await window.pywebview.api.get_token();
            if (token) {
              setSystemPassword(token);
              sessionStorage.setItem("backend_token", token);
            }
          } catch (e) {
            console.error("Erreur API native", e);
          }
        }
      }, 100);
      
      // Stop chercher après 2s (ex: si exécuté dans un simple navigateur pour le débug)
      setTimeout(() => clearInterval(checkPywebview), 2000);
    }


    
    setQualityMode(localStorage.getItem("quality_mode") === "1");
    setScopedDocs(localStorage.getItem("scoped_docs") === "1");
    const savedLang = localStorage.getItem("ui_lang");
    if (savedLang === "fr" || savedLang === "en") setLang(savedLang);
    fetchDocuments();
  }, []);

  // (R-12) Persiste le choix de langue.
  useEffect(() => { localStorage.setItem("ui_lang", lang); }, [lang]);



  // Recharge la liste des documents quand le mot de passe est saisi/modifié
  // (au montage, la requête part sans token et échoue en 401 -> liste vide).
  useEffect(() => {
    if (!systemPassword) return;
    const timer = setTimeout(() => { fetchDocuments(); fetchConversations(); checkApiKey(); fetchPricing(); }, 500); // debounce pendant la frappe
    return () => clearTimeout(timer);
  }, [systemPassword]);

  // (R-8) Détecte l'absence de clé API pour afficher une bannière d'aide.
  const checkApiKey = async () => {
    try {
      const data = await apiGet("/api/settings", systemPassword);
      const provider = data.llm_provider || "gemini";
      const noKeyRequired = provider === "ollama" || provider === "custom";
      setNeedsApiKey(!noKeyRequired && !data.llm_api_key_masked);
    } catch { /* serveur indisponible */ }
  };

  // Table de tarifs configurable, récupérée du backend (avec repli codé en dur).
  const fetchPricing = async () => {
    try {
      const data = await apiGet("/api/pricing", systemPassword);
      if (data.pricing) setPricing(data.pricing);
    } catch { /* repli sur les tarifs par défaut */ }
  };

  const fetchDocuments = async () => {
    try {
      const data = await apiGet("/api/documents", systemPassword);
      if (data.status === "success") {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- Conversations (sauvegardées sur disque via le backend) ---
  const fetchConversations = async () => {
    try {
      const data = await apiGet("/api/conversations", systemPassword);
      if (data.status === "success") setConversations(data.conversations);
    } catch { /* backend indisponible */ }
  };

  const loadConversation = async (id: string) => {
    try {
      const data = await apiGet(`/api/conversations/${id}`, systemPassword);
      setMessages((data.conversation?.messages || []).filter((m: any) => !m.loading));
      setCurrentConvId(id);
    } catch { /* ignore */ }
  };

  const newConversation = () => {
    setMessages([]);
    setCurrentConvId(null);
  };

  const deleteConversation = async (id: string) => {
    try {
      await apiSend(`/api/conversations/${id}`, systemPassword, "DELETE");
      if (id === currentConvId) newConversation();
      fetchConversations();
    } catch { /* ignore */ }
  };

  // (R-3) Renommage inline : window.prompt n'est pas fiable dans la fenêtre
  // native (WebView2 le désactive parfois). On passe par un champ éditable.
  const startRenaming = (id: string, currentTitle: string) => {
    setEditingConvId(id);
    setEditingTitle(currentTitle);
  };

  const commitRename = async () => {
    const id = editingConvId;
    const title = editingTitle.trim();
    setEditingConvId(null);
    if (!id || !title) return;
    // Mise à jour optimiste de la liste locale.
    setConversations(prev => prev.map((c: any) => c.id === id ? { ...c, title } : c));
    try {
      await apiSend(`/api/conversations/${id}`, systemPassword, "PATCH", { title: title.slice(0, 200) });
      fetchConversations();
    } catch { /* ignore */ }
  };

  // Sauvegarde automatique de la conversation courante (débouncée)
  useEffect(() => {
    if (messages.length === 0 || !systemPassword) return;
    if (messages.some((m: any) => m.loading)) return; // on attend la fin de la génération
    const timer = setTimeout(async () => {
      try {
        // (R-3) On préserve un titre renommé : on ne le dérive du premier
        // message QUE si la conversation n'a pas déjà un titre personnalisé.
        const existing = conversations.find((c: any) => c.id === currentConvId);
        const firstUser = messages.find((m: any) => m.role === "user");
        const title = (existing?.title || firstUser?.content || "Conversation").slice(0, 200);
        const res = await apiSend("/api/conversations", systemPassword, "POST", { id: currentConvId, title, messages: messages.slice(-200) });
        const data = await res.json();
        if (data.id && data.id !== currentConvId) setCurrentConvId(data.id);
        fetchConversations();
      } catch { /* ignore */ }
    }, 1200);
    return () => clearTimeout(timer);
  }, [messages, systemPassword]);

  const openSettings = async () => {
    setShowSettings(true);
    setLlmKey(""); setTavilyKey("");
    try {
      const saved = JSON.parse(localStorage.getItem("custom_pricing") || "{}");
      if (saved.in != null) setCustomInPrice(String(saved.in));
      if (saved.out != null) setCustomOutPrice(String(saved.out));
    } catch { /* tarifs custom illisibles, valeurs par défaut */ }
    try {
      const data = await apiGet("/api/settings", systemPassword);
      if (data.llm_provider) setLlmProvider(data.llm_provider);
      if (data.llm_base_url) setLlmBaseUrl(data.llm_base_url);
      setLlmModel(data.llm_model || "");
      setHasTavilyKey(!!data.tavily_api_key_masked);
      setHasLlmKey(!!data.llm_api_key_masked);
      setSettingsMsg(data.llm_api_key_masked ? `Clé LLM actuelle : ${data.llm_api_key_masked}` : "Aucune clé LLM configurée.");
    } catch (e: any) {
      if (e.message && (e.message.includes("401") || e.message.includes("403"))) {
        setSettingsMsg("⚠️ Entre d'abord le mot de passe du serveur.");
      } else {
        setSettingsMsg("⚠️ Serveur injoignable.");
      }
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await apiSend("/api/settings", systemPassword, "POST", {
        llm_provider: llmProvider,
        gemini_api_key: llmKey || null,
        tavily_api_key: tavilyKey || null,
        llm_base_url: llmProvider === "custom" ? (llmBaseUrl || null) : null,
        llm_model: llmProvider === "deepseek" ? "" : (llmModel || ""),
      });
      // Tarifs du modèle personnalisé (pour l'affichage des coûts, côté navigateur)
      localStorage.setItem("custom_pricing", JSON.stringify({
        in: parseFloat(customInPrice) || 0,
        out: parseFloat(customOutPrice) || 0,
      }));
      const data = await res.json();
      setSettingsMsg(data.message || (res.ok ? "Enregistré ✓" : "Erreur."));
      if (res.ok && data.status === "success") { 
        setLlmKey(""); 
        setTavilyKey(""); 
        checkApiKey(); 
        const freshData = await apiGet("/api/settings", systemPassword);
        setHasTavilyKey(!!freshData.tavily_api_key_masked);
        setHasLlmKey(!!freshData.llm_api_key_masked);
      }
    } catch {
      setSettingsMsg("⚠️ Serveur injoignable.");
    }
    setSavingSettings(false);
  };

  const deleteKey = async (type: "llm" | "tavily") => {
    try {
      const res = await apiSend("/api/settings", systemPassword, "POST", {
        [type === "llm" ? "clear_llm_key" : "clear_tavily_key"]: true
      });
      if (res.ok) {
        checkApiKey();
        const data = await apiGet("/api/settings", systemPassword);
        setHasTavilyKey(!!data.tavily_api_key_masked);
        setHasLlmKey(!!data.llm_api_key_masked);
        setSettingsMsg(data.llm_api_key_masked ? `Clé LLM actuelle : ${data.llm_api_key_masked}` : "Aucune clé LLM configurée.");
      }
    } catch {}
  };

  const clearDocuments = async () => {
    setIsClearing(true);
    try {
      await apiSend("/api/documents", systemPassword, "DELETE");
      setDocuments([]);
    } catch (e) {
      console.error(e);
    }
    setIsClearing(false);
  };

  const deleteDocument = async (filename: string) => {
    try {
      await apiSend(`/api/documents/${encodeURIComponent(filename)}`, systemPassword, "DELETE");
      fetchDocuments();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSelectedDocs = async () => {
    setIsClearing(true);
    try {
      await Promise.all(selectedDocs.map(doc =>
        apiSend(`/api/documents/${encodeURIComponent(doc)}`, systemPassword, "DELETE")
      ));
      await fetchDocuments();
      setSelectedDocs([]);
      setIsEditingDocs(false);
    } catch (e) {
      console.error(e);
    }
    setIsClearing(false);
  };

  const deleteSelectedHistory = () => {
    const newHistory = history.filter(h => !selectedHistory.includes(h));
    setHistory(newHistory);
    localStorage.setItem("rag_history", JSON.stringify(newHistory));
    setSelectedHistory([]);
    setIsEditingHistory(false);
  };

  const clearAllHistory = () => {
    setHistory([]);
    localStorage.setItem("rag_history", JSON.stringify([]));
    setSelectedHistory([]);
    setIsEditingHistory(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const exportChatToMarkdown = () => {
    if (messages.length === 0) return;
    // Bug corrigé : "\\n" produisait des antislash-n littéraux au lieu de
    // vrais retours à la ligne — l'export tenait sur une seule ligne.
    let md = "# Export de Conversation (KING2MO)\n\n";
    messages.forEach(msg => {
      md += `**${msg.role === 'user' ? 'Vous' : 'IA'}** :\n`;
      md += `${msg.content}\n\n`;
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation_${new Date().getTime()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleHistorySelection = (h: string) => {
    setSelectedHistory(prev => prev.includes(h) ? prev.filter(item => item !== h) : [...prev, h]);
  };

  const toggleDocSelection = (doc: string) => {
    setSelectedDocs(prev => prev.includes(doc) ? prev.filter(item => item !== doc) : [...prev, doc]);
  };

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === "dark" ? "light" : "dark");

  const handleReset = () => {
    setMessages([]);
    setQuery("");
    setLoading(false);
    setCurrentConvId(null); // clic sur le logo = nouvelle conversation
  };

  // (R-9) Glisser-déposer d'un fichier sur la fenêtre.
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // On ne quitte l'état que si on sort réellement de la fenêtre.
    if (e.currentTarget === e.target) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const copyToClipboard = (text: string, msgId: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const downloadMarkdown = (text: string) => {
    if (!text) return;
    const blob = new Blob([`# Résultat KING2MO\n\nMode: ${mode}\n\n${text}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KING2MO_Result_${new Date().getTime()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await uploadFile(e.target.files[0]);
    // Clear input pour permettre le ré-upload du même fichier
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // (R-9) Cœur de l'upload, réutilisable par le clic ET le glisser-déposer.
  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!["pdf", "txt", "docx", "xlsx", "pptx"].includes(ext || "")) {
        setUploadMessage("❌ Format non supporté. (pdf, txt, docx, xlsx, pptx uniquement)");
        setTimeout(() => setUploadMessage(null), 5000);
        return;
    }

    setUploading(true);
    setUploadMessage("Upload en cours...");
    
    const formData = new FormData();
    formData.append("file", file);
    // (R-13) Si le cloisonnement est actif et qu'une conversation est ouverte,
    // le document est réservé à cette conversation ; sinon il est "global".
    formData.append("scope", (scopedDocs && currentConvId) ? currentConvId : "global");

    try {
      const response = await apiSend("/api/upload", systemPassword, "POST", formData, true);
      const data = await response.json();
      if (data.status === "success") {
        setUploadMessage(`✅ ${data.message}`);
        fetchDocuments(); // Refresh list
      } else if (data.status === "warning") {
        setUploadMessage(`⚠️ ${data.message}`);
      } else if (!response.ok) {
        setUploadMessage(`❌ Erreur : ${data.detail || data.message || `HTTP ${response.status}`}`);
      } else {
        setUploadMessage(`❌ Erreur : ${data.message}`);
      }
    } catch (err) {
      setUploadMessage("❌ Erreur de connexion avec le backend.");
    }
    setUploading(false);
    
    // Clear input
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      setUploadMessage(null);
    }, 5000);
  };

  const bgRGB = theme === 'dark' ? '5, 5, 8' : '255, 255, 255';

  return (
    <div className="app-container" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Authentic Matrix Glow */}
      <div className="aurora-bg"></div>
      <div className={`search-dim-overlay ${isSearchFocused ? 'active' : ''}`}></div>

      {/* (R-9) Superposition de glisser-déposer */}
      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(5,5,8,0.75)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '3px dashed var(--accent-color)', pointerEvents: 'none' }}>
          <Paperclip size={48} style={{ color: 'var(--accent-color)', marginBottom: '1rem' }} />
          <div style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif" }}>{t(lang, 'drop_here')}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>PDF · TXT · DOCX · XLSX · PPTX</div>
        </div>
      )}

      {/* SIDEBAR */}
      <Sidebar
        lang={lang}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        conversations={conversations}
        currentConvId={currentConvId}
        editingConvId={editingConvId}
        editingTitle={editingTitle}
        setEditingTitle={setEditingTitle}
        setEditingConvId={setEditingConvId}
        onNewConversation={newConversation}
        onLoadConversation={loadConversation}
        onStartRenaming={startRenaming}
        onCommitRename={commitRename}
        onDeleteConversation={deleteConversation}
        onReset={handleReset}
        onOpenSettings={openSettings}
        history={history}
        isEditingHistory={isEditingHistory}
        setIsEditingHistory={setIsEditingHistory}
        selectedHistory={selectedHistory}
        onToggleHistorySelection={toggleHistorySelection}
        onSearch={handleSearch}
        onDeleteSelectedHistory={deleteSelectedHistory}
        onClearAllHistory={clearAllHistory}
        documents={documents}
        isEditingDocs={isEditingDocs}
        setIsEditingDocs={setIsEditingDocs}
        selectedDocs={selectedDocs}
        isClearing={isClearing}
        onToggleDocSelection={toggleDocSelection}
        onDeleteDocument={deleteDocument}
        onDeleteSelectedDocs={deleteSelectedDocs}
        onClearDocuments={clearDocuments}
      />

      {/* SETTINGS MODAL */}
      <SettingsModal 
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        lang={lang}
        bgRGB={bgRGB}
        llmProvider={llmProvider}
        setLlmProvider={setLlmProvider}
        llmBaseUrl={llmBaseUrl}
        setLlmBaseUrl={setLlmBaseUrl}
        llmModel={llmModel}
        setLlmModel={setLlmModel}
        customInPrice={customInPrice}
        setCustomInPrice={setCustomInPrice}
        customOutPrice={customOutPrice}
        setCustomOutPrice={setCustomOutPrice}
        qualityMode={qualityMode}
        setQualityMode={setQualityMode}
        scopedDocs={scopedDocs}
        setScopedDocs={setScopedDocs}
        llmKey={llmKey}
        setLlmKey={setLlmKey}
        systemPassword={systemPassword}
        setSystemPassword={setSystemPassword}
        tavilyKey={tavilyKey}
        setTavilyKey={setTavilyKey}
        hasTavilyKey={hasTavilyKey}
        hasLlmKey={hasLlmKey}
        settingsMsg={settingsMsg}
        saveSettings={saveSettings}
        savingSettings={savingSettings}
        deleteKey={deleteKey}
      />

      {/* MAIN CONTENT */}
      <div className="main-content" style={{ paddingLeft: sidebarOpen ? "2rem" : "5rem", display: 'flex', flexDirection: 'column' }}>

        {/* (R-8) Bannière : aucune clé API configurée */}
        {needsApiKey && (
          <div style={{ position: 'relative', zIndex: 200, maxWidth: '900px', margin: '0 auto 1rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '0.7rem 1rem', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.4)', borderRadius: '10px', color: '#fbbf24', fontSize: '0.85rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Key size={16} /> {t(lang, 'no_api_key')}</span>
            <button onClick={openSettings} style={{ background: 'var(--accent-color)', color: '#000', border: 'none', padding: '0.4rem 0.9rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              {t(lang, 'open_settings')}
            </button>
          </div>
        )}

        {/* DASHBOARD OVERLAY */}
        <Dashboard 
          showDashboard={showDashboard}
          setShowDashboard={setShowDashboard}
          sidebarOpen={sidebarOpen}
          bgRGB={bgRGB}
          dashboardOpacity={dashboardOpacity}
          setDashboardOpacity={setDashboardOpacity}
          totalCost={totalCost}
          costHistory={costHistory}
        />

        {/* SOURCE MODAL OVERLAY */}
        <SourceModal selectedSource={selectedSource} setSelectedSource={setSelectedSource} bgRGB={bgRGB} />
        
        <div className="noise-overlay"></div>
        <NeuralNetwork />
        
        {/* Ambient background glows for empty sides */}
        {(messages.length === 0) && (
          <>
            <div className="ambient-glow glow-left"></div>
            <div className="ambient-glow glow-right"></div>
          </>
        )}
        
        {/* Top Right Controls */}
        <TopBar
          lang={lang}
          setLang={setLang}
          theme={theme}
          toggleTheme={toggleTheme}
          messagesLength={messages.length}
          onExport={exportChatToMarkdown}
          onOpenDashboard={() => setShowDashboard(true)}
          totalCost={totalCost}
          systemPassword={systemPassword}
        />

        {(messages.length === 0) && (
          <div className="hero-wrapper" style={{ marginTop: '6vh' }}>
            <div className="hero-title-container">
              <h1 className="hero-title">KING2MO</h1>
              <span className="hero-badge">RAG</span>
            </div>
            <p className="hero-subtitle" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '0.8rem', fontSize: '0.9rem', letterSpacing: '1px', opacity: 0.7 }}>
              {t(lang, 'subtitle')}
            </p>
          </div>
        )}

        {/* Header bar / Title for active chat */}
        {messages.length > 0 && (
          <div className="chat-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '900px', margin: '0 auto 1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>DISCUSSION ACTIVE</span>
            <button onClick={handleReset} className="reset-btn" aria-label="Nouvelle conversation" title="Reprendre à zéro" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* MESSAGES LIST (CHAT CORE) */}
        {messages.length > 0 && (
          <div className="chat-messages-container" style={{ flex: 1, overflowY: 'auto', paddingBottom: '120px', width: '100%', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {messages.map((msg, idx) => (
              <ChatMessage 
                key={msg.id}
                msg={msg}
                idx={idx}
                loading={loading}
                lang={lang}
                copiedId={copiedId}
                messagesLength={messages.length}
                editUserMessage={editUserMessage}
                setSelectedSource={setSelectedSource}
                copyToClipboard={copyToClipboard}
                downloadMarkdown={downloadMarkdown}
                regenerateLast={regenerateLast}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* SEARCH ROW (BOTTOM STICKY FOR ACTIVE CHAT, MIDDLE FOR HOME) */}
        <SearchBar
          lang={lang}
          messagesLength={messages.length}
          sidebarOpen={sidebarOpen}
          bgRGB={bgRGB}
          query={query}
          setQuery={setQuery}
          onSearch={handleSearch}
          loading={loading}
          onStop={handleStop}
          uploading={uploading}
          uploadMessage={uploadMessage}
          onFileUpload={handleFileUpload}
          onImageUpload={handleImageUpload}
          fileInputRef={fileInputRef}
          imageInputRef={imageInputRef}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          isSearchFocused={isSearchFocused}
          setIsSearchFocused={setIsSearchFocused}
        />

        {/* HOME MODE CONTROLS & WELCOME CARDS (ONLY ON ROOT SCREEN) */}
        {messages.length === 0 && (
          <div style={{ width: '100%', maxWidth: '680px', margin: '1.5rem auto 0' }}>
            <div className="mode-segmented-control">
              <button className={`mode-btn ${mode === 'hybrid' ? 'active' : ''}`} onClick={() => setMode('hybrid')}>
                <Sparkles size={16} />
                {t(lang, 'mode_hybrid')}
              </button>
              <button className={`mode-btn ${mode === 'web' ? 'active' : ''}`} onClick={() => setMode('web')}>
                <Globe size={16} />
                {t(lang, 'mode_web')}
              </button>
              <button className={`mode-btn ${mode === 'local' ? 'active' : ''}`} onClick={() => setMode('local')}>
                <Folder size={16} />
                {t(lang, 'mode_local')}
              </button>
            </div>
            
            <div className="welcome-grid">
              <div className="welcome-card" onClick={() => handleSearch(lang === 'en' ? "Explain the concept of Agentic RAG" : "Explique le concept d'Agentic RAG")}>
                <Cpu size={24} />
                <div className="welcome-card-title">{t(lang, 'card_rag_t')}</div>
                <div className="welcome-card-subtitle">{t(lang, 'card_rag_s')}</div>
              </div>
              <div className="welcome-card" onClick={() => handleSearch(lang === 'en' ? "What is the latest AI news?" : "Quelles sont les dernières actus IA ?")}>
                <Globe size={24} />
                <div className="welcome-card-title">{t(lang, 'card_news_t')}</div>
                <div className="welcome-card-subtitle">{t(lang, 'card_news_s')}</div>
              </div>
              <div className="welcome-card" onClick={() => handleSearch(lang === 'en' ? "Summarize the key information from the manual" : "Résume les informations clés du manuel")}>
                <BookOpen size={24} />
                <div className="welcome-card-title">{t(lang, 'card_local_t')}</div>
                <div className="welcome-card-subtitle">{t(lang, 'card_local_s')}</div>
              </div>
            </div>
            
            <div className="suggestions-container" style={{ marginTop: '4rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.2rem', textTransform: 'uppercase', letterSpacing: '1.5px', opacity: 0.6 }}>
                {t(lang, 'suggestions')}
              </p>
              <div className="suggestions-flex" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'center', maxWidth: '800px', margin: '0 auto' }}>
                <button className="suggestion-pill" onClick={() => handleSearch("Comment optimiser un système RAG ?")} style={{ width: '100%', maxWidth: '400px', justifyContent: 'center' }}>
                  <Sparkles size={14} /> Comment optimiser un système RAG ?
                </button>
                <button className="suggestion-pill" onClick={() => handleSearch("Tendances de l'IA générative en 2026")} style={{ width: '100%', maxWidth: '400px', justifyContent: 'center' }}>
                  <Globe size={14} /> Tendances de l'IA générative en 2026
                </button>
                <button className="suggestion-pill" onClick={() => handleSearch("Exemple de Prompt Engineering avancé")} style={{ width: '100%', maxWidth: '400px', justifyContent: 'center' }}>
                  <Book size={14} /> Exemple de Prompt Engineering avancé
                </button>
                <button className="suggestion-pill" onClick={() => handleSearch("Sécurité et confidentialité des LLMs")} style={{ width: '100%', maxWidth: '400px', justifyContent: 'center' }}>
                  <Key size={14} /> Sécurité et confidentialité des LLMs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER (ONLY ON ROOT SCREEN) */}
        {messages.length === 0 && (
          <div className="app-footer" style={{ marginTop: '4rem', marginBottom: '2rem', width: '100%', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', opacity: 0.65, letterSpacing: '1px' }}>
            Propulsé par Agentic RAG • v{APP_VERSION}
          </div>
        )}

      </div>
    </div>
  );
}
