"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2, Sparkles, Sidebar as SidebarIcon, Moon, Sun, Key, Link2, BookOpen, Clock, Copy, Download, Book, FileText, X, ExternalLink, Cpu, Globe, Folder, Eye, EyeOff, Paperclip } from "lucide-react";
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
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
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
  const [showSources, setShowSources] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

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
    if (!searchQuery) return;
    if (!geminiKey) {
      alert("⚠️ Veuillez configurer votre clé API Gemini dans la barre latérale.");
      return;
    }

    const newQuery = searchQuery;
    setQuery("");
    saveToHistory(newQuery);
    
    setResult(null);
    setSources([]);
    setMetrics(null);
    setLoading(true);
    setStatus("Initialisation...");
    setShowSources(true);

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

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                if (data.type === "status") {
                  setStatus(`TRAITEMENT : ${data.node.toUpperCase()}`);
                } else if (data.type === "result") {
                  setResult(data.generation);
                  setSources(data.sources);
                  setMetrics({ corrections: data.corrections });
                  setStatus(null);
                  setLoading(false);
                } else if (data.type === "error") {
                  setStatus(`ERREUR : ${data.message}`);
                  setLoading(false);
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch (error) {
      setStatus(`Erreur de connexion au serveur Backend.`);
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (text) {
      navigator.clipboard.writeText(text);
      alert("Copié dans le presse-papiers !");
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
      <div className="ambient-glow"></div>
      <div className={`search-dim-overlay ${isSearchFocused ? 'active' : ''}`}></div>

      {/* SIDEBAR */}
      <div className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
        <div className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <SidebarIcon size={20} />
        </div>

        <div className="sb-brand">KING2MO</div>
        
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
        {(!result && !loading) && (
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

        {(!result && !loading) && (
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

        <div className={`search-container ${isSearchFocused ? 'focused' : ''}`} style={{ zIndex: 10, marginTop: (!result && !loading) ? '1rem' : '0' }}>
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
              placeholder="Que souhaitez-vous savoir ?"
              value={query}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            />
            <button onClick={() => handleSearch(query)} className="search-submit-btn" disabled={loading} title="Lancer l'analyse">
              <Search size={18} strokeWidth={2.5} />
            </button>
          </div>
          {uploadMessage && (
            <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-color)', fontFamily: "'JetBrains Mono', monospace" }}>
              {uploadMessage}
            </div>
          )}
          
          {!loading && !result && (
            <>
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
            </>
          )}
        </div>

        {!result && !loading && (
          <div className="app-footer" style={{ position: 'absolute', bottom: '2rem', left: '0', width: '100%', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', opacity: 0.4, letterSpacing: '1px' }}>
            Propulsé par Agentic RAG • v2.0
          </div>
        )}

        {(result || loading) && (
          <div className="result-area" style={{ padding: '2rem 0' }}>
            {result && (
              <div className="result-card">
                <div className="result-actions">
                  {sources.length > 0 && (
                    <button className={`action-btn ${showSources ? 'active' : ''}`} onClick={() => setShowSources(!showSources)} title="Afficher/Cacher les sources">
                      {showSources ? <EyeOff size={14}/> : <Eye size={14}/>} Sources
                    </button>
                  )}
                  <button className="action-btn" onClick={() => copyToClipboard(result)} title="Copier la réponse">
                    <Copy size={14} /> Copier
                  </button>
                  <button className="action-btn" onClick={() => downloadMarkdown(result)} title="Télécharger en Markdown">
                    <Download size={14} /> Markdown
                  </button>
                </div>

                {metrics && (
                  <div className="metrics-row">
                    <div className="metric-badge">
                      <Cpu size={14} /> Cycles de correction: {metrics.corrections || 0}
                    </div>
                  </div>
                )}
                
                <div className="result-body">
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
                    {result}
                  </ReactMarkdown>
                </div>

                {showSources && sources.length > 0 && (
                  <div className="sources-horizontal-container">
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontFamily: "'Outfit', sans-serif" }}>
                      <Link2 size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }}/>
                      Sources utilisées
                    </h3>
                    <div className="sources-horizontal-scroll">
                      {sources.map((src, i) => (
                        <div key={i} className="source-card-compact" onClick={() => src.metadata?.url && window.open(src.metadata.url, "_blank")}>
                          <div className="source-card-header">
                            <span className="source-card-number">{i + 1}</span>
                            <span className="source-card-title">
                              {src.metadata?.url ? <Globe size={12}/> : <Folder size={12}/>}
                              {src.metadata?.source || "Document Local"}
                            </span>
                            {src.metadata?.url && <ExternalLink size={12} style={{ opacity: 0.5 }}/>}
                          </div>
                          <div className="source-card-snip">
                            {src.page_content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SKELETON LOADER */}
            {loading && (
              <div className="skeleton-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: 'var(--accent-color)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{status || "ANALYSE EN COURS..."}</span>
                </div>
                <div className="skeleton-line title"></div>
                <div className="skeleton-line full"></div>
                <div className="skeleton-line full"></div>
                <div className="skeleton-line medium"></div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
