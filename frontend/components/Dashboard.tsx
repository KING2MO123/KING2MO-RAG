import React from 'react';
import { BarChart2, X } from 'lucide-react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, AreaChart, Area } from 'recharts';

export interface CostHistoryEntry {
  time: string;
  cost: number;
  model: string;
  inTokens: number;
  outTokens: number;
}

interface DashboardProps {
  showDashboard: boolean;
  setShowDashboard: (val: boolean) => void;
  sidebarOpen: boolean;
  bgRGB: string;
  dashboardOpacity: number;
  setDashboardOpacity: (val: number) => void;
  totalCost: number;
  costHistory: CostHistoryEntry[];
}

export default function Dashboard({
  showDashboard,
  setShowDashboard,
  sidebarOpen,
  bgRGB,
  dashboardOpacity,
  setDashboardOpacity,
  totalCost,
  costHistory
}: DashboardProps) {
  if (!showDashboard) return null;

  return (
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
                      <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toString()} />
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
  );
}
