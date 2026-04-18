import { createResource, For, Show } from "solid-js";
import {
  Box,
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
import { getRegistry } from "~/lib/clients";
import { useI18n } from "~/i18n/context";

export default function InstancesPage() {
  const registry = getRegistry();
  const { t } = useI18n();

  const [instances] = createResource(async () => {
    try {
      const r = await registry.listInstances("");
      if (r.isErr()) return { instances: [] };
      return r.value;
    } catch { return { instances: [] }; }
  });

  const lifecycleColor = (l: string): "success" | "warning" | "error" | "default" => {
    if (l === "alive" || l === "ready") return "success";
    if (l === "starting" || l === "stopping") return "warning";
    if (l === "dead" || l === "error") return "error";
    return "default";
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 3 }}>
        {t().nav.instances}
      </Typography>

      <Show when={!instances.loading} fallback={<CircularProgress />}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.name}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().instances.instanceType}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>URL</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>Lifecycle</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.createdAt}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <For each={instances()?.instances || []}>
                {(inst: any) => (
                  <TableRow sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ color: 'text.primary' }}>{inst.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{inst.instanceType}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{inst.url}</TableCell>
                    <TableCell>
                      <Chip
                        label={inst.lifecycle}
                        size="small"
                        color={lifecycleColor(inst.lifecycle)}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {inst.lastSeen ? new Date(Number(inst.lastSeen)).toLocaleString() : "—"}
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
