"use client";

import React, { useState, useEffect, useRef } from "react";

// The Particles component generates floating embers
const Particles = () => {
  const [embers, setEmbers] = useState<any[]>([]);

  useEffect(() => {
    const newEmbers = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100 + "%",
      animationDuration: Math.random() * 5 + 3 + "s", 
      animationDelay: Math.random() * 5 + "s",
    }));
    setEmbers(newEmbers);
  }, []);

  return (
    <div id="particles">
      {embers.map((ember) => (
        <div key={ember.id} className="ember" style={{ left: ember.left, animationDuration: ember.animationDuration, animationDelay: ember.animationDelay }}></div>
      ))}
    </div>
  );
};

export default function Home() {
  const [geminiKey, setGeminiKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
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

    setQuery(searchQuery);
    saveToHistory(searchQuery);
    setLoading(true);
    setStatus("Initialisation...");
    setResult(null);
    setShowSources(true);

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, gemini_key: geminiKey, tavily_key: tavilyKey, mode }),
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
                  setResult(data);
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

  const copyToClipboard = () => {
    if (result && result.generation) {
      navigator.clipboard.writeText(result.generation);
      alert("Copié dans le presse-papiers !");
    }
  };

  const downloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([`# Résultat pour : ${query}\n\nMode: ${mode}\n\n${result.generation}`], { type: 'text/markdown' });
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
      {/* SIDEBAR */}
      <div className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
        <div className="sidebar-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? (
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
          )}
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
                {showKeys ? <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg> : <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
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
                {showKeys ? <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg> : <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>}
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
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <span>{h.length > 25 ? h.substring(0, 25) + '...' : h}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content" style={{ paddingLeft: sidebarOpen ? "2rem" : "5rem" }}>
        <Particles />
        
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

        <div className="hero-wrapper" style={{ marginTop: result ? '2vh' : '10vh', transition: 'margin 0.5s ease' }}>
          <div className="hero-title-container">
            <h1 className="hero-title">KING2MO</h1>
            <span className="hero-badge">RAG</span>
          </div>
        </div>

        <div className="search-container" style={{ zIndex: 10 }}>
          <input
            type="text"
            className="main-search-input"
            placeholder="Que souhaitez-vous savoir ?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
          />
          
          <div className="mode-segmented-control">
            <button className={`mode-btn ${mode === 'hybrid' ? 'active' : ''}`} onClick={() => setMode('hybrid')}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              Hybride
            </button>
            <button className={`mode-btn ${mode === 'web' ? 'active' : ''}`} onClick={() => setMode('web')}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              Web
            </button>
            <button className={`mode-btn ${mode === 'local' ? 'active' : ''}`} onClick={() => setMode('local')}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Local
            </button>
          </div>
          
          {!result && !loading && (
            <div className="quick-actions">
              <div className="quick-action-chip" onClick={() => handleSearch("Explique le concept d'Agentic RAG")}>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>
                Explique l'Agentic RAG
              </div>
              <div className="quick-action-chip" onClick={() => handleSearch("Résume les informations clés du manuel")}>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Résume le manuel
              </div>
              <div className="quick-action-chip" onClick={() => handleSearch("Quelles sont les dernières actus IA ?")}>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                Actus IA Récentes
              </div>
            </div>
          )}
        </div>

        {/* Upload Zone */}
        {!result && (
          <div className="upload-zone-wrapper" style={{ zIndex: 10, marginTop: '2rem' }}>
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileUpload} 
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload" className={`upload-dropzone ${uploading ? 'uploading' : ''}`}>
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <span>{uploading ? "Analyse et vectorisation..." : "Glissez ou cliquez pour ajouter un PDF à la base locale"}</span>
            </label>
            {uploadMessage && (
              <div className="upload-message">{uploadMessage}</div>
            )}
          </div>
        )}

        <div className="run-btn-container" style={{ zIndex: 10 }}>
          <button className="main-btn" onClick={() => handleSearch(query)} disabled={loading}>
            {loading ? "ANALYSE EN COURS..." : "LANCER L'ANALYSE"}
          </button>
        </div>

        {/* STATUS LOADER */}
        {status && (
          <div style={{ marginTop: '1rem', zIndex: 10 }}>
            <div className="status-pill">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
              {status}
            </div>
          </div>
        )}

        {/* RESULTS CARD */}
        {result && (
          <div className="result-layout" style={{ zIndex: 10 }}>
            <div className="result-main">
              <div className="result-card" style={{ margin: 0 }}>
                <div className="result-actions">
                  {result.sources && result.sources.length > 0 && (
                    <button className={`action-btn ${showSources ? 'active' : ''}`} onClick={() => setShowSources(!showSources)} title="Afficher/Cacher les sources">
                      <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                      Sources
                    </button>
                  )}
                  <button className="action-btn" onClick={copyToClipboard} title="Copier le texte">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copier
                  </button>
                  <button className="action-btn" onClick={downloadMarkdown} title="Télécharger en Markdown">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Markdown
                  </button>
                </div>
                <div className="result-body">{result.generation}</div>
              </div>

              <div className="metrics-row">
                <div className="metric-widget">
                  <div className="metric-val">{result.corrections}</div>
                  <div className="metric-lbl">Cycles de Correction</div>
                </div>
                <div className="metric-widget">
                  <div className="metric-val">{result.sources?.length || 0}</div>
                  <div className="metric-lbl">Sources Validées</div>
                </div>
              </div>
            </div>

            {showSources && result.sources && result.sources.length > 0 && (
              <div className="sources-sidebar result-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                  <div className="sources-title" style={{ margin: 0, padding: 0 }}>SOURCES ({result.sources.length})</div>
                  <button onClick={() => setShowSources(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                <div className="sources-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {result.sources.map((src: any, idx: number) => {
                    const isUrl = src.source && src.source.startsWith("http");
                    const sourceName = src.source ? (isUrl ? new URL(src.source).hostname.replace('www.','') : src.source) : "Source";
                    return (
                      <div key={idx} className="source-item" style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <span className="source-tag" style={{ margin: 0 }}>{isUrl ? "WEB" : "LOCAL"}</span>
                          {isUrl ? <a href={src.source} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>{sourceName}</a> : <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>{sourceName}</span>}
                        </div>
                        <div className="source-snip" style={{ marginTop: 0 }}>{src.content}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
