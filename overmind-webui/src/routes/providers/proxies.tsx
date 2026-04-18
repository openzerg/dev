import { createResource, createSignal, For, Show } from "solid-js";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
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
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
} from "@suid/material";
import Add from "@suid/icons-material/Add";
import Delete from "@suid/icons-material/Delete";
import Edit from "@suid/icons-material/Edit";
import ArrowBack from "@suid/icons-material/ArrowBack";
import Bolt from "@suid/icons-material/Bolt";
import { useNavigate } from "@solidjs/router";
import { getAiProxy } from "~/lib/clients";
import { useI18n } from "~/i18n/context";

export default function ProxiesPage() {
  const aiProxy = getAiProxy();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [proxies, { refetch }] = createResource(async () => {
    const r = await aiProxy.listProxies();
    if (r.isErr()) return { proxies: [] };
    return r.value;
  });

  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [sourceModel, setSourceModel] = createSignal("");
  const [configId, setConfigId] = createSignal("");
  const [enabled, setEnabled] = createSignal(true);
  const [submitting, setSubmitting] = createSignal(false);

  const [testResult, setTestResult] = createSignal<{ ok: boolean; title: string; body: string } | null>(null);
  const [testingProxyId, setTestingProxyId] = createSignal<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setSourceModel("");
    setConfigId("");
    setEnabled(true);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(p: any) {
    setEditingId(p.id);
    setSourceModel(p.sourceModel || "");
    setConfigId(p.providerModelConfigId || "");
    setEnabled(p.enabled ?? true);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!sourceModel().trim() || !configId().trim()) return;
    setSubmitting(true);
    if (editingId()) {
      const r = await aiProxy.updateProxy({
        id: editingId()!,
        sourceModel: sourceModel().trim(),
        providerModelConfigId: configId().trim(),
        enabled: enabled(),
      });
      if (r.isOk()) {
        setDialogOpen(false);
        resetForm();
        refetch();
      }
    } else {
      const r = await aiProxy.createProxy(sourceModel().trim(), configId().trim());
      if (r.isOk()) {
        setDialogOpen(false);
        resetForm();
        refetch();
      }
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t().providers.deleteProxyConfirm)) return;
    const r = await aiProxy.deleteProxy(id);
    if (r.isOk()) refetch();
  }

  async function handleTestProxy(p: any) {
    setTestingProxyId(p.id);
    const r = await aiProxy.testProxy(p.id);
    if (r.isOk()) {
      const v = r.value as any;
      setTestResult({
        ok: v.success,
        title: v.success ? t().providers.testSuccess : t().providers.testFailed,
        body: v.latencyMs ? `${v.message} (${v.latencyMs}ms)` : v.message,
      });
    } else {
      setTestResult({ ok: false, title: t().providers.testFailed, body: r.error.message });
    }
    setTestingProxyId(null);
  }

  const isEditing = () => !!editingId();

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={() => navigate("/providers")} size="small">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {t().providers.proxies}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
        >
          {t().actions.create}
        </Button>
      </Box>

      <Show when={!proxies.loading} fallback={<CircularProgress />}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.sourceModel}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.provider}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.model}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.upstream}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.enabled}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <For each={(proxies() as any)?.proxies || []}>
                {(p: any) => (
                  <TableRow sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ color: 'text.primary', fontFamily: 'monospace' }}>{p.sourceModel}</TableCell>
                    <TableCell sx={{ color: 'text.primary' }}>{p.providerName || "—"}</TableCell>
                    <TableCell sx={{ color: 'text.primary' }}>{p.modelName || "—"}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.upstream || "—"}</TableCell>
                    <TableCell>
                      <Chip
                        label={p.enabled ? t().providers.enabled : t().providers.disabled}
                        size="small"
                        color={p.enabled ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <IconButton onClick={() => handleTestProxy(p)} color="warning" disabled={testingProxyId() === p.id}>
                          <Bolt />
                        </IconButton>
                        <IconButton onClick={() => openEdit(p)} color="primary">
                          <Edit />
                        </IconButton>
                        <IconButton onClick={() => handleDelete(p.id)} color="error">
                          <Delete />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </For>
            </TableBody>
          </Table>
        </TableContainer>
      </Show>

      <ProxyDialog
        open={dialogOpen()}
        onClose={() => { setDialogOpen(false); resetForm(); }}
        onSubmit={handleSubmit}
        submitting={submitting()}
        editing={isEditing()}
        sourceModel={sourceModel()}
        setSourceModel={setSourceModel}
        configId={configId()}
        setConfigId={setConfigId}
        enabled={enabled()}
        setEnabled={setEnabled}
      />

      <Dialog open={!!testResult()} onClose={() => setTestResult(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: testResult()?.ok ? 'success.main' : 'error.main' }}>
          {testResult()?.title}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {testResult()?.body}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestResult(null)}>{t().actions.close}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ProxyDialog(props: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  editing: boolean;
  sourceModel: string;
  setSourceModel: (v: string) => void;
  configId: string;
  setConfigId: (v: string) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}) {
  const aiProxy = getAiProxy();
  const { t } = useI18n();

  const [configs] = createResource(async () => {
    const r = await aiProxy.listProviderModelConfigs();
    if (r.isErr()) return { configs: [] };
    return r.value;
  });

  return (
    <Dialog open={props.open} onClose={props.onClose}>
      <DialogTitle>{props.editing ? t().actions.edit : t().actions.create} {t().providers.proxies}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
        <TextField
          autoFocus
          label={t().providers.sourceModel}
          value={props.sourceModel}
          onChange={(_, v) => props.setSourceModel(v)}
          fullWidth
        />
        <FormControl fullWidth>
          <InputLabel>{t().providers.providerConfig}</InputLabel>
          <Select
            value={props.configId}
            onChange={(e: any) => props.setConfigId(e.target.value)}
            label={t().providers.providerConfig}
          >
            <MenuItem value="">{t().providers.selectConfig}</MenuItem>
            <For each={(configs() as any)?.configs || []}>
              {(c: any) => <MenuItem value={c.id}>{c.providerName} / {c.modelName}</MenuItem>}
            </For>
          </Select>
        </FormControl>
        <Show when={props.editing}>
          <FormControlLabel
            control={<Switch checked={props.enabled} onChange={(_, v) => props.setEnabled(v)} />}
            label={t().providers.enabled}
          />
        </Show>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>{t().actions.cancel}</Button>
        <Button onClick={props.onSubmit} disabled={props.submitting || !props.sourceModel.trim() || !props.configId}>
          {props.editing ? t().actions.update : t().actions.create}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
