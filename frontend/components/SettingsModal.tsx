import React from 'react';
import { Key, X } from 'lucide-react';
import { t } from '@/lib/i18n';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (val: boolean) => void;
  lang: string;
  bgRGB: string;
  llmProvider: string;
  setLlmProvider: (val: string) => void;
  llmBaseUrl: string;
  setLlmBaseUrl: (val: string) => void;
  llmModel: string;
  setLlmModel: (val: string) => void;
  customInPrice: string;
  setCustomInPrice: (val: string) => void;
  customOutPrice: string;
  setCustomOutPrice: (val: string) => void;
  qualityMode: boolean;
  setQualityMode: (val: boolean) => void;
  scopedDocs: boolean;
  setScopedDocs: (val: boolean) => void;
  llmKey: string;
  setLlmKey: (val: string) => void;
  systemPassword: string;
  setSystemPassword: (val: string) => void;
  tavilyKey: string;
  setTavilyKey: (val: string) => void;
  hasTavilyKey: boolean;
  hasLlmKey: boolean;
  settingsMsg: string | null;
  saveSettings: () => void;
  savingSettings: boolean;
  deleteKey: (type: "llm" | "tavily") => void;
}

export default function SettingsModal({
  showSettings,
  setShowSettings,
  lang,
  bgRGB,
  llmProvider,
  setLlmProvider,
  llmBaseUrl,
  setLlmBaseUrl,
  llmModel,
  setLlmModel,
  customInPrice,
  setCustomInPrice,
  customOutPrice,
  setCustomOutPrice,
  qualityMode,
  setQualityMode,
  scopedDocs,
  setScopedDocs,
  llmKey,
  setLlmKey,
  systemPassword,
  setSystemPassword,
  tavilyKey,
  setTavilyKey,
  hasTavilyKey,
  hasLlmKey,
  settingsMsg,
  saveSettings,
  savingSettings,
  deleteKey
}: SettingsModalProps) {
  const [confirmDeleteLlm, setConfirmDeleteLlm] = React.useState(false);
  const [confirmDeleteTavily, setConfirmDeleteTavily] = React.useState(false);

  if (!showSettings) return null;

  return (
    <div onClick={() => setShowSettings(false)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '440px', background: `rgba(${bgRGB}, 0.98)`, border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Key size={18} /> {lang === 'en' ? 'Settings' : 'Paramètres'}</h2>
          <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div className="input-group" style={{ marginBottom: '1rem' }}>
          <label>{lang === 'en' ? 'AI provider' : 'Fournisseur IA'}</label>
          <select
            className="sidebar-input"
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="gemini">Google Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="ollama">Ollama (local, gratuit)</option>
            <option value="custom">Autre (API compatible OpenAI)</option>
          </select>
        </div>

        {llmProvider === "custom" && (
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label>URL de base de l'API</label>
              <input
                type="text"
                className="sidebar-input"
                placeholder="ex: https://api.openai.com/v1"
                value={llmBaseUrl}
                onChange={(e) => setLlmBaseUrl(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
        )}

        {(llmProvider === "custom" || llmProvider === "ollama" || llmProvider === "gemini" || llmProvider === "gemini-openai") && (
            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label>Nom du modèle</label>
              <input
                type="text"
                className="sidebar-input"
                placeholder={llmProvider.startsWith("gemini") ? "gemini-2.5-flash (défaut si vide)" : "ex: gpt-4o-mini, mistral-small-latest…"}
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
        )}

        {llmProvider === "custom" && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Prix entrée ($/1M)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="sidebar-input"
                  value={customInPrice}
                  onChange={(e) => setCustomInPrice(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Prix sortie ($/1M)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="sidebar-input"
                  value={customOutPrice}
                  onChange={(e) => setCustomOutPrice(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            id="quality-mode"
            checked={qualityMode}
            onChange={(e) => { setQualityMode(e.target.checked); localStorage.setItem("quality_mode", e.target.checked ? "1" : "0"); }}
            style={{ cursor: 'pointer', marginTop: '0.2rem' }}
          />
          <label htmlFor="quality-mode" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {lang === 'en' ? 'Quality mode: double-check answers (slower, costlier)' : 'Mode qualité : double vérification des réponses (plus lent, plus cher)'}
          </label>
        </div>

        {/* (R-13) Cloisonnement des documents par conversation */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            id="scoped-docs"
            checked={scopedDocs}
            onChange={(e) => { setScopedDocs(e.target.checked); localStorage.setItem("scoped_docs", e.target.checked ? "1" : "0"); }}
            style={{ cursor: 'pointer', marginTop: '0.2rem' }}
          />
          <label htmlFor="scoped-docs" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {lang === 'en'
              ? 'Scope documents to each conversation (experimental): uploads are tied to the open conversation; "global" documents stay visible everywhere.'
              : 'Cloisonner les documents par conversation (expérimental) : les ajouts sont réservés à la conversation ouverte ; les documents « globaux » restent visibles partout.'}
          </label>
        </div>

        <div className="input-group" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label style={{ marginBottom: 0 }}>{lang === 'en' ? 'Provider API key' : 'Clé API du fournisseur'}</label>
            {hasLlmKey && (
              confirmDeleteLlm ? (
                <div style={{ fontSize: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Confirmer ?</span>
                  <button onClick={() => { deleteKey("llm"); setConfirmDeleteLlm(false); }} style={{ background: 'var(--accent-color)', color: '#000', border: 'none', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }}>Oui</button>
                  <button onClick={() => setConfirmDeleteLlm(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }}>Non</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteLlm(true)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>🗑️ Supprimer</button>
              )
            )}
          </div>
          <input
            type="password"
            className="sidebar-input"
            placeholder="Colle ta clé ici (laisser vide = inchangée)"
            value={llmKey}
            onChange={(e) => setLlmKey(e.target.value)}
            style={{ width: '100%' }}
          />
          {(llmProvider === 'gemini' || llmProvider === 'gemini-openai') && llmKey.trim().startsWith('sk-') && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.4rem' }}>⚠️ Cette clé ressemble à une clé OpenAI/DeepSeek, pas Google.</div>
          )}
          {llmProvider === 'deepseek' && llmKey.trim().length > 0 && !llmKey.trim().startsWith('sk-') && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.4rem' }}>⚠️ Une clé DeepSeek doit commencer par "sk-".</div>
          )}
        </div>

        <div className="input-group" style={{ marginBottom: '1rem' }}>
          <label>{lang === 'en' ? 'Local system password' : 'Mot de passe du système local'}</label>
          <input
            type="password"
            className="sidebar-input"
            placeholder="Mot de passe du serveur..."
            value={systemPassword}
            onChange={(e) => { setSystemPassword(e.target.value); sessionStorage.setItem('backend_token', e.target.value); }}
            style={{ width: '100%' }}
          />
        </div>

        <div className="input-group" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label style={{ marginBottom: 0 }}>{lang === 'en' ? 'Tavily key (web search, optional)' : 'Clé Tavily (recherche web, optionnelle)'}</label>
            {hasTavilyKey && (
              confirmDeleteTavily ? (
                <div style={{ fontSize: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Confirmer ?</span>
                  <button onClick={() => { deleteKey("tavily"); setConfirmDeleteTavily(false); }} style={{ background: 'var(--accent-color)', color: '#000', border: 'none', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }}>Oui</button>
                  <button onClick={() => setConfirmDeleteTavily(false)} style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', padding: '0.1rem 0.4rem', borderRadius: '4px', cursor: 'pointer' }}>Non</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDeleteTavily(true)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>🗑️ Supprimer</button>
              )
            )}
          </div>
          <input
            type="password"
            className="sidebar-input"
            placeholder="tvly-... (laisser vide = inchangée)"
            value={tavilyKey}
            onChange={(e) => setTavilyKey(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {settingsMsg && (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>{settingsMsg}</div>
        )}

        <button
          onClick={saveSettings}
          disabled={savingSettings}
          style={{ width: '100%', padding: '0.6rem', background: 'var(--accent-color)', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: savingSettings ? 'wait' : 'pointer' }}
        >
          {savingSettings ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
