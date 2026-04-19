import { type Component, createSignal, For, Show } from "solid-js";
import { Box, TextField, IconButton, Typography, Chip } from "@suid/material";
import Add from "@suid/icons-material/Add";
import Delete from "@suid/icons-material/Delete";

interface ZcpEntry {
  type: string;
  config?: Record<string, string>;
}

interface ZcpServerEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const ZcpServerEditor: Component<ZcpServerEditorProps> = (props) => {
  function entries(): ZcpEntry[] {
    try {
      const parsed = JSON.parse(props.value || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map((e: any) => {
        if (typeof e === "string") return { type: e };
        return { type: e.type || "", config: e.config };
      });
    } catch {
      return [];
    }
  }

  function serialize(items: ZcpEntry[]): string {
    return JSON.stringify(items);
  }

  function handleAdd() {
    const current = entries();
    props.onChange(serialize([...current, { type: "" }]));
  }

  function handleRemove(index: number) {
    const current = entries();
    props.onChange(serialize(current.filter((_, i) => i !== index)));
  }

  function updateType(index: number, newType: string) {
    const current = entries();
    current[index] = { ...current[index], type: newType };
    props.onChange(serialize(current));
  }

  function updateConfigKey(index: number, oldKey: string, newKey: string) {
    const current = entries();
    const cfg = { ...(current[index].config || {}) };
    if (oldKey !== newKey) {
      const val = cfg[oldKey];
      delete cfg[oldKey];
      cfg[newKey] = val || "";
    }
    current[index] = { ...current[index], config: cfg };
    props.onChange(serialize(current));
  }

  function updateConfigValue(index: number, key: string, newVal: string) {
    const current = entries();
    const cfg = { ...(current[index].config || {}) };
    cfg[key] = newVal;
    current[index] = { ...current[index], config: cfg };
    props.onChange(serialize(current));
  }

  function addConfigEntry(index: number) {
    const current = entries();
    const cfg = { ...(current[index].config || {}) };
    const newKey = `key${Object.keys(cfg).length + 1}`;
    cfg[newKey] = "";
    current[index] = { ...current[index], config: cfg };
    props.onChange(serialize(current));
  }

  function removeConfigEntry(index: number, key: string) {
    const current = entries();
    const cfg = { ...(current[index].config || {}) };
    delete cfg[key];
    current[index] = { ...current[index], config: cfg };
    if (Object.keys(cfg).length === 0) {
      const { config: _, ...rest } = current[index];
      current[index] = rest as ZcpEntry;
    }
    props.onChange(serialize(current));
  }

  return (
    <Box>
      <Show when={props.label}>
        <Typography variant="body2" sx={{ mb: 0.5, color: "text.secondary" }}>
          {props.label}
        </Typography>
      </Show>
      <For each={entries()}>
        {(entry, index) => (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              mb: 1,
              p: 1.5,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                size="small"
                placeholder="Server type (e.g. github)"
                value={entry.type}
                onChange={(_, v) => updateType(index(), v)}
                sx={{ flex: 1 }}
              />
              <IconButton size="small" onClick={() => handleRemove(index())} color="error">
                <Delete fontSize="small" />
              </IconButton>
            </Box>
            <For each={Object.entries(entry.config || {})}>
              {([key, val]) => (
                <Box sx={{ display: "flex", gap: 1, pl: 2, alignItems: "center" }}>
                  <TextField
                    size="small"
                    placeholder="key"
                    value={key}
                    onChange={(_, v) => updateConfigKey(index(), key, v)}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    size="small"
                    placeholder="value"
                    value={val}
                    onChange={(_, v) => updateConfigValue(index(), key, v)}
                    sx={{ flex: 1 }}
                  />
                  <IconButton size="small" onClick={() => removeConfigEntry(index(), key)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </For>
            <Chip
              label="+ config"
              size="small"
              variant="outlined"
              onClick={() => addConfigEntry(index())}
              sx={{ alignSelf: "flex-start", ml: 2 }}
            />
          </Box>
        )}
      </For>
      <Chip
        label="+ Add Server"
        size="small"
        variant="outlined"
        onClick={handleAdd}
        icon={<Add />}
      />
    </Box>
  );
};

export default ZcpServerEditor;
