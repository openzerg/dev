import { For, Show, createMemo, onMount, type JSX } from 'solid-js';
import { A, useLocation, useNavigate } from '@solidjs/router';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
} from '@suid/material';
import DarkModeOutlined from '@suid/icons-material/DarkModeOutlined';
import LightModeOutlined from '@suid/icons-material/LightModeOutlined';
import Translate from '@suid/icons-material/Translate';
import LogoutIcon from '@suid/icons-material/Logout';
import { useStore } from '~/lib/store';
import { getActiveBackend, removeBackend } from '~/lib/config';
import { initializeClients } from '~/lib/clients';
import { useThemeMode, type ColorScheme, schemeColors } from '~/lib/theme';
import { useI18n } from '~/i18n/context';

interface NavItem {
  path: string;
  labelKey: string;
  icon: string;
  exact?: boolean;
}

const navItems: NavItem[] = [
  { path: '/', labelKey: 'dashboard', icon: '📊', exact: true },
  { path: '/sessions', labelKey: 'sessions', icon: '💬' },
  { path: '/templates', labelKey: 'roles', icon: '📋' },
  { path: '/skills', labelKey: 'skills', icon: '🧩' },
  { path: '/instances', labelKey: 'instances', icon: '📡' },
  { path: '/workspaces', labelKey: 'workspaces', icon: '💾' },
  { path: '/providers', labelKey: 'providers', icon: '🔀' },
  { path: '/settings', labelKey: 'settings', icon: '⚙️' },
];

let _initialized = false;

export default function Layout(props: { children?: JSX.Element }) {
  const location = useLocation();
  const navigate = useNavigate();
  const store = useStore();
  const { toggleTheme, isDark, scheme, setScheme } = useThemeMode();
  const { t, locale, setLocale } = useI18n();

  const allSchemes: ColorScheme[] = ['purple', 'blue', 'green', 'orange', 'rose'];

  const activeKey = createMemo(() => {
    const path = location.pathname;
    for (let i = navItems.length - 1; i >= 0; i--) {
      const item = navItems[i];
      if (item.exact ? path === item.path : (path === item.path || path.startsWith(item.path + '/'))) {
        return item.labelKey;
      }
    }
    return 'dashboard';
  });

  const isConnectPage = () => location.pathname === '/connect';

  onMount(() => {
    if (_initialized) return;
    if (location.pathname === '/connect') return;
    const backend = getActiveBackend();
    if (!backend) { navigate('/connect'); return; }
    _initialized = true;
    store.setBackend(backend);
    try { initializeClients(backend); } catch (e) { console.error('Failed to initialize clients:', e); }
    store.setInitialized(true);
  });

  const navLabel = (key: string) => (t().nav as Record<string, string>)[key] ?? key;

  return (
    <Show when={!isConnectPage()} fallback={<>{props.children}</>}>
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Box sx={{ width: 240, minWidth: 240, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '1.1rem' }}>
              ◈ Overmind
            </Typography>
            <Show when={store.backend()}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {store.backend()?.label}
              </Typography>
            </Show>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
            <For each={navItems}>
              {(item) => {
                const active = createMemo(() => {
                  const path = location.pathname;
                  return item.exact ? path === item.path : (path === item.path || path.startsWith(item.path + '/'));
                });
                return (
                  <Box
                    component={A as any}
                    href={item.path}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5,
                      px: 2.5, py: 1.25, mx: 1, borderRadius: 2, textDecoration: 'none',
                      color: active() ? 'primary.contrastText' : 'text.primary',
                      bgcolor: active() ? 'primary.main' : 'transparent',
                      '&:hover': { bgcolor: active() ? 'primary.main' : 'action.hover' },
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <span style={{ 'font-size': '1.1rem', 'line-height': 1 }}>{item.icon}</span>
                    <Typography variant="body2" sx={{ fontWeight: active() ? 600 : 400 }}>
                      {navLabel(item.labelKey)}
                    </Typography>
                  </Box>
                );
              }}
            </For>
          </Box>

          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1, justifyContent: 'center' }}>
              <For each={allSchemes}>
                {(s) => (
                  <Box
                    onClick={() => setScheme(s)}
                    sx={{
                      width: 20, height: 20, borderRadius: '50%',
                      bgcolor: schemeColors[s],
                      border: scheme() === s ? '2px solid' : '2px solid transparent',
                      borderColor: scheme() === s ? 'text.primary' : 'transparent',
                      cursor: 'pointer',
                      '&:hover': { transform: 'scale(1.2)' },
                      transition: 'transform 0.15s, border-color 0.15s',
                    }}
                  />
                )}
              </For>
            </Box>
            <Box sx={{ px: 2, pb: 1.5, display: 'flex', justifyContent: 'center', gap: 0.5 }}>
              <IconButton size="small" onClick={toggleTheme} title={t().theme.toggleTheme}>
                {isDark() ? <LightModeOutlined /> : <DarkModeOutlined />}
              </IconButton>
              <IconButton size="small" onClick={() => setLocale(locale() === 'en' ? 'zh' : 'en')} title={locale() === 'en' ? t().theme.switchToChinese : t().theme.switchToEnglish}>
                <Translate />
              </IconButton>
              <Show when={store.connected()}>
                <IconButton size="small" color="error" onClick={() => {
                  const b = store.backend();
                  if (b) removeBackend(b.id);
                  store.disconnect();
                  _initialized = false;
                  navigate('/connect');
                }} title={t().actions.disconnect}>
                  <LogoutIcon />
                </IconButton>
              </Show>
            </Box>
          </Box>
        </Box>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Toolbar variant="dense" sx={{ gap: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.95rem' }}>
                {navLabel(activeKey())}
              </Typography>
            </Toolbar>
          </AppBar>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {props.children}
          </Box>
        </Box>
      </Box>
    </Show>
  );
}
