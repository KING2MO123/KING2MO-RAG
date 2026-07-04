"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Sparkles, Sidebar as SidebarIcon, Key, Link2, BookOpen, Clock, Copy, Check, Download, Book, X, Cpu, Globe, Folder, Paperclip, ExternalLink, BarChart2, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, BarChart, Bar } from 'recharts';

// URL du backend configurable (m5) : évite le localhost:8000 codé en dur.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Nombre max d'entrées conservées dans l'historique des coûts (m2).
const MAX_COST_HISTORY = 100;

// The NeuralNetwork component generates a constellation of nodes connecting to each other
const NeuralNetwork = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: { x: number, y: number, vx: number, vy: number, radius: number }[] = [];
    const particleCount = 60;
    const connectionDistance = 150;
    const speed = 0.3;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Initialize
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        radius: Math.random() * 1.5 + 0.5
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(16, 185, 129, 0.6)'; // Emerald color, slightly accentuated
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const opacity = 1 - (dist / connectionDistance);
            ctx.strokeStyle = `rgba(16, 185, 129, ${opacity * 0.25})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -2, pointerEvents: 'none' }} />;
};

export default function Home() {
  
  const [systemPassword, setSystemPassword] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  
  // UI States
  const [theme, setTheme] = useState("dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState("hybrid");

  // Upload States
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);


  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Knowledge Base States
  const [documents, setDocuments] = useState<string[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  
  // Cost State
  const [totalCost, setTotalCost] = useState(0);
  const [costHistory, setCostHistory] = useState<any[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [dashboardOpacity, setDashboardOpacity] = useState(0.4);

  // Selection / Edit Mode States
  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<string[]>([]);
  const [isEditingDocs, setIsEditingDocs] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Auto-scroll vers le dernier message (nouvelle question ou réponse reçue)
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  // Load history & token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("backend_token");
    if (savedToken) setSystemPassword(savedToken);

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
    
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/documents`, { headers: { "X-API-Token": systemPassword } });
      const data = await res.json();
      if (data.status === "success") {
        setDocuments(data.documents);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const clearDocuments = async () => {
    setIsClearing(true);
    try {
      await fetch(`${API_BASE}/api/documents`, { method: "DELETE", headers: { "X-API-Token": systemPassword } });
      setDocuments([]);
    } catch (e) {
      console.error(e);
    }
    setIsClearing(false);
  };

  const deleteDocument = async (filename: string) => {
    try {
      await fetch(`${API_BASE}/api/documents/${encodeURIComponent(filename)}`, { method: "DELETE", headers: { "X-API-Token": systemPassword } });
      fetchDocuments();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSelectedDocs = async () => {
    setIsClearing(true);
    try {
      await Promise.all(selectedDocs.map(doc =>
        fetch(`${API_BASE}/api/documents/${encodeURIComponent(doc)}`, { method: "DELETE", headers: { "X-API-Token": systemPassword } })
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
    let md = "# Export de Conversation (KING2MO)\\n\\n";
    messages.forEach(msg => {
      md += `**${msg.role === 'user' ? 'Vous' : 'IA'}** :\\n`;
      md += `${msg.content}\\n\\n`;
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

  const saveToHistory = (q: string) => {
    if (!q) return;
    const newHistory = [q, ...history.filter(h => h !== q)].slice(0, 5);
    setHistory(newHistory);
    localStorage.setItem("rag_history", JSON.stringify(newHistory));
  };

  const handleSearch = async (searchQuery: string = query) => {
    const newQuery = searchQuery.trim();
    if (!newQuery || loading) return;

    setQuery("");
    saveToHistory(newQuery);

    // 1. Add User Message
    const userMsgId = Date.now().toString();
    const userMsg = { id: userMsgId, role: "user", content: newQuery };
    
    // 2. Build conversational history from current messages
    // We only take the text content, and ignore the initial empty assistant loading message.
    const chatHistory = messages
      .filter(m => !m.loading && m.content)
      .map(m => ({ role: m.role, content: m.content }));
      
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

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Token": systemPassword
        },
        body: JSON.stringify({
          query: newQuery,
          mode,
          history: chatHistory,
          image_base64: selectedImage
        }),
      });

      setSelectedImage(null);

      // C2 : on vérifie le statut HTTP. Une 422 (clé manquante) ou une 5xx
      // renvoie du JSON, pas du SSE : sans ce garde, le flux ne contiendrait
      // aucun événement et le spinner tournerait indéfiniment.
      if (!response.ok) {
        let detail = `Erreur serveur (HTTP ${response.status}).`;
        try {
          const errBody = await response.json();
          if (errBody?.detail) {
            detail = Array.isArray(errBody.detail)
              ? errBody.detail.map((d: any) => d.msg || JSON.stringify(d)).join(" ; ")
              : String(errBody.detail);
          }
        } catch { /* corps non-JSON, on garde le message par défaut */ }
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
          // Buffer : un événement SSE peut être coupé entre deux chunks réseau
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";
          for (const line of events) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                if (data.type === "status") {
                  setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, status: `TRAITEMENT : ${data.node.toUpperCase()}` } : m));
                } else if (data.type === "result") {
                  const inTok = data.input_tokens || 0;
                  const outTok = data.output_tokens || 0;
                  const sCount = data.search_count || 0;
                  
                  let usedModel = "Serveur IA";
                  let inPrice = 0.075;
                  let outPrice = 0.30;
                  // (Le modèle exact est connu du backend)
                  
                  const msgCost = (inTok / 1000000) * inPrice + (outTok / 1000000) * outPrice + sCount * 0.005;
                  
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
                    // m2 : on borne l'historique pour ne pas saturer le localStorage.
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
      // m4 : message d'erreur plus précis (statut/détail du backend).
      const msg = error?.message || "Erreur de connexion au serveur Backend.";
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? {
        ...m,
        content: `❌ ${msg}`,
        loading: false,
        status: null
      } : m));
    } finally {
      // C2 : garantit l'arrêt du spinner même si le flux se termine sans
      // événement "result"/"error" (réponse inattendue, connexion coupée…).
      setLoading(false);
      setMessages(prev => prev.map(m =>
        (m.id === assistantMsgId && m.loading)
          ? { ...m, loading: false, status: null, content: m.content || "❌ Aucune réponse reçue du serveur." }
          : m
      ));
    }
  };

  const handleReset = () => {
    setMessages([]);
    setQuery("");
    setLoading(false);
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
    const file = e.target.files[0];
    if (file.type !== "application/pdf") {
        setUploadMessage("❌ Seuls les PDF sont acceptés.");
        return;
    }
    
    setUploading(true);
    setUploadMessage("Upload en cours...");
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: { "X-API-Token": systemPassword },
        body: formData,
      });
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
    <div className="app-container">
      {/* Authentic Matrix Glow */}
      <div className="aurora-bg"></div>
      <div className={`search-dim-overlay ${isSearchFocused ? 'active' : ''}`}></div>

      {/* SIDEBAR */}
      <div className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
        <div className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <SidebarIcon size={20} />
        </div>

        <div className="sb-brand" onClick={handleReset} style={{ cursor: 'pointer' }}>KING2MO</div>
        
        <div>
          <div className="sb-section-title">ACCÈS SYSTÈME</div>
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Mot de passe</label>
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-color)', opacity: systemPassword ? 1 : 0, transition: 'opacity 0.3s' }}>✓ Sauvegardé</span>
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type="password" 
                className="sidebar-input" 
                placeholder="Mot de passe du serveur..." 
                value={systemPassword} 
                onChange={(e) => { setSystemPassword(e.target.value); localStorage.setItem('backend_token', e.target.value); }} 
              />
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="history-section">
            <div className="sb-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>HISTORIQUE RÉCENT</span>
              <button 
                onClick={() => setIsEditingHistory(!isEditingHistory)} 
                style={{ background: 'none', border: 'none', color: isEditingHistory ? 'var(--accent-color)' : 'var(--text-secondary)', fontSize: '0.65rem', cursor: 'pointer', opacity: 0.8 }}
              >
                {isEditingHistory ? 'TERMINER' : 'GÉRER'}
              </button>
            </div>
            <div className="history-list">
              {history.map((h, i) => (
                <div key={i} className="history-item" onClick={() => isEditingHistory ? toggleHistorySelection(h) : handleSearch(h)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isEditingHistory ? (
                    <input type="checkbox" checked={selectedHistory.includes(h)} readOnly style={{ cursor: 'pointer' }} />
                  ) : (
                    <Clock size={14} />
                  )}
                  <span>{h.length > 25 ? h.substring(0, 25) + '...' : h}</span>
                </div>
              ))}
            </div>
            {isEditingHistory && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={deleteSelectedHistory}
                  disabled={selectedHistory.length === 0}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: selectedHistory.length > 0 ? '#ef4444' : 'var(--text-secondary)', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: selectedHistory.length > 0 ? 'pointer' : 'not-allowed' }}
                >
                  Supprimer
                </button>
                <button 
                  onClick={clearAllHistory}
                  style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: '#ef4444', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Tout vider
                </button>
              </div>
            )}
          </div>
        )}

        {/* On a retiré le widget de coûts de session d'ici pour le mettre en haut à droite */}

        <div className="history-section" style={{ marginTop: '2rem' }}>
          <div className="sb-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>BASE DE CONNAISSANCES</span>
            {documents.length > 0 && (
              <button 
                onClick={() => setIsEditingDocs(!isEditingDocs)} 
                disabled={isClearing}
                style={{ background: 'none', border: 'none', color: isEditingDocs ? 'var(--accent-color)' : 'var(--text-secondary)', fontSize: '0.65rem', cursor: 'pointer', opacity: 0.8 }}
              >
                {isEditingDocs ? 'TERMINER' : 'GÉRER'}
              </button>
            )}
          </div>
          <div className="history-list">
            {documents.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>Aucun document local.</div>
            ) : (
              documents.map((doc, i) => (
                <div key={i} className="history-item" onClick={() => isEditingDocs ? toggleDocSelection(doc) : null} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isEditingDocs ? 'pointer' : 'default' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    {isEditingDocs ? (
                      <input type="checkbox" checked={selectedDocs.includes(doc)} readOnly style={{ cursor: 'pointer' }} />
                    ) : (
                      <Book size={14} style={{ flexShrink: 0 }} />
                    )}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>{doc}</span>
                  </div>
                  {!isEditingDocs && (
                    <button 
                      aria-label="Supprimer le document"
                      onClick={(e) => { e.stopPropagation(); deleteDocument(doc); }} 
                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                      title="Supprimer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
          {isEditingDocs && documents.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button 
                onClick={deleteSelectedDocs}
                disabled={selectedDocs.length === 0 || isClearing}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: selectedDocs.length > 0 ? '#ef4444' : 'var(--text-secondary)', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: selectedDocs.length > 0 ? 'pointer' : 'not-allowed' }}
              >
                {isClearing ? 'En cours...' : 'Supprimer'}
              </button>
              <button 
                onClick={clearDocuments}
                disabled={isClearing}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: '#ef4444', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer' }}
              >
                Tout vider
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content" style={{ paddingLeft: sidebarOpen ? "2rem" : "5rem", display: 'flex', flexDirection: 'column' }}>
        
        {/* DASHBOARD OVERLAY */}
        {showDashboard && (
          <div onClick={() => setShowDashboard(false)} style={{ position: 'absolute', inset: 0, left: sidebarOpen ? "300px" : "80px", zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '900px', maxHeight: '90%', background: `rgba(${bgRGB}, ${dashboardOpacity})`, backdropFilter: `blur(${dashboardOpacity * 40}px)`, WebkitBackdropFilter: `blur(${dashboardOpacity * 40}px)`, border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '2rem', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 600, fontFamily: "'Outfit', sans-serif", margin: 0, flex: '1 1 auto', minWidth: '250px' }}><BarChart2 style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} /> Tableau de Bord API</h1>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'var(--glass-bg)', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Opacité</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="0.95" 
                    step="0.05" 
                    value={dashboardOpacity} 
                    onChange={(e) => setDashboardOpacity(Number(e.target.value))}
                    style={{ width: '80px', accentColor: 'var(--text-primary)', cursor: 'pointer' }}
                  />
                </div>
                <button aria-label="Fermer le tableau de bord" onClick={() => setShowDashboard(false)} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', gap: '0.5rem', alignItems: 'center', transition: 'all 0.2s' }}>
                  <X size={16} /> Fermer
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '3rem', marginBottom: '4rem', paddingBottom: '2rem', borderBottom: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Total expenses</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 300, color: 'var(--text-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                  ${totalCost.toFixed(5)} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>USD</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Total requests</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 300, color: 'var(--text-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>
                  {costHistory.length}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 0.5rem 0', color: 'var(--text-primary)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Global usage</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>Expenses <span style={{ color: 'var(--text-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>${totalCost.toFixed(5)}</span></div>
                </div>
              </div>
              
              {costHistory.length > 0 ? (
                <div style={{ height: '180px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={costHistory} margin={{ top: 10, right: 0, left: -20, bottom: 60 }} barCategoryGap="5%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" opacity={0.3} />
                      <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--glass-border)' }} tickFormatter={(t) => { const m = t.match(/(\d{1,2}:\d{2})/); return m ? m[1] : t; }} />
                      <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(4)}`} />
                      <Tooltip cursor={{ fill: 'var(--glass-border)', opacity: 0.2 }} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }} itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }} />
                      <Bar dataKey="cost" name="Cost" fill="#fbbf24" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ display: 'flex', height: '180px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Aucune donnée disponible. Posez une question pour commencer.</div>
              )}
            </div>

            {(() => {
              const modelsData: Record<string, { totalCost: number, totalInTokens: number, totalOutTokens: number, history: any[] }> = {};
              costHistory.forEach(curr => {
                const mod = curr.model || "Serveur IA";
                if (!modelsData[mod]) modelsData[mod] = { totalCost: 0, totalInTokens: 0, totalOutTokens: 0, history: [] };
                modelsData[mod].totalCost += curr.cost;
                modelsData[mod].totalInTokens += curr.inTokens;
                modelsData[mod].totalOutTokens += curr.outTokens;
                modelsData[mod].history.push(curr);
              });
              
              return Object.entries(modelsData).map(([modelName, data]) => (
                <div key={modelName} style={{ marginBottom: '3rem' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', marginBottom: '2rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>{modelName.toLowerCase()}-model</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem' }}>
                    
                    {/* API Requests / Cost */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>API expenses</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>${data.totalCost.toFixed(5)}</span>
                      </div>
                      <div style={{ height: '140px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data.history} margin={{ top: 10, right: 0, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" opacity={0.3} />
                            <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--glass-border)' }} tickFormatter={(t) => { const m = t.match(/(\d{1,2}:\d{2})/); return m ? m[1] : t; }} />
                            <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
                            <Tooltip 
                              cursor={{ stroke: 'var(--text-secondary)', strokeWidth: 1, strokeDasharray: '4 4' }} 
                              contentStyle={{ background: '#202022', border: '1px solid #333', borderRadius: '8px', color: '#fff' }} 
                              itemStyle={{ color: '#fff' }} 
                              labelStyle={{ color: '#aaa', marginBottom: '4px' }} 
                            />
                            <Area type="monotone" dataKey="cost" name="API requests" stroke={modelName === "DeepSeek" ? "#5c7cfa" : "#20c997"} strokeWidth={2} fill={modelName === "DeepSeek" ? "#5c7cfa" : "#20c997"} fillOpacity={0.7} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Tokens */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tokens (In/Out)</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{(data.totalInTokens + data.totalOutTokens).toLocaleString()}</span>
                      </div>
                      <div style={{ height: '140px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data.history} margin={{ top: 10, right: 0, left: -20, bottom: 20 }} barCategoryGap="5%">
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--glass-border)" opacity={0.3} />
                            <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--glass-border)' }} tickFormatter={(t) => { const m = t.match(/(\d{1,2}:\d{2})/); return m ? m[1] : t; }} />
                            <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                            <Tooltip cursor={{ fill: 'var(--glass-border)', opacity: 0.2 }} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }} />
                            <Bar dataKey="inTokens" stackId="t" name="In Tokens" fill={modelName === "DeepSeek" ? "#93c5fd" : "#6ee7b7"} radius={[0, 0, 0, 0]} />
                            <Bar dataKey="outTokens" stackId="t" name="Out Tokens" fill={modelName === "DeepSeek" ? "#3b82f6" : "#10b981"} radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>
                </div>
              ));
            })()}
            </div>
          </div>
        )}
        
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
        <div className="top-right-controls" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {messages.length > 0 && (
            <button 
              onClick={exportChatToMarkdown}
              className="cost-pill"
              title="Exporter la conversation en Markdown"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                color: 'var(--text-color)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)'
              }}
            >
              <Download size={14} />
              <span>Export</span>
            </button>
          )}
          <button 
            onClick={() => setShowDashboard(true)}
            className="cost-pill"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              padding: '0.4rem 0.8rem',
              borderRadius: '20px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: 'var(--text-primary)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--glass-bg)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
          >
            <Cpu size={14} style={{ color: 'var(--accent-color)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
              ${totalCost.toFixed(5)}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: '0.3rem', borderLeft: '1px solid var(--glass-border)', paddingLeft: '0.5rem', opacity: 0.8 }}>
              {!systemPassword ? "Verrouillé" : "Serveur IA"}
            </span>
          </button>

          <div className="theme-switch-wrapper" style={{ margin: 0 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{theme === 'dark' ? 'DARK' : 'LIGHT'}</span>
            <label className="theme-switch">
              <input type="checkbox" checked={theme === 'light'} onChange={toggleTheme} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {(messages.length === 0) && (
          <div className="hero-wrapper" style={{ marginTop: '6vh' }}>
            <div className="hero-title-container">
              <h1 className="hero-title">KING2MO</h1>
              <span className="hero-badge">RAG</span>
            </div>
            <p className="hero-subtitle" style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '0.8rem', fontSize: '0.9rem', letterSpacing: '1px', opacity: 0.7 }}>
              Votre assistant de recherche intelligent
            </p>
          </div>
        )}

        {/* Header bar / Title for active chat */}
        {messages.length > 0 && (
          <div className="chat-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '900px', margin: '0 auto 1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>DISCUSSION ACTIVE</span>
            <button onClick={handleReset} className="reset-btn" title="Reprendre à zéro" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
              <X size={16} />
            </button>
          </div>
        )}

        {/* MESSAGES LIST (CHAT CORE) */}
        {messages.length > 0 && (
          <div className="chat-messages-container" style={{ flex: 1, overflowY: 'auto', paddingBottom: '120px', width: '100%', maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {messages.map((msg, idx) => (
              <div key={msg.id} className={`chat-message-row ${msg.role}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: (msg.role === 'user' && idx > 0) ? '1.25rem' : '0' }}>
                
                {/* User Message Rendering (bulle de chat) */}
                {msg.role === 'user' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="user-bubble">{msg.content}</div>
                  </div>
                )}

                {/* Assistant Message Rendering */}
                {msg.role === 'assistant' && (
                  <div className="assistant-message-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                    
                    {msg.loading ? (
                      <div className="skeleton-container" style={{ padding: 0, background: 'none', border: 'none', boxShadow: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--accent-color)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                          <Loader2 size={16} className="animate-spin" />
                          <span>{msg.status || "ANALYSE EN COURS..."}</span>
                        </div>
                        <div className="skeleton-line title" style={{ marginTop: '0.8rem' }}></div>
                        <div className="skeleton-line full"></div>
                        <div className="skeleton-line full"></div>
                        <div className="skeleton-line medium"></div>
                      </div>
                    ) : (
                      <>
                        {/* Response Text */}
                        <div className="result-body" style={{ marginTop: 0 }}>
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({node, className, children, ...props}: any) {
                                // M5 : react-markdown v10 ne fournit plus la prop `inline`.
                                // On détecte un bloc via la présence d'une classe language-*
                                // (les codes inline n'en ont pas).
                                const match = /language-(\w+)/.exec(className || '')
                                return match ? (
                                  <SyntaxHighlighter
                                    style={vscDarkPlus as any}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ margin: '0 0 0.9rem', borderRadius: '10px', border: '1px solid var(--glass-border)', fontSize: '0.85rem' }}
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                )
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Inline Horizontal Sources */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="sources-inline-container" style={{ marginTop: '0.5rem' }}>
                            <h3 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontFamily: "'Outfit', sans-serif", display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Link2 size={12} /> Sources ({msg.sources.length})
                            </h3>
                            <div className="sources-horizontal-scroll" style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto', paddingBottom: '0.6rem' }}>
                              {msg.sources.map((src: any, i: number) => {
                                const rawSource = String(src.source || src.metadata?.source || "");
                                const url = src.url || src.metadata?.url || (rawSource.startsWith("http") ? rawSource : null);
                                let label = "Document Local";
                                if (rawSource && !rawSource.startsWith("http")) {
                                  label = rawSource.split(/[\\/]/).pop() || rawSource;
                                } else if (url) {
                                  try { label = new URL(url).hostname.replace(/^www\./, ""); } catch { label = url; }
                                }
                                return (
                                  <div key={i} className="source-card-compact" onClick={() => url && window.open(url, "_blank")} title={url || rawSource} style={{ cursor: url ? 'pointer' : 'default', flex: '0 0 240px' }}>
                                    <div className="source-card-header">
                                      <span className="source-card-number">{i + 1}</span>
                                      <span className="source-card-title" style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {url ? <Globe size={12} style={{ flexShrink: 0 }}/> : <Folder size={12} style={{ flexShrink: 0 }}/>}
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                                        {url && <ExternalLink size={12} style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--accent-color)' }} />}
                                      </span>
                                    </div>
                                    <div className="source-card-snip">
                                      {src.content || src.page_content}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Footer actions and metrics */}
                        <div className="assistant-message-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.6rem', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.8rem' }}>
                            <button className="action-btn" onClick={() => copyToClipboard(msg.content, msg.id)} title="Copier la réponse">
                              {copiedId === msg.id ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier</>}
                            </button>
                            <button className="action-btn" onClick={() => downloadMarkdown(msg.content)} title="Télécharger en Markdown">
                              <Download size={14} /> Markdown
                            </button>
                          </div>

                          {msg.metrics && (
                            <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                              {typeof msg.metrics.duration === 'number' && (
                                <span>⚡ Vitesse: {msg.metrics.duration}s</span>
                              )}
                              <span>🔧 Corrections: {msg.metrics.corrections || 0}</span>
                              <span>🌐 Web: {msg.metrics.webUsed ? 'Oui' : 'Non'}</span>
                              {msg.metrics.cost !== undefined && (
                                <span style={{ color: 'var(--accent-color)' }}>💸 ${msg.metrics.cost.toFixed(5)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* SEARCH ROW (BOTTOM STICKY FOR ACTIVE CHAT, MIDDLE FOR HOME) */}
        <div className="search-header-row" style={{
          display: 'flex',
          gap: '1rem',
          width: messages.length > 0 ? (sidebarOpen ? 'min(900px, calc(100vw - 300px - 3rem))' : 'min(900px, calc(100vw - 3rem))') : '100%',
          maxWidth: '900px',
          margin: '0 auto',
          alignItems: 'center',
          justifyContent: 'center',
          position: messages.length > 0 ? 'fixed' : 'relative',
          bottom: messages.length > 0 ? '2rem' : 'auto',
          // Centre de la zone de contenu : la sidebar fait 300px de large
          left: messages.length > 0 ? (sidebarOpen ? 'calc(50% + 150px)' : '50%') : 'auto',
          transform: messages.length > 0 ? 'translateX(-50%)' : 'none',
          padding: messages.length > 0 ? '1rem 2rem' : '0',
          background: messages.length > 0 ? `rgba(${bgRGB}, 0.8)` : 'transparent',
          backdropFilter: messages.length > 0 ? 'blur(10px)' : 'none',
          boxShadow: messages.length > 0 ? '0 -20px 40px var(--bg-color)' : 'none',
          zIndex: 100,
          transition: 'all 0.3s ease'
        }}>
          <div className={`search-container ${isSearchFocused ? 'focused' : ''}`} style={{ zIndex: 10, flex: 1, margin: 0, maxWidth: messages.length > 0 ? '100%' : '680px' }}>
            <div className="search-input-wrapper">
              <input 
                type="file" 
                accept=".pdf,.txt,.docx,.xlsx,.pptx" 
                onChange={handleFileUpload} 
                ref={fileInputRef}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload" className={`search-attach-btn ${uploading ? 'uploading' : ''}`} title="Ajouter un document">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={18} strokeWidth={2.5} />}
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                ref={imageInputRef}
                style={{ display: 'none' }}
                id="image-upload"
              />
              <label htmlFor="image-upload" className="search-attach-btn" title="Ajouter une image">
                <ImageIcon size={18} strokeWidth={2.5} />
              </label>
              <input
                type="text"
                className="main-search-input"
                placeholder={messages.length > 0 ? "Poser une question de suivi..." : "Que souhaitez-vous savoir ?"}
                value={query}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
              />
              {selectedImage && (
                <div style={{ position: 'absolute', bottom: '120%', left: '1rem', background: 'var(--glass-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', zIndex: 10 }}>
                  <img src={selectedImage} alt="Preview" style={{ height: '40px', borderRadius: '4px' }} />
                  <button onClick={() => setSelectedImage(null)} style={{ background: 'var(--accent-color)', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                    <X size={12} />
                  </button>
                </div>
              )}
              <button onClick={() => handleSearch(query)} className="search-submit-btn" disabled={loading} title="Lancer l'analyse">
                <Search size={18} strokeWidth={2.5} />
              </button>
              {uploadMessage && (
                <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-color)', fontFamily: "'JetBrains Mono', monospace", zIndex: 5 }}>
                  {uploadMessage}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HOME MODE CONTROLS & WELCOME CARDS (ONLY ON ROOT SCREEN) */}
        {messages.length === 0 && (
          <div style={{ width: '100%', maxWidth: '680px', margin: '1.5rem auto 0' }}>
            <div className="mode-segmented-control">
              <button className={`mode-btn ${mode === 'hybrid' ? 'active' : ''}`} onClick={() => setMode('hybrid')}>
                <Sparkles size={16} />
                Hybride
              </button>
              <button className={`mode-btn ${mode === 'web' ? 'active' : ''}`} onClick={() => setMode('web')}>
                <Globe size={16} />
                Web
              </button>
              <button className={`mode-btn ${mode === 'local' ? 'active' : ''}`} onClick={() => setMode('local')}>
                <Folder size={16} />
                Local
              </button>
            </div>
            
            <div className="welcome-grid">
              <div className="welcome-card" onClick={() => handleSearch("Explique le concept d'Agentic RAG")}>
                <Cpu size={24} />
                <div className="welcome-card-title">Agentic RAG</div>
                <div className="welcome-card-subtitle">Comprendre l'architecture et ses avantages</div>
              </div>
              <div className="welcome-card" onClick={() => handleSearch("Quelles sont les dernières actus IA ?")}>
                <Globe size={24} />
                <div className="welcome-card-title">Actualités IA</div>
                <div className="welcome-card-subtitle">Les dernières avancées du secteur</div>
              </div>
              <div className="welcome-card" onClick={() => handleSearch("Résume les informations clés du manuel")}>
                <BookOpen size={24} />
                <div className="welcome-card-title">Résumé Local</div>
                <div className="welcome-card-subtitle">Synthèse de votre base documentaire</div>
              </div>
            </div>
            
            <div className="suggestions-container" style={{ marginTop: '4rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.2rem', textTransform: 'uppercase', letterSpacing: '1.5px', opacity: 0.6 }}>
                Recherches suggérées
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
          <div className="app-footer" style={{ marginTop: '4rem', marginBottom: '2rem', width: '100%', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', opacity: 0.4, letterSpacing: '1px' }}>
            Propulsé par Agentic RAG • v3.1
          </div>
        )}

      </div>
    </div>
  );
}
