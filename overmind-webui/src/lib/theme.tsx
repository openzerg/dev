import { createContext, useContext, createSignal, createMemo, type JSX, onMount } from 'solid-js';
import { ThemeProvider, CssBaseline } from '@suid/material';
import { createTheme } from '@suid/material/styles';

export type ColorScheme = 'purple' | 'blue' | 'green' | 'orange' | 'rose';
export type ThemeMode = 'dark' | 'light';

interface SchemeColors {
  primary: { dark: string; light: string; contrastDark?: string };
  secondary: { dark: string; light: string };
}

const schemes: Record<ColorScheme, SchemeColors> = {
  purple: {
    primary: { dark: '#d0bcff', light: '#6750a4', contrastDark: '#381e72' },
    secondary: { dark: '#ccc2dc', light: '#625b71' },
  },
  blue: {
    primary: { dark: '#a8c7fa', light: '#0b57d0', contrastDark: '#062e6f' },
    secondary: { dark: '#c2e7ff', light: '#00639e' },
  },
  green: {
    primary: { dark: '#7dd07d', light: '#386a20', contrastDark: '#0f3900' },
    secondary: { dark: '#bdc8bc', light: '#4f6352' },
  },
  orange: {
    primary: { dark: '#ffbd80', light: '#954100', contrastDark: '#4a1e00' },
    secondary: { dark: '#e8cfc0', light: '#755745' },
  },
  rose: {
    primary: { dark: '#f2b8b5', light: '#b3261e', contrastDark: '#601410' },
    secondary: { dark: '#e8bdc0', light: '#7c4f52' },
  },
};

export const schemeLabels: Record<ColorScheme, string> = {
  purple: 'Purple',
  blue: 'Blue',
  green: 'Green',
  orange: 'Orange',
  rose: 'Rose',
};

export const schemeColors: Record<ColorScheme, string> = {
  purple: '#d0bcff',
  blue: '#a8c7fa',
  green: '#7dd07d',
  orange: '#ffbd80',
  rose: '#f2b8b5',
};

function buildTheme(mode: ThemeMode, scheme: ColorScheme) {
  const isDark = mode === 'dark';
  const s = schemes[scheme];
  return createTheme({
    palette: {
      mode,
      primary: { main: isDark ? s.primary.dark : s.primary.light, contrastText: isDark ? (s.primary.contrastDark ?? '#111') : '#fff' },
      secondary: { main: isDark ? s.secondary.dark : s.secondary.light },
      background: { default: isDark ? '#141218' : '#fef7ff', paper: isDark ? '#1d1b20' : '#fffbfe' },
      error: { main: isDark ? '#f2b8b5' : '#b3261e' },
      success: { main: isDark ? '#a8d5a2' : '#2e7d32' },
      text: { primary: isDark ? '#e6e0e9' : '#1d1b20', secondary: isDark ? '#cac4d0' : '#49454f' },
      divider: isDark ? '#49454f' : '#cac4d0',
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Roboto", "Segoe UI", system-ui, sans-serif',
      button: { textTransform: 'none' as const },
    },
  });
}

interface ThemeContextValue {
  mode: () => ThemeMode;
  scheme: () => ColorScheme;
  toggleTheme: () => void;
  setScheme: (s: ColorScheme) => void;
  isDark: () => boolean;
}

const ThemeContext = createContext<ThemeContextValue>();

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within AppThemeProvider');
  return ctx;
}

export function AppThemeProvider(props: { children: JSX.Element }) {
  const [mode, setMode] = createSignal<ThemeMode>('dark');
  const [scheme, setSchemeSignal] = createSignal<ColorScheme>('purple');

  onMount(() => {
    const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (savedMode === 'light' || savedMode === 'dark') setMode(savedMode);
    const savedScheme = localStorage.getItem('theme-scheme') as ColorScheme | null;
    if (savedScheme && schemes[savedScheme]) setSchemeSignal(savedScheme);
  });

  const toggleTheme = () => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  };

  const setScheme = (s: ColorScheme) => {
    setSchemeSignal(s);
    localStorage.setItem('theme-scheme', s);
  };

  const isDark = () => mode() === 'dark';

  const themeAccessor = () => buildTheme(mode(), scheme());

  return (
    <ThemeContext.Provider value={{ mode, scheme, toggleTheme, setScheme, isDark }}>
      <ThemeProvider theme={themeAccessor}>
        <CssBaseline />
        {props.children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
