import { createSignal, onMount, Show, For } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { Box, Typography, Card, CardContent, TextField, Button, Alert, IconButton } from '@suid/material';
import Close from '@suid/icons-material/Close';
import { RegistryClient } from '@openzerg/common';
import { loadBackends, getActiveBackend, addBackend, removeBackend as removeBackendConfig, type BackendConfig } from '~/lib/config';
import { useStore } from '~/lib/store';
import { useI18n } from '~/i18n/context';

export default function ConnectPage() {
  const navigate = useNavigate();
  const store = useStore();
  const { t } = useI18n();
  const [url, setUrl] = createSignal('');
  const [apiKey, setApiKey] = createSignal('');
  const [error, setError] = createSignal('');
  const [connecting, setConnecting] = createSignal(false);
  const [backends, setBackends] = createSignal<BackendConfig[]>([]);
  const [selectedBackend, setSelectedBackend] = createSignal<BackendConfig | null>(null);
  const [showNewForm, setShowNewForm] = createSignal(false);

  onMount(() => {
    const saved = loadBackends();
    setBackends(saved);
    const active = getActiveBackend();
    if (active && saved.length > 0) {
      setSelectedBackend(active);
    }
    setUrl(window.location.origin);
  });

  const handleConnect = async () => {
    if (!apiKey()) {
      setError(t().connect.apiKeyRequired);
      return;
    }

    setConnecting(true);
    setError('');

    const connectUrl = selectedBackend()?.url || url();
    try {
      const client = new RegistryClient({ baseURL: connectUrl, token: '' });
      const result = await client.login(apiKey());
      if (result.isErr()) {
        setError(result.error.message || t().connect.connectionFailed);
        setConnecting(false);
        return;
      }
      const loginResp = result.value;

      const id = selectedBackend()?.id || `backend_${Date.now()}`;
      const backend: BackendConfig = {
        id,
        url: connectUrl,
        token: loginResp.userToken,
        label: new URL(connectUrl).host,
      };
      addBackend(backend);
      store.connect(backend);
      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e?.message || t().connect.connectionFailed);
    }

    setConnecting(false);
  };

  const handleSelectBackend = (backend: BackendConfig) => {
    setSelectedBackend(backend);
    setShowNewForm(false);
    setApiKey('');
    setError('');
  };

  const handleRemoveBackend = (id: string, e: Event) => {
    e.stopPropagation();
    removeBackendConfig(id);
    setBackends(loadBackends());
    if (selectedBackend()?.id === id) {
      setSelectedBackend(null);
    }
  };

  const handleShowNewForm = () => {
    setSelectedBackend(null);
    setShowNewForm(true);
    setUrl(window.location.origin);
    setApiKey('');
    setError('');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 480 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
            ◈ {t().connect.title}
          </Typography>
          <Typography variant="body1" color="text.secondary">{t().connect.subtitle}</Typography>
        </Box>

        <Show when={backends().length > 0 && !selectedBackend() && !showNewForm()}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t().connect.savedBackends}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <For each={backends()}>
                  {(backend) => (
                    <Card
                      variant="outlined"
                      sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onClick={() => handleSelectBackend(backend)}
                    >
                      <Box>
                        <Typography variant="body1" fontWeight={500}>{backend.label}</Typography>
                        <Typography variant="body2" color="text.secondary">{backend.url}</Typography>
                      </Box>
                      <IconButton size="small" color="error" onClick={(e) => handleRemoveBackend(backend.id, e)}>
                        <Close fontSize="small" />
                      </IconButton>
                    </Card>
                  )}
                </For>
              </Box>
              <Button fullWidth variant="outlined" sx={{ mt: 2 }} onClick={handleShowNewForm}>
                {t().connect.addNewBackend}
              </Button>
            </CardContent>
          </Card>
        </Show>

        <Show when={backends().length === 0 || selectedBackend() || showNewForm()}>
          <Card>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6">
                {selectedBackend() ? `${t().connect.connectTo} ${selectedBackend()!.label}` : `${t().connect.connectTo} Registry`}
              </Typography>

              <Show when={!selectedBackend()}>
                <TextField
                  label="URL"
                  placeholder="http://host:port"
                  value={url()}
                  onChange={(e) => setUrl(e.currentTarget.value)}
                  fullWidth
                  size="small"
                />
              </Show>

              <Show when={selectedBackend()}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {selectedBackend()!.url}
                </Typography>
              </Show>

              <TextField
                label={t().connect.apiKey}
                type="password"
                placeholder={t().connect.apiKeyHint}
                value={apiKey()}
                onChange={(e) => setApiKey(e.currentTarget.value)}
                fullWidth
                size="small"
              />

              <Show when={error()}>
                <Alert severity="error">{error()}</Alert>
              </Show>

              <Button
                variant="contained"
                fullWidth
                size="large"
                onClick={handleConnect}
                disabled={connecting()}
              >
                {connecting() ? t().connect.testing : t().connect.connect}
              </Button>

              <Show when={selectedBackend() || showNewForm()}>
                <Button
                  fullWidth
                  color="inherit"
                  onClick={() => { setSelectedBackend(null); setShowNewForm(false); setApiKey(''); setError(''); }}
                >
                  {t().actions.cancel}
                </Button>
              </Show>
            </CardContent>
          </Card>
        </Show>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">{t().connect.enterUrl}</Typography>
          <Typography variant="caption" color="text.secondary">{t().connect.autoDiscover}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
