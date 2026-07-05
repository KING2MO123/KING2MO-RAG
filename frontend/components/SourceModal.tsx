import React from 'react';
import { Globe, Folder, ExternalLink, X } from 'lucide-react';

interface SourceModalProps {
  selectedSource: any;
  setSelectedSource: (source: any | null) => void;
  bgRGB: string;
}

export default function SourceModal({ selectedSource, setSelectedSource, bgRGB }: SourceModalProps) {
  if (!selectedSource) return null;
  
  const src = selectedSource;
  const rawSource = String(src.source || src.metadata?.source || "");
  const url = src.url || src.metadata?.url || (rawSource.startsWith("http") ? rawSource : null);
  
  let label = "Document Local";
  if (rawSource && !rawSource.startsWith("http")) {
      label = rawSource.split(/[\\/]/).pop() || rawSource;
  } else if (url) {
      try { label = new URL(url).hostname.replace(/^www\./, ""); } catch { label = url; }
  }

  return (
    <div onClick={() => setSelectedSource(null)} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '750px', maxHeight: '85vh', background: `rgba(${bgRGB}, 0.98)`, border: '1px solid var(--glass-border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
                    {url ? <Globe size={18} style={{ flexShrink: 0 }} /> : <Folder size={18} style={{ flexShrink: 0 }} />} 
                    <span style={{ wordBreak: 'break-word', lineHeight: 1.3 }}>{label}</span>
                </h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
                    {url && (
                        <button onClick={() => window.open(url, "_blank")} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--accent-color)', color: '#000', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                            <ExternalLink size={14} /> Ouvrir
                        </button>
                    )}
                    <button onClick={() => setSelectedSource(null)} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={16} />
                    </button>
                </div>
            </div>
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {src.content || src.page_content || "Aucun texte extrait disponible."}
            </div>
        </div>
    </div>
  );
}
