import { createResource, createSignal, Show, For } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@suid/material";
import { getRegistry } from "~/lib/clients";
import { unwrap } from "~/lib/result";
import { useI18n } from "~/i18n/context";

export default function SessionNewPage() {
  const navigate = useNavigate();
  const registry = getRegistry();
  const { t } = useI18n();

  const [roles] = createResource(async () => {
    try {
      const r = await registry.listRoles();
      if (r.isErr()) return { roles: [] };
      return r.value;
    } catch { return { roles: [] }; }
  });

  const [title, setTitle] = createSignal("");
  const [roleId, setRoleId] = createSignal("");
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function handleCreate() {
    if (!title() || !roleId()) return;
    setCreating(true);
    setError(null);
    try {
      const r = await registry.createSession({ title: title(), roleId: roleId() });
      const resp = unwrap(r);
      navigate(`/sessions/${resp.sessionId}`);
    } catch (e: any) {
      setError(e?.message || "Failed to create session");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 3 }}>
        {t().sessions.newSession}
      </Typography>

      <Show when={error()}>
        <Alert severity="error" sx={{ mb: 2 }}>{error()}</Alert>
      </Show>

      <Box sx={{ maxWidth: 500, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label={t().common.name}
          value={title()}
          onChange={(_, v) => setTitle(v)}
        />

        <Show when={!roles.loading} fallback={<CircularProgress />}>
          <TextField
            select
            label={t().common.role}
            value={roleId()}
            onChange={(_, v) => setRoleId(v)}
          >
            <MenuItem value="">Select a role</MenuItem>
            <For each={roles()?.roles || []}>
              {(role: any) => <MenuItem value={role.id}>{role.name}</MenuItem>}
            </For>
          </TextField>
        </Show>

        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={creating() || !title() || !roleId()}
        >
          {creating() ? t().common.loading : t().actions.create}
        </Button>
      </Box>
    </Box>
  );
}
