"use client";

import React, { useEffect, useState } from 'react';

export default function TitleBar() {
  const [isPywebview, setIsPywebview] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check if pywebview is available (might take a moment to inject)
    const checkPywebview = () => {
      // @ts-ignore
      if (window.pywebview && window.pywebview.api) {
        setIsPywebview(true);
      }
    };
    checkPywebview();
    window.addEventListener('pywebviewready', checkPywebview);

    // Track window maximized state
    const handleResize = () => {
      if (window.outerWidth >= window.screen.availWidth - 10 && window.outerHeight >= window.screen.availHeight - 10) {
        setIsMaximized(true);
      } else {
        setIsMaximized(false);
      }
    };
    window.addEventListener('resize', handleResize);
    // Initial check
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('pywebviewready', checkPywebview);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!isPywebview) return null;

  return (
    <div style={{
      height: '32px',
      width: '100%',
      background: 'var(--bg-color)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      /* @ts-ignore */
      WebkitAppRegion: 'drag',
      userSelect: 'none',
      borderBottom: '1px solid var(--glass-border)',
      position: 'relative',
      zIndex: 9999,
      flexShrink: 0
    }}>
      <div style={{ paddingLeft: '14px', fontSize: '12px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: '2px' }}>
         <img src="/favicon.ico" alt="KING2MO Icon" style={{ width: '16px', height: '16px', transform: 'translateY(-3px)' }} />
         KING2MO
      </div>
      
      <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          aria-label="Réduire la fenêtre"
          title="Réduire"
          // @ts-ignore
          onClick={() => window.pywebview.api.minimize()}
          style={{ width: '46px', height: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,5 H10 V6 H0 Z" fill="currentColor"/></svg>
        </button>
        <button
          aria-label="Agrandir la fenêtre"
          title="Agrandir"
          // @ts-ignore
          onClick={() => window.pywebview.api.maximize()}
          style={{ width: '46px', height: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          onMouseOver={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2,2 H8 V8 H2 Z" stroke="currentColor" strokeWidth="1"/>
              <path d="M4,2 V1 H9 V6 H8" stroke="currentColor" strokeWidth="1"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1,1 H9 V9 H1 Z" stroke="currentColor" strokeWidth="1"/></svg>
          )}
        </button>
        <button
          aria-label="Fermer la fenêtre"
          title="Fermer"
          // @ts-ignore
          onClick={() => window.pywebview.api.close()}
          style={{ width: '46px', height: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
          onMouseOver={(e) => {e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = 'white'}}
          onMouseOut={(e) => {e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'}}
        >
           <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1,1 L9,9 M1,9 L9,1" stroke="currentColor" strokeWidth="1.5"/></svg>
        </button>
      </div>
    </div>
  );
}
