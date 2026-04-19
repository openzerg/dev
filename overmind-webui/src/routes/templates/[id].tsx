import { createResource, createSignal, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Paper,
} from "@suid/material";
import Save from "@suid/icons-material/Save";
import ArrowBack from "@suid/icons-material/ArrowBack";
import { create } from "@bufbuild/protobuf";
import { ProviderConfigSchema } from "@openzerg/common/gen/registry/v1_pb";
import { getRegistry } from "~/lib/clients";
import { unwrap } from "~/lib/result";
import { useI18n } from "~/i18n/context";
import SkillSelector from "~/components/templates/SkillSelector";
import ToolServerEditor from "~/components/templates/ToolServerEditor";
import PkgChipInput from "~/components/templates/PkgChipInput";

export default function TemplateDetailPage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const registry = getRegistry();
  const { t } = useI18n();

  const [tpl, { refetch }] = createResource(async () => {
    try {
      const r = await registry.getTemplate(params.id);
      if (r.isErr()) return null;
      return r.value;
    } catch { return null; }
  });

  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ type: "success" | "error"; text: string } | null>(null);

  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [systemPrompt, setSystemPrompt] = createSignal("");
  const [upstream, setUpstream] = createSignal("");
  const [apiKey, setApiKey] = createSignal("");
  const [modelId, setModelId] = createSignal("");
  const [maxTokens, setMaxTokens] = createSignal(0);
  const [contextLength, setContextLength] = createSignal(0);
  const [autoCompactLength, setAutoCompactLength] = createSignal(0);
  const [toolServers, setToolServers] = createSignal("[]");
  const [skills, setSkills] = createSignal("[]");
  const [extraPkgs, setExtraPkgs] = createSignal("[]");

  let initialized = false;

  function initFromTemplate(r: any) {
    if (initialized) return;
    initialized = true;
    setName(r.name || "");
    setDescription(r.description || "");
    setSystemPrompt(r.systemPrompt || "");
    setUpstream(r.providerConfig?.upstream || "");
    setApiKey(r.providerConfig?.apiKey || "");
    setModelId(r.providerConfig?.modelId || "");
    setMaxTokens(r.providerConfig?.maxTokens || 0);
    setContextLength(r.providerConfig?.contextLength || 0);
    setAutoCompactLength(r.providerConfig?.autoCompactLength || 0);
    setToolServers(normalizeJsonArray(r.toolServerConfig));
    setSkills(normalizeJsonArray(r.skillConfig));
    setExtraPkgs(normalizeJsonArray(r.extraPackage));
  }

  function normalizeJsonArray(raw: any): string {
    if (!raw) return "[]";
    if (typeof raw === "string") {
      try { const p = JSON.parse(raw); return Array.isArray(p) ? JSON.stringify(p) : "[]"; } catch { return "[]"; }
    }
    if (Array.isArray(raw)) return JSON.stringify(raw);
    return "[]";
  }

  const tplData = tpl();
  if (tplData) initFromTemplate(tplData);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await registry.updateTemplate({
        id: params.id,
        name: name(),
        description: description(),
        systemPrompt: systemPrompt(),
        providerConfig: create(ProviderConfigSchema, {
          upstream: upstream(),
          apiKey: apiKey(),
          modelId: modelId(),
          maxTokens: maxTokens(),
          contextLength: contextLength(),
          autoCompactLength: autoCompactLength(),
        }),
        toolServerConfig: JSON.parse(toolServers()),
        skillConfig: JSON.parse(skills()),
        extraPackage: JSON.parse(extraPkgs()),
      });
      unwrap(r);
      setMsg({ type: "success", text: "Saved" });
      refetch();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Failed" });
    }
    setSaving(false);
  }

  return (
    <Box sx={{ p: 3 }}>
      <Show when={!tpl.loading} fallback={<CircularProgress />}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate("/templates")}>
            {t().actions.back}
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
            {(tpl() as any)?.name || params.id}
          </Typography>
        </Box>

        <Show when={msg()}>
          <Alert severity={msg()!.type} sx={{ mb: 2 }}>
            {msg()!.text}
          </Alert>
        </Show>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 700 }}>
            <TextField label={t().common.name} value={name()} onChange={(_, v) => setName(v)} />
            <TextField label={t().roles.description} value={description()} onChange={(_, v) => setDescription(v)} multiline rows={2} />
            <TextField label={t().roles.systemPrompt} value={systemPrompt()} onChange={(_, v) => setSystemPrompt(v)} multiline rows={6} />

            <Typography variant="subtitle2" sx={{ mt: 1, color: 'text.secondary' }}>{t().roles.providerConfig}</Typography>
            <TextField label={t().roles.upstream} value={upstream()} onChange={(_, v) => setUpstream(v)} />
            <TextField label={t().roles.apiKey} value={apiKey()} onChange={(_, v) => setApiKey(v)} type="password" />
            <TextField label={t().roles.modelId} value={modelId()} onChange={(_, v) => setModelId(v)} />
            <TextField label={t().roles.maxTokens} type="number" value={maxTokens()} onChange={(_, v) => setMaxTokens(Number(v) || 0)} />
            <TextField label={t().roles.contextLength} type="number" value={contextLength()} onChange={(_, v) => setContextLength(Number(v) || 0)} />
            <TextField label={t().roles.autoCompactLength} type="number" value={autoCompactLength()} onChange={(_, v) => setAutoCompactLength(Number(v) || 0)} />

            <ToolServerEditor value={toolServers()} onChange={setToolServers} label={t().roles.toolServers} />
            <SkillSelector value={skills()} onChange={setSkills} label={t().roles.skills} />
            <PkgChipInput value={extraPkgs()} onChange={setExtraPkgs} label={t().roles.extraPkgs} placeholder="Type nix package name and press Enter" />

            <Button variant="contained" startIcon={<Save />} onClick={handleSave} disabled={saving()} sx={{ alignSelf: "flex-start" }}>
              {t().actions.save}
            </Button>
          </Box>
        </Paper>
      </Show>
    </Box>
  );
}
