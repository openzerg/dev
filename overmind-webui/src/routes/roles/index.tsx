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

export default function RolesPage() {
  const navigate = useNavigate();
  const registry = getRegistry();
  const { t } = useI18n();

  const [roles, { refetch }] = createResource(async () => {
    try {
      const r = await registry.listRoles();
      if (r.isErr()) return { roles: [] };
      return r.value;
    } catch { return { roles: [] }; }
  });

  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [newName, setNewName] = createSignal("");
  const [newSystemPrompt, setNewSystemPrompt] = createSignal("");
  const [newMaxSteps, setNewMaxSteps] = createSignal(0);
  const [creating, setCreating] = createSignal(false);

  async function handleCreate() {
    if (!newName().trim()) return;
    setCreating(true);
    try {
      const r = await registry.createRole({
        name: newName().trim(),
        systemPrompt: newSystemPrompt(),
        maxSteps: newMaxSteps() || undefined,
      });
      unwrap(r);
      setDialogOpen(false);
      setNewName("");
      setNewSystemPrompt("");
      setNewMaxSteps(0);
      refetch();
    } catch {}
    setCreating(false);
  }

  async function handleDelete(roleId: string, e: Event) {
    e.stopPropagation();
    if (!confirm("Delete this role?")) return;
    try {
      const r = await registry.deleteRole(roleId);
      unwrap(r);
      refetch();
    } catch {}
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {t().nav.roles}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
        >
          {t().actions.create}
        </Button>
      </Box>

      <Show when={!roles.loading} fallback={<CircularProgress />}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.name}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().roles.description}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().roles.skills}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().roles.maxSteps}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <For each={roles()?.roles || []}>
                {(role: any) => (
                  <TableRow
                    hover
                    onClick={() => navigate(`/roles/${role.id}`)}
                    sx={{ cursor: "pointer", '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <TableCell sx={{ color: 'text.primary' }}>{role.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{role.description}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatSkills(role.skills)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{role.maxSteps || "—"}</TableCell>
                    <TableCell>
                      <IconButton
                        onClick={(e) => handleDelete(role.id, e as any)}
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
          <TextField
            label={t().roles.maxSteps}
            type="number"
            value={newMaxSteps()}
            onChange={(_, v) => setNewMaxSteps(Number(v) || 0)}
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

function formatSkills(raw: string | undefined): string {
  if (!raw) return "—";
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return "—";
    return parsed.map((p: any) => typeof p === "string" ? p : p.slug).join(", ");
  } catch {
    return raw;
  }
}
