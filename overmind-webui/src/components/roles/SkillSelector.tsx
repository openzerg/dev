import { type Component, createSignal, For, Show, createResource } from "solid-js";
import { Box, Chip, Typography, CircularProgress } from "@suid/material";
import { getSkillManager } from "~/lib/clients";

interface SkillSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const SkillSelector: Component<SkillSelectorProps> = (props) => {
  const [available] = createResource(async () => {
    try {
      const sm = getSkillManager();
      const r = await sm.listSkills();
      if (r.isErr()) return [] as { slug: string; name: string }[];
      return (r.value.skills || []).map((s: any) => ({
        slug: s.slug,
        name: s.name || s.slug,
      }));
    } catch {
      return [] as { slug: string; name: string }[];
    }
  });

  function selected(): string[] {
    try {
      const parsed = JSON.parse(props.value || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map((p: any) =>
        typeof p === "string" ? p : p.slug
      );
    } catch {
      return [];
    }
  }

  function serialize(slugs: string[]): string {
    return JSON.stringify(slugs);
  }

  function toggle(slug: string) {
    const current = selected();
    if (current.includes(slug)) {
      props.onChange(serialize(current.filter(s => s !== slug)));
    } else {
      props.onChange(serialize([...current, slug]));
    }
  }

  return (
    <Box>
      <Show when={props.label}>
        <Typography variant="body2" sx={{ mb: 0.5, color: "text.secondary" }}>
          {props.label}
        </Typography>
      </Show>
      <Show when={selected().length > 0}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          <For each={selected()}>
            {(slug) => (
              <Chip
                label={slug}
                size="small"
                color="primary"
                onDelete={() => toggle(slug)}
              />
            )}
          </For>
        </Box>
      </Show>
      <Show when={available.loading}>
        <CircularProgress size={20} />
      </Show>
      <Show when={!available.loading && (available() || []).length > 0}>
        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
          Available:
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          <For each={available() || []}>
            {(skill) => {
              const isSelected = () => selected().includes(skill.slug);
              return (
                <Chip
                  label={skill.name}
                  size="small"
                  variant={isSelected() ? "filled" : "outlined"}
                  color={isSelected() ? "primary" : "default"}
                  onClick={() => toggle(skill.slug)}
                />
              );
            }}
          </For>
        </Box>
      </Show>
      <Show when={!available.loading && (available() || []).length === 0}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          No skills registered
        </Typography>
      </Show>
    </Box>
  );
};

export default SkillSelector;
