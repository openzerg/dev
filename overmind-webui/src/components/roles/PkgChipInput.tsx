import { type Component, createSignal, For, Show } from "solid-js";
import { Box, TextField, Chip, Typography } from "@suid/material";

interface PkgChipInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

const PkgChipInput: Component<PkgChipInputProps> = (props) => {
  const [input, setInput] = createSignal("");

  function pkgs(): string[] {
    try {
      const parsed = JSON.parse(props.value || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p: unknown) => typeof p === "string");
    } catch {
      return [];
    }
  }

  function serialize(items: string[]): string {
    return JSON.stringify(items);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = input().trim();
    if (!v) return;
    const current = pkgs();
    if (current.includes(v)) return;
    props.onChange(serialize([...current, v]));
    setInput("");
  }

  function handleDelete(pkg: string) {
    props.onChange(serialize(pkgs().filter(p => p !== pkg)));
  }

  return (
    <Box>
      <Show when={props.label}>
        <Typography variant="body2" sx={{ mb: 0.5, color: "text.secondary" }}>
          {props.label}
        </Typography>
      </Show>
      <TextField
        size="small"
        fullWidth
        placeholder={props.placeholder || "Type package name and press Enter"}
        value={input()}
        onChange={(_, v) => setInput(v)}
        onKeyDown={handleKeyDown as any}
      />
      <Show when={pkgs().length > 0}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
          <For each={pkgs()}>
            {(pkg) => (
              <Chip
                label={pkg}
                size="small"
                onDelete={() => handleDelete(pkg)}
              />
            )}
          </For>
        </Box>
      </Show>
    </Box>
  );
};

export default PkgChipInput;
