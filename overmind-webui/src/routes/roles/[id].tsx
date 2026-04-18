import { createResource, createSignal, Show } from "solid-js";
import { useParams } from "@solidjs/router";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
} from "@suid/material";
import Save from "@suid/icons-material/Save";
import { getRegistry } from "~/lib/clients";
import { unwrap } from "~/lib/result";
import { useI18n } from "~/i18n/context";
import SkillSelector from "~/components/roles/SkillSelector";
import ZcpServerEditor from "~/components/roles/ZcpServerEditor";
import PkgChipInput from "~/components/roles/PkgChipInput";

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const registry = getRegistry();
  const { t } = useI18n();

  const [role, { refetch }] = createResource(async () => {
    try {
      const r = await registry.getRole(params.id);
      if (r.isErr()) return null;
      return r.value;
    } catch { return null; }
  });

  const [tab, setTab] = createSignal<"hot" | "workspace">("hot");
  const [saving, setSaving] = createSignal(false);
  const [msg, setMsg] = createSignal<{ type: "success" | "error"; text: string } | null>(null);

  const [systemPrompt, setSystemPrompt] = createSignal("");
  const [skills, setSkills] = createSignal("[]");
  const [maxSteps, setMaxSteps] = createSignal(0);

  const [name, setName] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [zcpServers, setZcpServers] = createSignal("[]");
  const [extraPkgs, setExtraPkgs] = createSignal("[]");

  let initialized = false;

  function initFromRole(r: any) {
    if (initialized) return;
    initialized = true;
    setSystemPrompt(r.systemPrompt || "");
    setSkills(normalizeJsonArray(r.skills));
    setMaxSteps(r.maxSteps || 0);
    setName(r.name || "");
    setDescription(r.description || "");
    setZcpServers(normalizeJsonArray(r.zcpServers));
    setExtraPkgs(normalizeJsonArray(r.extraPkgs));
  }

  function normalizeJsonArray(raw: string | undefined): string {
    if (!raw) return "[]";
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? JSON.stringify(parsed) : "[]";
    } catch {
      return "[]";
    }
  }

  const roleData = role();
  if (roleData) initFromRole(roleData);

  async function handleSaveHotConfig() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await registry.updateRoleHotConfig({
        id: params.id,
        systemPrompt: systemPrompt(),
        skills: skills(),
        maxSteps: maxSteps(),
      });
      unwrap(r);
      setMsg({ type: "success", text: "Saved" });
      refetch();
    } catch (e: any) {
      setMsg({ type: "error", text: e?.message || "Failed" });
    }
    setSaving(false);
  }

  async function handleSaveWorkspaceConfig() {
    setSaving(true);
    setMsg(null);
    try {
      const r = await registry.updateRoleWorkspaceConfig({
        id: params.id,
        name: name(),
        description: description(),
        zcpServers: zcpServers(),
        extraPkgs: extraPkgs(),
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
      <Show when={!role.loading} fallback={<CircularProgress />}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main', mb: 3 }}>
          {(role() as any)?.name || params.id}
        </Typography>

        <Show when={msg()}>
          <Alert severity={msg()!.type} sx={{ mb: 2 }}>
            {msg()!.text}
          </Alert>
        </Show>

        <ToggleButtonGroup
          value={tab()}
          exclusive
          onChange={(_, v) => { if (v) setTab(v); }}
          size="small"
          sx={{ mb: 3 }}
        >
          <ToggleButton value="hot">{t().roles.hotConfig}</ToggleButton>
          <ToggleButton value="workspace">{t().roles.workspaceConfig}</ToggleButton>
        </ToggleButtonGroup>

        <Show when={tab() === "hot"}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 700 }}>
              <TextField
                label={t().roles.systemPrompt}
                value={systemPrompt()}
                onChange={(_, v) => setSystemPrompt(v)}
                multiline
                rows={6}
              />
              <SkillSelector
                value={skills()}
                onChange={setSkills}
                label={t().roles.skills}
              />
              <TextField
                label={t().roles.maxSteps}
                type="number"
                value={maxSteps()}
                onChange={(_, v) => setMaxSteps(Number(v) || 0)}
              />
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveHotConfig}
                disabled={saving()}
                sx={{ alignSelf: "flex-start" }}
              >
                {t().actions.save}
              </Button>
            </Box>
          </Paper>
        </Show>

        <Show when={tab() === "workspace"}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, maxWidth: 700 }}>
              <TextField
                label={t().common.name}
                value={name()}
                onChange={(_, v) => setName(v)}
              />
              <TextField
                label={t().roles.description}
                value={description()}
                onChange={(_, v) => setDescription(v)}
                multiline
                rows={3}
              />
              <ZcpServerEditor
                value={zcpServers()}
                onChange={setZcpServers}
                label={t().roles.zcpServers}
              />
              <PkgChipInput
                value={extraPkgs()}
                onChange={setExtraPkgs}
                label={t().roles.extraPkgs}
                placeholder="Type nix package name and press Enter"
              />
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSaveWorkspaceConfig}
                disabled={saving()}
                sx={{ alignSelf: "flex-start" }}
              >
                {t().actions.save}
              </Button>
            </Box>
          </Paper>
        </Show>
      </Show>
    </Box>
  );
}
