import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

// ── Toast UI ──────────────────────────────────────────────────────
function ToastItem({ message, type, removing }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px 18px',
      background: 'var(--surface)',
      border: `1px solid ${type === 'error' ? '#6e2a2a' : type === 'success' ? '#3f5235' : 'var(--border-light)'}`,
      borderLeft: `3px solid ${type === 'error' ? '#9f5a5a' : type === 'success' ? '#6a9f5a' : 'var(--accent-dim)'}`,
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow)',
      fontFamily: 'var(--font-body)',
      fontSize: '0.88rem',
      color: 'var(--text)',
      minWidth: '220px',
      maxWidth: '340px',
      pointerEvents: 'none',
      // Slide in from right, fade out when removing
      animation: removing
        ? 'toast-out 0.25s ease-in forwards'
        : 'toast-in 0.25s ease-out forwards',
    }}>
      <span style={{
        fontSize: '0.75rem',
        color: type === 'error' ? '#9f5a5a' : type === 'success' ? '#6a9f5a' : 'var(--accent-dim)',
        flexShrink: 0,
      }}>
        {type === 'error' ? '✕' : type === 'success' ? '✓' : '◈'}
      </span>
      {message}
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, type = 'success', duration = 2500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, removing: false }]);

    // Begin fade-out slightly before removal
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, removing: true } : t))
      );
    }, duration);

    // Remove from DOM after animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration + 260);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Fixed toast stack — bottom right */}
      <div style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 9999,
        pointerEvents: 'none',
      }}>
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            message={t.message}
            type={t.type}
            removing={t.removing}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}