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
} from "@suid/material";
import Add from "@suid/icons-material/Add";
import Delete from "@suid/icons-material/Delete";
import { getSkillManager } from "~/lib/clients";
import { unwrap } from "~/lib/result";
import { useI18n } from "~/i18n/context";

export default function SkillsPage() {
  const skills = getSkillManager();
  const { t } = useI18n();

  const [list, { refetch }] = createResource(async () => {
    try {
      const r = await skills.listSkills();
      if (r.isErr()) return { skills: [] };
      return r.value;
    } catch { return { skills: [] }; }
  });

  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [slug, setSlug] = createSignal("");
  const [gitUrl, setGitUrl] = createSignal("");
  const [creating, setCreating] = createSignal(false);

  async function handleRegister() {
    if (!slug().trim() || !gitUrl().trim()) return;
    setCreating(true);
    try {
      const r = await skills.registerSkill({ slug: slug().trim(), gitUrl: gitUrl().trim() });
      unwrap(r);
      setDialogOpen(false);
      setSlug("");
      setGitUrl("");
      refetch();
    } catch {}
    setCreating(false);
  }

  async function handleDelete(s: string) {
    if (!confirm(`Delete skill "${s}"?`)) return;
    try {
      const r = await skills.deleteSkill(s);
      unwrap(r);
      refetch();
    } catch {}
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {t().nav.skills}
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
        >
          {t().skills.registerSkill}
        </Button>
      </Box>

      <Show when={!list.loading} fallback={<CircularProgress />}>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>{t().skills.slug}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.name}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().skills.gitUrl}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().skills.pkgs}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{t().common.actions}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <For each={(list() as any)?.skills || []}>
                {(skill: any) => (
                  <TableRow sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                    <TableCell sx={{ color: 'text.primary' }}>{skill.slug}</TableCell>
                    <TableCell sx={{ color: 'text.primary' }}>{skill.name}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{skill.gitUrl}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{skill.pkgs || "—"}</TableCell>
                    <TableCell>
                      <IconButton onClick={() => handleDelete(skill.slug)} color="error">
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
        <DialogTitle>{t().skills.registerSkill}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            autoFocus
            label={t().skills.slug}
            value={slug()}
            onChange={(_, v) => setSlug(v)}
            fullWidth
          />
          <TextField
            label={t().skills.gitUrl}
            value={gitUrl()}
            onChange={(_, v) => setGitUrl(v)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t().actions.cancel}</Button>
          <Button
            onClick={handleRegister}
            disabled={creating() || !slug().trim() || !gitUrl().trim()}
          >
            {t().actions.create}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
