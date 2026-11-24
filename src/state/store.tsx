import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { computeLedger, type LedgerSummary } from '../domain/ledger';
import type { AppState } from '../domain/types';
import { useToday } from '../hooks/useToday';
import { STORAGE_KEY, loadState, normalizeState, requestPersistence, saveState } from '../services/storage';
import { reducer, type Action } from './reducer';

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  ledger: LedgerSummary;
  today: string;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const today = useToday();
  const saveTimer = useRef<number>();
  const warned = useRef(false);

  // Kalıcılık: her değişiklikte (kısa gecikmeyle) localStorage'a yaz.
  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const res = saveState(state);
      if (!res.ok && !warned.current) {
        warned.current = true;
        alert(`Veriler kaydedilemedi: ${res.error}\nTarayıcı depolama alanı dolu veya gizli modda olabilirsiniz.`);
      }
    }, 150);
  }, [state]);

  // Sayfa kapanırken bekleyen kaydı hemen yaz.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const flush = () => saveState(stateRef.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  // Başka sekmede yapılan değişiklikleri al.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        dispatch({ type: 'state/replace', state: normalizeState(JSON.parse(e.newValue)) });
      } catch {
        /* yok say */
      }
    };
    window.addEventListener('storage', onStorage);
    requestPersistence();
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const ledger = useMemo(() => computeLedger(state, today), [state, today]);
  const value = useMemo(() => ({ state, dispatch, ledger, today }), [state, ledger, today]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore, StoreProvider içinde kullanılmalı');
  return ctx;
}
