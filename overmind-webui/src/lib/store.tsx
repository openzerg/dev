import { createContext, useContext, createSignal, type JSX } from 'solid-js';
import type { BackendConfig } from './config';
import { initializeClients, resetClients, isInitialized } from './clients';

interface AppState {
  backend: () => BackendConfig | null;
  setBackend: (b: BackendConfig | null) => void;
  connected: () => boolean;
  initialized: () => boolean;
  setInitialized: (v: boolean) => void;
  connect: (b: BackendConfig) => void;
  disconnect: () => void;
}

const AppContext = createContext<AppState>();

export function OvermindProvider(props: { children: JSX.Element }) {
  const [backend, setBackend] = createSignal<BackendConfig | null>(null);
  const [initialized, setInitialized] = createSignal(false);

  const connect = (b: BackendConfig) => {
    initializeClients(b);
    setBackend(b);
    setInitialized(true);
  };

  const disconnect = () => {
    resetClients();
    setBackend(null);
    setInitialized(false);
  };

  const state: AppState = {
    backend,
    setBackend,
    connected: () => isInitialized(),
    initialized,
    setInitialized,
    connect,
    disconnect,
  };

  return <AppContext.Provider value={state}>{props.children}</AppContext.Provider>;
}

export function useStore(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useStore must be used within OvermindProvider');
  return ctx;
}
