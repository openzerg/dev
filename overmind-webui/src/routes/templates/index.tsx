import { createResource, createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
} from "@suid/material";
import Add from "@suid/icons-material/Add";
import Delete from "@suid/icons-material/Delete";
import { getRegistry } from "~/lib/clients";
import { unwrap } from "~/lib/result";
import { useI18n } from "~/i18n/context";

export default function TemplatesPage() {
  const navigate = useNavigate();
  const registry = getRegistry();
  const { t } = useI18n();

  const [templates, { refetch }] = createResource(async () => {
    try {
      const r = await registry.listTemplates();
      if (r.isErr()) return { templates: [] };
      return r.value;
    } catch { return { templates: [] }; }
  });

  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newSystemPrompt, setNewSystemPrompt] = createSignal("");
  const [creating, setCreating] = createSignal(false);

  async function handleCreate() {
    if (!newName().trim()) return;
    setCreating(true);
    try {
      const r = await registry.createTemplate({
        name: newName().trim(),
        systemPrompt: newSystemPrompt(),
      });
      unwrap(r);
      setDialogOpen(false);
      setNewName("");
      setNewSystemPrompt("");
      refetch();
    } catch {}
    setCreating(false);
  }

  async function handleDelete(templateId: string, e: Event) {
    e.stopPropagation();
    if (!confirm(t().roles.deleteConfirm)) return;
    try {
      const r = await registry.deleteTemplate(templateId);
      unwrap(r);
      refetch();
    } catch {}
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {t().roles.title}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
        >
          {t().actions.create}
        </Button>
      </Box>

      <Show when={!templates.loading} fallback={<CircularProgress />}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.name}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().roles.description}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().roles.modelId}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <For each={templates()?.templates || []}>
                {(tpl: any) => (
                  <TableRow
                    hover
                    onClick={() => navigate(`/templates/${tpl.id}`)}
                    sx={{ cursor: "pointer", '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell sx={{ color: 'text.primary' }}>{tpl.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{tpl.description}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{tpl.providerConfig?.modelId || "—"}</TableCell>
                    <TableCell>
                      <IconButton
                        onClick={(e) => handleDelete(tpl.id, e as any)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </TableContainer>
      </Show>

      <Dialog open={dialogOpen()} onClose={() => setDialogOpen(false)}>
        <DialogTitle>{t().roles.createTitle}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            autoFocus
            label={t().common.name}
            value={newName()}
            onChange={(_, v) => setNewName(v)}
            fullWidth
          />
          <TextField
            label={t().roles.systemPrompt}
            value={newSystemPrompt()}
            onChange={(_, v) => setNewSystemPrompt(v)}
            multiline
            rows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t().actions.cancel}</Button>
          <Button onClick={handleCreate} disabled={creating() || !newName().trim()}>
            {t().actions.create}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
