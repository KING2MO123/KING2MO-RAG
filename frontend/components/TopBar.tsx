import React from "react";
import { Download, Cpu } from "lucide-react";

interface TopBarProps {
  lang: string;
  setLang: (v: string) => void;
  theme: string;
  toggleTheme: () => void;
  messagesLength: number;
  onExport: () => void;
  onOpenDashboard: () => void;
  totalCost: number;
  systemPassword: string;
}

export default function TopBar({
  lang,
  setLang,
  theme,
  toggleTheme,
  messagesLength,
  onExport,
  onOpenDashboard,
  totalCost,
  systemPassword
}: TopBarProps) {
  return (
    <div className="top-right-controls" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
      {messagesLength > 0 && (
        <button 
          onClick={onExport}
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
        onClick={onOpenDashboard}
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

      {/* Sélecteur de langue FR/EN */}
      <button
        onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
        aria-label="Langue / Language"
        title="Langue / Language"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '0.4rem 0.7rem', borderRadius: '20px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '1px' }}
      >
        {lang.toUpperCase()}
      </button>

      <div className="theme-switch-wrapper" style={{ margin: 0 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{theme === 'dark' ? 'DARK' : 'LIGHT'}</span>
        <label className="theme-switch">
          <input type="checkbox" aria-label="Basculer le thème clair/sombre" checked={theme === 'light'} onChange={toggleTheme} />
          <span className="slider"></span>
        </label>
      </div>
    </div>
  );
}
