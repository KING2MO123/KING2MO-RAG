import React from "react";
import { Sidebar as SidebarIcon, Key, BookOpen, Clock, Book, X, Pencil } from "lucide-react";
import { t } from "@/lib/i18n";

interface SidebarProps {
  lang: string;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  conversations: any[];
  currentConvId: string | null;
  editingConvId: string | null;
  editingTitle: string;
  setEditingTitle: (v: string) => void;
  setEditingConvId: (v: string | null) => void;
  onNewConversation: () => void;
  onLoadConversation: (id: string) => void;
  onStartRenaming: (id: string, title: string) => void;
  onCommitRename: () => void;
  onDeleteConversation: (id: string) => void;
  onReset: () => void;
  onOpenSettings: () => void;
  history: string[];
  isEditingHistory: boolean;
  setIsEditingHistory: (v: boolean) => void;
  selectedHistory: string[];
  onToggleHistorySelection: (h: string) => void;
  onSearch: (q: string) => void;
  onDeleteSelectedHistory: () => void;
  onClearAllHistory: () => void;
  documents: string[];
  isEditingDocs: boolean;
  setIsEditingDocs: (v: boolean) => void;
  selectedDocs: string[];
  isClearing: boolean;
  onToggleDocSelection: (d: string) => void;
  onDeleteDocument: (name: string) => void;
  onDeleteSelectedDocs: () => void;
  onClearDocuments: () => void;
}

export default function Sidebar({
  lang,
  sidebarOpen,
  setSidebarOpen,
  conversations,
  currentConvId,
  editingConvId,
  editingTitle,
  setEditingTitle,
  setEditingConvId,
  onNewConversation,
  onLoadConversation,
  onStartRenaming,
  onCommitRename,
  onDeleteConversation,
  onReset,
  onOpenSettings,
  history,
  isEditingHistory,
  setIsEditingHistory,
  selectedHistory,
  onToggleHistorySelection,
  onSearch,
  onDeleteSelectedHistory,
  onClearAllHistory,
  documents,
  isEditingDocs,
  setIsEditingDocs,
  selectedDocs,
  isClearing,
  onToggleDocSelection,
  onDeleteDocument,
  onDeleteSelectedDocs,
  onClearDocuments,
}: SidebarProps) {
  return (
    <div className={`sidebar ${!sidebarOpen ? "collapsed" : ""}`}>
      <button className="sidebar-toggle-btn" aria-label={sidebarOpen ? "Réduire la barre latérale" : "Ouvrir la barre latérale"} title="Barre latérale" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
        <SidebarIcon size={20} />
      </button>

      <div className="sb-brand" onClick={onReset} style={{ cursor: 'pointer' }}>KING2MO</div>
      
      <div style={{ marginTop: '1.5rem', padding: '0 0.5rem' }}>
        <button
          onClick={onOpenSettings}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', fontSize: '0.8rem', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
        >
          <Key size={14} /> {t(lang, 'settings')}
        </button>
      </div>

      <div className="history-section" style={{ marginTop: '1.5rem' }}>
        <div className="sb-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t(lang, 'conversations')}</span>
          <button
            onClick={onNewConversation}
            title={t(lang, 'new')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.65rem', cursor: 'pointer', opacity: 0.9 }}
          >
            {t(lang, 'new')}
          </button>
        </div>
        <div className="history-list">
          {conversations.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.6rem 0' }}>{t(lang, 'no_convos')}</div>
          ) : (
            conversations.map((c: any) => (
              <div key={c.id} className="history-item" onClick={() => editingConvId === c.id ? null : onLoadConversation(c.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: c.id === currentConvId ? 'var(--glass-bg)' : undefined }}>
                {editingConvId === c.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') setEditingConvId(null); }}
                    onBlur={onCommitRename}
                    className="sidebar-input"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '0.2rem 0.4rem' }}
                    maxLength={200}
                  />
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <BookOpen size={14} style={{ flexShrink: 0 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}>{c.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <button
                        aria-label={t(lang, 'rename')}
                        onClick={(e) => { e.stopPropagation(); onStartRenaming(c.id, c.title); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                        title={t(lang, 'rename')}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        aria-label={t(lang, 'delete')}
                        onClick={(e) => { e.stopPropagation(); onDeleteConversation(c.id); }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                        title={t(lang, 'delete')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
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
              <div key={i} className="history-item" onClick={() => isEditingHistory ? onToggleHistorySelection(h) : onSearch(h)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                onClick={onDeleteSelectedHistory}
                disabled={selectedHistory.length === 0}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: selectedHistory.length > 0 ? '#ef4444' : 'var(--text-secondary)', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: selectedHistory.length > 0 ? 'pointer' : 'not-allowed' }}
              >
                Supprimer
              </button>
              <button 
                onClick={onClearAllHistory}
                style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: '#ef4444', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer' }}
              >
                Tout vider
              </button>
            </div>
          )}
        </div>
      )}

      <div className="history-section" style={{ marginTop: '2rem' }}>
        <div className="sb-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t(lang, 'knowledge_base')}</span>
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>{t(lang, 'no_docs')}</div>
          ) : (
            documents.map((doc, i) => (
              <div key={i} className="history-item" onClick={() => isEditingDocs ? onToggleDocSelection(doc) : null} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: isEditingDocs ? 'pointer' : 'default' }}>
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
                    onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc); }} 
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
              onClick={onDeleteSelectedDocs}
              disabled={selectedDocs.length === 0 || isClearing}
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: selectedDocs.length > 0 ? '#ef4444' : 'var(--text-secondary)', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: selectedDocs.length > 0 ? 'pointer' : 'not-allowed' }}
            >
              {isClearing ? 'En cours...' : 'Supprimer'}
            </button>
            <button 
              onClick={onClearDocuments}
              disabled={isClearing}
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', background: 'var(--glass-bg)', color: '#ef4444', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer' }}
            >
              Tout vider
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
