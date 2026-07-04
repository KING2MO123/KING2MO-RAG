"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Sparkles, Sidebar as SidebarIcon, Key, Link2, BookOpen, Clock, Copy, Check, Download, Book, X, Cpu, Globe, Folder, Eye, EyeOff, Paperclip } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
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
  
  const [geminiKey, setGeminiKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
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

  const [showKeys, setShowKeys] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le dernier message (nouvelle question ou réponse reçue)
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  // Load history & keys on mount
  useEffect(() => {
    const savedGemini = localStorage.getItem("gemini_key");
    const savedTavily = localStorage.getItem("tavily_key");
    if (savedGemini) setGeminiKey(savedGemini);
    if (savedTavily) setTavilyKey(savedTavily);

    const savedHistory = localStorage.getItem("rag_history");
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

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
    
    // 2. Add Assistant Loading Message
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
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: newQuery, gemini_key: geminiKey, tavily_key: tavilyKey, mode }),
      });

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
                  setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
                    ...m, 
                    content: data.generation,
                    sources: data.sources || [],
                    metrics: { corrections: data.corrections, duration: data.duration, webUsed: data.web_used },
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
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { 
        ...m, 
        content: "❌ Erreur de connexion au serveur Backend.", 
        loading: false, 
        status: null 
      } : m));
      setLoading(false);
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
      const response = await fetch("http://localhost:8000/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.status === "success") {
        setUploadMessage(`✅ ${data.message}`);
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
          <div className="sb-section-title">AUTHENTIFICATION API</div>
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Gemini API Key</label>
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-color)', opacity: geminiKey ? 1 : 0, transition: 'opacity 0.3s' }}>✓ Auto-sauvegardé</span>
            </div>
            <div style={{ position: 'relative' }}>
              <input type={showKeys ? "text" : "password"} className="sidebar-input" placeholder="Clé Gemini..." value={geminiKey} onChange={(e) => { setGeminiKey(e.target.value); localStorage.setItem('gemini_key', e.target.value); }} style={{ paddingRight: '2.5rem' }} />
              <button onClick={() => setShowKeys(!showKeys)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Tavily API Key</label>
              <span style={{ fontSize: '0.65rem', color: 'var(--accent-color)', opacity: tavilyKey ? 1 : 0, transition: 'opacity 0.3s' }}>✓ Auto-sauvegardé</span>
            </div>
            <div style={{ position: 'relative' }}>
              <input type={showKeys ? "text" : "password"} className="sidebar-input" placeholder="Clé Tavily..." value={tavilyKey} onChange={(e) => { setTavilyKey(e.target.value); localStorage.setItem('tavily_key', e.target.value); }} style={{ paddingRight: '2.5rem' }} />
              <button onClick={() => setShowKeys(!showKeys)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}>
                {showKeys ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="history-section">
            <div className="sb-section-title">HISTORIQUE RÉCENT</div>
            <div className="history-list">
              {history.map((h, i) => (
                <div key={i} className="history-item" onClick={() => handleSearch(h)}>
                  <Clock size={14} />
                  <span>{h.length > 25 ? h.substring(0, 25) + '...' : h}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content" style={{ paddingLeft: sidebarOpen ? "2rem" : "5rem", display: 'flex', flexDirection: 'column' }}>
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
                              code({node, inline, className, children, ...props}: any) {
                                const match = /language-(\w+)/.exec(className || '')
                                return !inline && match ? (
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
                                      <span className="source-card-title">
                                        {url ? <Globe size={12}/> : <Folder size={12}/>}
                                        {label}
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
          background: messages.length > 0 ? 'var(--bg-color)' : 'transparent',
          boxShadow: messages.length > 0 ? '0 -20px 40px var(--bg-color)' : 'none',
          zIndex: 100,
          transition: 'all 0.3s ease'
        }}>
          <div className={`search-container ${isSearchFocused ? 'focused' : ''}`} style={{ zIndex: 10, flex: 1, margin: 0, maxWidth: messages.length > 0 ? '100%' : '680px' }}>
            <div className="search-input-wrapper">
              <input 
                type="file" 
                accept=".pdf" 
                onChange={handleFileUpload} 
                ref={fileInputRef}
                style={{ display: 'none' }}
                id="file-upload"
              />
              <label htmlFor="file-upload" className={`search-attach-btn ${uploading ? 'uploading' : ''}`} title="Ajouter un PDF local">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={18} strokeWidth={2.5} />}
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
              <div className="suggestions-flex" style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '800px', margin: '0 auto' }}>
                <button className="suggestion-pill" onClick={() => handleSearch("Comment optimiser un système RAG ?")}>
                  <Sparkles size={14} /> Comment optimiser un système RAG ?
                </button>
                <button className="suggestion-pill" onClick={() => handleSearch("Tendances de l'IA générative en 2026")}>
                  <Globe size={14} /> Tendances de l'IA générative en 2026
                </button>
                <button className="suggestion-pill" onClick={() => handleSearch("Exemple de Prompt Engineering avancé")}>
                  <Book size={14} /> Exemple de Prompt Engineering avancé
                </button>
                <button className="suggestion-pill" onClick={() => handleSearch("Sécurité et confidentialité des LLMs")}>
                  <Key size={14} /> Sécurité et confidentialité des LLMs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER (ONLY ON ROOT SCREEN) */}
        {messages.length === 0 && (
          <div className="app-footer" style={{ position: 'absolute', bottom: '2rem', left: '0', width: '100%', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', opacity: 0.4, letterSpacing: '1px' }}>
            Propulsé par Agentic RAG • v2.0
          </div>
        )}

      </div>
    </div>
  );
}
