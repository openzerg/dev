import { createResource, Show, For } from 'solid-js';
import { Box, Typography, Card, CardContent, Chip, Grid, CircularProgress, Button } from '@suid/material';
import Add from '@suid/icons-material/Add';
import { useNavigate } from '@solidjs/router';
import { getRegistry } from '~/lib/clients';
import { useI18n } from '~/i18n/context';
import { useStore } from '~/lib/store';

export default function DashboardPage() {
  const navigate = useNavigate();
  const registry = getRegistry();
  const { t } = useI18n();
  const store = useStore();

  const [stats] = createResource(async () => {
    try {
      const [sessionsR, rolesR, workspacesR, instancesR] = await Promise.allSettled([
        registry.listSessions(),
        registry.listRoles(),
        registry.listWorkspaces(),
        registry.listInstances(''),
      ]);
      const unwrap = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' && r.value.isOk() ? r.value.value : null;
      return {
        sessions: unwrap(sessionsR)?.sessions?.length ?? 0,
        roles: unwrap(rolesR)?.roles?.length ?? 0,
        workspaces: unwrap(workspacesR)?.workspaces?.length ?? 0,
        instances: unwrap(instancesR)?.instances?.length ?? 0,
        sessionList: unwrap(sessionsR)?.sessions?.slice(0, 5) ?? [],
      };
    } catch {
      return { sessions: 0, roles: 0, workspaces: 0, instances: 0, sessionList: [] };
    }
  });

  const statCards = () => [
    { label: t().dashboard.sessions, value: stats()?.sessions ?? '-', color: '#d0bcff' },
    { label: t().dashboard.roles, value: stats()?.roles ?? '-', color: '#a8d5a2' },
    { label: t().dashboard.workspaces, value: stats()?.workspaces ?? '-', color: '#fbbf24' },
    { label: t().dashboard.instances, value: stats()?.instances ?? '-', color: '#60a5fa' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Show when={!store.connected()}>
        <Card sx={{ textAlign: 'center', py: 6, px: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{t().status.noBackend}</Typography>
          <Button variant="contained" onClick={() => navigate('/connect')}>{t().dashboard.connectButton}</Button>
        </Card>
      </Show>

      <Show when={store.connected()}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 3 }}>
          {t().dashboard.title}
        </Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <For each={statCards()}>
            {(stat) => (
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>{stat.label}</Typography>
                    <Typography variant="h3" sx={{ color: stat.color, mt: 0.5, fontWeight: 700 }}>
                      <Show when={stats()} fallback={<CircularProgress size={28} />}>{stat.value}</Show>
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </For>
        </Grid>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>{t().dashboard.sessions}</Typography>
          <Button variant="contained" size="small" startIcon={<Add />} onClick={() => navigate('/sessions/new')}>{t().sessions.newSession}</Button>
        </Box>

        <Show when={stats()?.sessionList?.length === 0}>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">{t().sessions.noSessions}</Typography>
          </Box>
        </Show>

        <Show when={(stats()?.sessionList?.length ?? 0) > 0}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <For each={stats()?.sessionList ?? []}>
              {(s: any) => (
                <Card variant="outlined" sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }} onClick={() => navigate(`/sessions/${s.sessionId}`)}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box>
                      <Typography fontWeight={600}>{s.title || s.sessionId}</Typography>
                      <Typography variant="caption" fontFamily="monospace" color="text.secondary">{s.roleName} · {s.state}</Typography>
                    </Box>
                    <Chip size="small" label={s.state} color={s.state === 'running' ? 'info' : s.state === 'idle' ? 'success' : 'default'} />
                  </CardContent>
                </Card>
              )}
            </For>
          </Box>
        </Show>
      </Show>
    </Box>
  );
}
