import { createResource, For, Show } from "solid-js";
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  Chip,
} from "@suid/material";
import Delete from "@suid/icons-material/Delete";
import { getWorkspaceManager } from "~/lib/clients";
import { unwrap } from "~/lib/result";
import { useI18n } from "~/i18n/context";

export default function WorkspacesPage() {
  const wm = getWorkspaceManager();
  const { t } = useI18n();

  const [workspaces, { refetch }] = createResource(async () => {
    try {
      const r = await wm.listWorkspaces();
      if (r.isErr()) return { workspaces: [] };
      return r.value;
    } catch { return { workspaces: [] }; }
  });

  async function handleDelete(id: string) {
    if (!confirm("Delete this workspace?")) return;
    try {
      const r = await wm.deleteWorkspace(id);
      unwrap(r);
      refetch();
    } catch {}
  }

  const stateColor = (s: string): "success" | "warning" | "error" | "default" => {
    if (s === "active" || s === "ready") return "success";
    if (s === "creating" || s === "pending") return "warning";
    if (s === "error" || s === "destroyed") return "error";
    return "default";
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 3 }}>
        {t().nav.workspaces}
      </Typography>

      <Show when={!workspaces.loading} fallback={<CircularProgress />}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>{t().workspaces.volumeId}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.state}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>Bound Session</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.createdAt}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <For each={workspaces()?.workspaces || []}>
                {(ws: any) => (
                  <TableRow sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ color: 'text.primary' }}>{ws.volumeName || ws.workspaceId}</TableCell>
                    <TableCell>
                      <Chip label={ws.state} size="small" color={stateColor(ws.state)} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{ws.createdBySessionId || "—"}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {ws.createdAt ? new Date(Number(ws.createdAt)).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleDelete(ws.workspaceId)} color="error">
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
    </Box>
  );
}
