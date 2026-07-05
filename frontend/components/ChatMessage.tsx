import React from 'react';
import { Pencil, Loader2, Link2, Globe, Folder, ExternalLink, Check, Copy, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { t } from '@/lib/i18n';

interface ChatMessageProps {
  msg: any;
  idx: number;
  loading: boolean;
  lang: string;
  copiedId: string | null;
  messagesLength: number;
  editUserMessage: (id: string) => void;
  setSelectedSource: (source: any) => void;
  copyToClipboard: (text: string, id: string) => void;
  downloadMarkdown: (text: string) => void;
  regenerateLast: () => void;
}

export default function ChatMessage({
  msg,
  idx,
  loading,
  lang,
  copiedId,
  messagesLength,
  editUserMessage,
  setSelectedSource,
  copyToClipboard,
  downloadMarkdown,
  regenerateLast
}: ChatMessageProps) {
  return (
    <div className={`chat-message-row ${msg.role}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: (msg.role === 'user' && idx > 0) ? '1.25rem' : '0' }}>
      
      {/* User Message Rendering (bulle de chat) */}
      {msg.role === 'user' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.4rem' }}>
          {/* (R-10) Éditer et renvoyer cette question */}
          {!loading && (
            <button
              onClick={() => editUserMessage(msg.id)}
              aria-label={t(lang, 'edit')}
              title={t(lang, 'edit')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', opacity: 0.6 }}
            >
              <Pencil size={13} />
            </button>
          )}
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
                <span>{msg.status || t(lang, 'analyzing')}</span>
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
                    <Link2 size={12} /> {t(lang, 'sources')} ({msg.sources.length})
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
                        <div key={i} className="source-card-compact" onClick={() => setSelectedSource(src)} title={url || rawSource} style={{ cursor: 'pointer', flex: '0 0 240px' }}>
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
                  <button className="action-btn" onClick={() => copyToClipboard(msg.content, msg.id)} title={t(lang, 'copy')}>
                    {copiedId === msg.id ? <><Check size={14} /> {t(lang, 'copied')}</> : <><Copy size={14} /> {t(lang, 'copy')}</>}
                  </button>
                  <button className="action-btn" onClick={() => downloadMarkdown(msg.content)} title="Markdown">
                    <Download size={14} /> Markdown
                  </button>
                  {/* (R-10) Régénérer : seulement sur le dernier message assistant */}
                  {!loading && idx === messagesLength - 1 && (
                    <button className="action-btn" onClick={regenerateLast} title={t(lang, 'regenerate')}>
                      <Loader2 size={14} /> {t(lang, 'regenerate')}
                    </button>
                  )}
                </div>

                {msg.metrics && (
                  <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                    {typeof msg.metrics.duration === 'number' && (
                      <span>⚡ {t(lang, 'speed')}: {msg.metrics.duration}s</span>
                    )}
                    <span>🔧 {t(lang, 'corrections')}: {msg.metrics.corrections || 0}</span>
                    <span>🌐 {t(lang, 'web')}: {msg.metrics.webUsed ? t(lang, 'yes') : t(lang, 'no')}</span>
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
  );
}
