import { createResource, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Box,
  Button,
  Chip,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  CircularProgress,
  Stack,
} from "@suid/material";
import Add from "@suid/icons-material/Add";
import { getRegistry } from "~/lib/clients";
import { useI18n } from "~/i18n/context";

const stateColors: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  idle: "default",
  running: "info",
  waiting: "warning",
  completed: "success",
  failed: "error",
  stopped: "default",
};

export default function SessionsPage() {
  const navigate = useNavigate();
  const registry = getRegistry();
  const { t } = useI18n();

  const [sessions, { refetch }] = createResource(async () => {
    try {
      const r = await registry.listSessions();
      if (r.isErr()) return { sessions: [] };
      return r.value;
    } catch { return { sessions: [] }; }
  });

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {t().nav.sessions}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate("/sessions/new")}
        >
          {t().sessions.newSession}
        </Button>
      </Box>

      <Show when={!sessions.loading} fallback={<CircularProgress />}>
        <Show when={(sessions()?.sessions || []).length === 0}>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">{t().sessions.noSessions}</Typography>
          </Box>
        </Show>
        <Show when={(sessions()?.sessions || []).length > 0}>
          <Stack spacing={2}>
            <For each={sessions()?.sessions || []}>
              {(s: any) => (
                <Card variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main' } }}>
                  <CardActionArea onClick={() => navigate(`/sessions/${s.sessionId}`)}>
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1, minWidth: 0 }}>
                          <Typography variant="subtitle1" color="text.primary" noWrap>
                            {s.title || s.sessionId}
                          </Typography>
                          <Chip
                            label={s.state}
                            size="small"
                            color={stateColors[s.state] || "default"}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                          {s.roleName}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 3, mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Workspace: {s.workspaceId || "—"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {s.createdAt ? new Date(Number(s.createdAt)).toLocaleString() : "—"}
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              )}
            </For>
          </Stack>
        </Show>
      </Show>
    </Box>
  );
}
