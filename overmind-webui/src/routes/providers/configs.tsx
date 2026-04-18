import { createResource, createSignal, For, Show, createEffect } from "solid-js";
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  Chip,
} from "@suid/material";
import Add from "@suid/icons-material/Add";
import Delete from "@suid/icons-material/Delete";
import Edit from "@suid/icons-material/Edit";
import ArrowBack from "@suid/icons-material/ArrowBack";
import Bolt from "@suid/icons-material/Bolt";
import { useNavigate } from "@solidjs/router";
import { getAiProxy } from "~/lib/clients";
import { useI18n } from "~/i18n/context";

export default function ProviderConfigsPage() {
  const aiProxy = getAiProxy();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [configs, { refetch }] = createResource(async () => {
    const r = await aiProxy.listProviderModelConfigs();
    if (r.isErr()) return { configs: [] };
    return r.value;
  });

  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [editingId, setEditingId] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const [testResult, setTestResult] = createSignal<{ ok: boolean; title: string; body: string } | null>(null);
  const [testingConfigId, setTestingConfigId] = createSignal<string | null>(null);

  const [selectedProviderId, setSelectedProviderId] = createSignal("");
  const [selectedModelId, setSelectedModelId] = createSignal("");
  const [apiKey, setApiKey] = createSignal("");
  const [upstream, setUpstream] = createSignal("");
  const [supportStreaming, setSupportStreaming] = createSignal(true);
  const [supportTools, setSupportTools] = createSignal(true);
  const [supportVision, setSupportVision] = createSignal(false);
  const [supportReasoning, setSupportReasoning] = createSignal(false);
  const [defaultMaxTokens, setDefaultMaxTokens] = createSignal(4096);
  const [contextLength, setContextLength] = createSignal(128000);
  const [autoCompactLength, setAutoCompactLength] = createSignal(0);

  const [providers] = createResource(async () => {
    const r = await aiProxy.listProviders();
    if (r.isErr()) return [];
    return (r.value as any).providers || [];
  });

  const [models] = createResource(selectedProviderId, async (pid) => {
    if (!pid) return [];
    const r = await aiProxy.listProviderModels(pid);
    if (r.isErr()) return [];
    return (r.value as any).models || [];
  });

  createEffect(() => {
    if (editingId()) return;
    const m = selectedModel();
    if (m) {
      setUpstream(m.upstream || "");
      setSupportStreaming(m.supportStreaming ?? true);
      setSupportTools(m.supportTools ?? true);
      setSupportVision(m.supportVision ?? false);
      setSupportReasoning(m.supportReasoning ?? false);
      setDefaultMaxTokens(m.defaultMaxTokens || 4096);
      setContextLength(m.contextLength || 128000);
      setAutoCompactLength(m.autoCompactLength || 0);
    }
  });

  function resetForm() {
    setSelectedProviderId("");
    setSelectedModelId("");
    setApiKey("");
    setUpstream("");
    setSupportStreaming(true);
    setSupportTools(true);
    setSupportVision(false);
    setSupportReasoning(false);
    setDefaultMaxTokens(4096);
    setContextLength(128000);
    setAutoCompactLength(0);
    setEditingId(null);
  }

  function openCreate() {
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(c: any) {
    setEditingId(c.id);
    setSelectedProviderId(c.providerId);
    setSelectedModelId(c.modelId);
    setApiKey(c.apiKey || "");
    setUpstream(c.upstream || "");
    setSupportStreaming(c.supportStreaming ?? true);
    setSupportTools(c.supportTools ?? true);
    setSupportVision(c.supportVision ?? false);
    setSupportReasoning(c.supportReasoning ?? false);
    setDefaultMaxTokens(c.defaultMaxTokens || 4096);
    setContextLength(c.contextLength || 128000);
    setAutoCompactLength(c.autoCompactLength || 0);
    setDialogOpen(true);
  }

  function selectedProvider(): any {
    return (providers() || []).find((p: any) => p.id === selectedProviderId());
  }

  function selectedModel(): any {
    return (models() || []).find((m: any) => m.modelId === selectedModelId());
  }

  async function handleSubmit() {
    setSubmitting(true);
    if (editingId()) {
      const r = await aiProxy.updateProviderModelConfig({
        id: editingId()!,
        providerName: selectedProvider()?.name || "",
        modelName: selectedModel()?.modelName || selectedModelId(),
        upstream: upstream().trim(),
        apiKey: apiKey().trim(),
        supportStreaming: supportStreaming(),
        supportTools: supportTools(),
        supportVision: supportVision(),
        supportReasoning: supportReasoning(),
        defaultMaxTokens: defaultMaxTokens(),
        contextLength: contextLength(),
        autoCompactLength: autoCompactLength(),
        enabled: true,
      });
      if (r.isOk()) {
        setDialogOpen(false);
        resetForm();
        refetch();
      }
    } else {
      if (!selectedProviderId() || !selectedModelId() || !apiKey().trim()) {
        setSubmitting(false);
        return;
      }
      const provider = selectedProvider();
      const model = selectedModel();
      const r = await aiProxy.createProviderModelConfig({
        providerId: selectedProviderId(),
        providerName: provider?.name || "",
        modelId: selectedModelId(),
        modelName: model?.modelName || selectedModelId(),
        upstream: upstream().trim() || model?.upstream || "",
        apiKey: apiKey().trim(),
        supportStreaming: supportStreaming(),
        supportTools: supportTools(),
        supportVision: supportVision(),
        supportReasoning: supportReasoning(),
        defaultMaxTokens: defaultMaxTokens(),
        contextLength: contextLength(),
        autoCompactLength: autoCompactLength(),
      });
      if (r.isOk()) {
        setDialogOpen(false);
        resetForm();
        refetch();
      }
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t().providers.deleteConfirm)) return;
    const r = await aiProxy.deleteProviderModelConfig(id);
    if (r.isOk()) refetch();
  }

  async function handleTestConfig(c: any) {
    setTestingConfigId(c.id);
    const r = await aiProxy.testProviderModelConfig(c.id);
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
    setTestingConfigId(null);
  }

  const isEditing = () => !!editingId();

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={() => navigate("/providers")} size="small">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>{t().providers.configs}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
        >
          {t().actions.create}
        </Button>
      </Box>

      <Show when={!configs.loading} fallback={<CircularProgress />}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.provider}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.model}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.upstream}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.capabilities}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().providers.tokenLimits}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <For each={(configs() as any)?.configs || []}>
                {(c: any) => (
                  <TableRow sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ color: 'text.primary' }}>{c.providerName}</TableCell>
                    <TableCell sx={{ color: 'text.primary' }}>{c.modelName}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.upstream || "—"}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        <Show when={c.supportStreaming}><Chip label={t().providers.streaming} size="small" color="success" variant="outlined" /></Show>
                        <Show when={c.supportTools}><Chip label={t().providers.tools} size="small" color="success" variant="outlined" /></Show>
                        <Show when={c.supportVision}><Chip label={t().providers.vision} size="small" color="info" variant="outlined" /></Show>
                        <Show when={c.supportReasoning}><Chip label={t().providers.reasoning} size="small" color="warning" variant="outlined" /></Show>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{c.defaultMaxTokens?.toLocaleString()} / {c.contextLength?.toLocaleString()}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <IconButton onClick={() => handleTestConfig(c)} color="warning" disabled={testingConfigId() === c.id}>
                          <Bolt />
                        </IconButton>
                        <IconButton onClick={() => openEdit(c)} color="primary">
                          <Edit />
                        </IconButton>
                        <IconButton onClick={() => handleDelete(c.id)} color="error">
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

      <Dialog open={dialogOpen()} onClose={() => { setDialogOpen(false); resetForm(); }} maxWidth="sm" fullWidth>
        <DialogTitle>{isEditing() ? t().actions.edit : t().actions.create} {t().providers.configs}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <Show when={isEditing()} fallback={
            <FormControl fullWidth size="small">
              <InputLabel>{t().providers.provider}</InputLabel>
              <Select
                value={selectedProviderId()}
                onChange={(e: any) => {
                  setSelectedProviderId(e.target.value);
                  setSelectedModelId("");
                }}
                label={t().providers.provider}
              >
                <MenuItem value="">{t().providers.selectPlaceholder}</MenuItem>
                <For each={providers() || []}>
                  {(p: any) => (
                    <MenuItem value={p.id}>{p.name}</MenuItem>
                  )}
                </For>
              </Select>
            </FormControl>
          }>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center", p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{t().providers.provider}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedProvider()?.name || selectedProviderId()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>{t().providers.model}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{selectedModel()?.modelName || selectedModelId()}</Typography>
              </Box>
            </Box>
          </Show>

          <Show when={!isEditing() && selectedProviderId() && !models.loading}>
            <FormControl fullWidth size="small">
              <InputLabel>{t().providers.model}</InputLabel>
              <Select
                value={selectedModelId()}
                onChange={(e: any) => setSelectedModelId(e.target.value)}
                label={t().providers.model}
              >
                <MenuItem value="">{t().providers.selectPlaceholder}</MenuItem>
                <For each={models() || []}>
                  {(m: any) => (
                    <MenuItem value={m.modelId}>
                      <Box sx={{ display: "flex", flexDirection: "column" }}>
                        <Typography variant="body2">{m.modelName}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {m.upstream}
                        </Typography>
                      </Box>
                    </MenuItem>
                  )}
                </For>
              </Select>
            </FormControl>
          </Show>

          <Show when={selectedModelId()}>
            <TextField
              label={t().providers.upstream}
              value={upstream()}
              onChange={(_, v) => setUpstream(v)}
              fullWidth
              size="small"
              placeholder={selectedModel()?.upstream || ""}
            />

            <TextField
              label={t().providers.apiKey}
              type="password"
              value={apiKey()}
              onChange={(_, v) => setApiKey(v)}
              fullWidth
              size="small"
              required
            />

            <Typography variant="subtitle2" sx={{ color: "text.secondary", mt: 1 }}>
              {t().providers.capabilities}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
              <FormControlLabel
                control={<Switch checked={supportStreaming()} onChange={(_, v) => setSupportStreaming(v)} />}
                label={t().providers.streaming}
              />
              <FormControlLabel
                control={<Switch checked={supportTools()} onChange={(_, v) => setSupportTools(v)} />}
                label={t().providers.tools}
              />
              <FormControlLabel
                control={<Switch checked={supportVision()} onChange={(_, v) => setSupportVision(v)} />}
                label={t().providers.vision}
              />
              <FormControlLabel
                control={<Switch checked={supportReasoning()} onChange={(_, v) => setSupportReasoning(v)} />}
                label={t().providers.reasoning}
              />
            </Box>

            <Typography variant="subtitle2" sx={{ color: "text.secondary", mt: 1 }}>
              {t().providers.tokenLimits}
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
              <TextField
                label={t().providers.maxTokens}
                type="number"
                value={defaultMaxTokens()}
                onChange={(_, v) => setDefaultMaxTokens(Number(v) || 0)}
                size="small"
              />
              <TextField
                label={t().providers.contextLength}
                type="number"
                value={contextLength()}
                onChange={(_, v) => setContextLength(Number(v) || 0)}
                size="small"
              />
              <TextField
                label={t().providers.autoCompact}
                type="number"
                value={autoCompactLength()}
                onChange={(_, v) => setAutoCompactLength(Number(v) || 0)}
                size="small"
                placeholder={t().providers.autoDefault}
              />
            </Box>
          </Show>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDialogOpen(false); resetForm(); }}>{t().actions.cancel}</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting() || !selectedProviderId() || !selectedModelId() || (!editingId() && !apiKey().trim())}
          >
            {isEditing() ? t().actions.update : t().actions.create}
          </Button>
        </DialogActions>
      </Dialog>

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
