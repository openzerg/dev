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
import ArrowBack from "@suid/icons-material/ArrowBack";
import { getRegistry } from "~/lib/clients";
import { unwrap } from "~/lib/result";
import { useI18n } from "~/i18n/context";

export default function SessionNewPage() {
  const navigate = useNavigate();
  const registry = getRegistry();
  const { t } = useI18n();

  const [templates] = createResource(async () => {
    try {
      const r = await registry.listTemplates();
      if (r.isErr()) return { templates: [] };
      return r.value;
    } catch { return { templates: [] }; }
  });

  const [title, setTitle] = createSignal("");
  const [templateId, setTemplateId] = createSignal("");
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  async function handleCreate() {
    if (!title()) return;
    setCreating(true);
    setError(null);
    try {
      const req: any = { title: title() };
      if (templateId()) req.templateId = templateId();
      const r = await registry.createSession(req);
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/sessions")}>
          {t().actions.back}
        </Button>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {t().sessions.newSession}
        </Typography>
      </Box>

      <Show when={error()}>
        <Alert severity="error" sx={{ mb: 2 }}>{error()}</Alert>
      </Show>

      <Box sx={{ maxWidth: 500, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label={t().common.name}
          value={title()}
          onChange={(_, v) => setTitle(v)}
        />

        <Show when={!templates.loading} fallback={<CircularProgress />}>
          <TextField
            select
            label={t().common.role}
            value={templateId()}
            onChange={(_, v) => setTemplateId(v)}
          >
            <MenuItem value="">— {t().actions.create} —</MenuItem>
            <For each={templates()?.templates || []}>
              {(tpl: any) => <MenuItem value={tpl.id}>{tpl.name}</MenuItem>}
            </For>
          </TextField>
        </Show>

        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={creating() || !title()}
        >
          {creating() ? t().common.loading : t().actions.create}
        </Button>
      </Box>
    </Box>
  );
}
