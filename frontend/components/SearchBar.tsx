import React from "react";
import { Loader2, Paperclip, Image as ImageIcon, X, Square, Search } from "lucide-react";
import { t } from "@/lib/i18n";

interface SearchBarProps {
  lang: string;
  messagesLength: number;
  sidebarOpen: boolean;
  bgRGB: string;
  query: string;
  setQuery: (v: string) => void;
  onSearch: (q: string) => void;
  loading: boolean;
  onStop: () => void;
  uploading: boolean;
  uploadMessage: string | null;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (v: boolean) => void;
}

export default function SearchBar({
  lang,
  messagesLength,
  sidebarOpen,
  bgRGB,
  query,
  setQuery,
  onSearch,
  loading,
  onStop,
  uploading,
  uploadMessage,
  onFileUpload,
  onImageUpload,
  fileInputRef,
  imageInputRef,
  selectedImage,
  setSelectedImage,
  isSearchFocused,
  setIsSearchFocused,
}: SearchBarProps) {
  return (
    <div className="search-header-row" style={{
      display: 'flex',
      gap: '1rem',
      width: messagesLength > 0 ? (sidebarOpen ? 'min(900px, calc(100vw - 300px - 3rem))' : 'min(900px, calc(100vw - 3rem))') : '100%',
      maxWidth: '900px',
      margin: '0 auto',
      alignItems: 'center',
      justifyContent: 'center',
      position: messagesLength > 0 ? 'fixed' : 'relative',
      bottom: messagesLength > 0 ? '2rem' : 'auto',
      left: messagesLength > 0 ? (sidebarOpen ? 'calc(50% + 150px)' : '50%') : 'auto',
      transform: messagesLength > 0 ? 'translateX(-50%)' : 'none',
      padding: messagesLength > 0 ? '1rem 2rem' : '0',
      background: messagesLength > 0 ? `rgba(${bgRGB}, 0.8)` : 'transparent',
      backdropFilter: messagesLength > 0 ? 'blur(10px)' : 'none',
      boxShadow: messagesLength > 0 ? '0 -20px 40px var(--bg-color)' : 'none',
      zIndex: 100,
      transition: 'all 0.3s ease'
    }}>
      <div className={`search-container ${isSearchFocused ? 'focused' : ''}`} style={{ zIndex: 10, flex: 1, margin: 0, maxWidth: messagesLength > 0 ? '100%' : '680px' }}>
        <div className="search-input-wrapper">
          <input 
            type="file" 
            accept=".pdf,.txt,.docx,.xlsx,.pptx" 
            onChange={onFileUpload} 
            ref={fileInputRef}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload" className={`search-attach-btn ${uploading ? 'uploading' : ''}`} aria-label="Ajouter un document" title="Ajouter un document">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={18} strokeWidth={2.5} />}
          </label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={onImageUpload} 
            ref={imageInputRef}
            style={{ display: 'none' }}
            id="image-upload"
          />
          <label htmlFor="image-upload" className="search-attach-btn" aria-label="Ajouter une image" title="Ajouter une image">
            <ImageIcon size={18} strokeWidth={2.5} />
          </label>
          <textarea
            className="main-search-input"
            placeholder={messagesLength > 0 ? t(lang, 'followup_placeholder') : t(lang, 'ask_placeholder')}
            value={query}
            rows={1}
            style={{ resize: "none", overflow: "hidden", minHeight: "24px", paddingTop: "12px" }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onChange={(e) => {
                setQuery(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                if (e.target.value === "") e.target.style.height = 'auto';
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSearch(query);
                }
            }}
          />
          {selectedImage && (
            <div style={{ position: 'absolute', bottom: '120%', left: '1rem', background: 'var(--glass-bg)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', zIndex: 10 }}>
              <img src={selectedImage} alt="Preview" style={{ height: '40px', borderRadius: '4px' }} />
              <button onClick={() => setSelectedImage(null)} style={{ background: 'var(--accent-color)', border: 'none', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <X size={12} />
              </button>
            </div>
          )}
          {loading ? (
            <button onClick={onStop} className="search-submit-btn" aria-label="Arrêter la génération" style={{ background: 'rgba(255, 50, 50, 0.2)', color: '#ff4444' }} title="Arrêter la génération">
              <Square size={16} strokeWidth={3} fill="currentColor" />
            </button>
          ) : (
            <button onClick={() => onSearch(query)} className="search-submit-btn" aria-label="Lancer l'analyse" disabled={!query.trim()} title="Lancer l'analyse">
              <Search size={18} strokeWidth={2.5} />
            </button>
          )}
          {uploadMessage && (
            <div style={{ position: 'absolute', top: '100%', left: 0, width: '100%', textAlign: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-color)', fontFamily: "'JetBrains Mono', monospace", zIndex: 5 }}>
              {uploadMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
