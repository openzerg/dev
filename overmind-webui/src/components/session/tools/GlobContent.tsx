import { type Component, For, Show } from 'solid-js';
import { Box, Typography, Chip } from '@suid/material';

interface GlobContentProps {
  content: string;
  maxHeight?: number;
}

const GlobContent: Component<GlobContentProps> = (props) => {
  const files = () => {
    try {
      const data = JSON.parse(props.content);
      const list = data.files || data.matches || data.results || [];
      if (Array.isArray(list)) return list;
      if (typeof list === 'string') return list.split('\n').filter(Boolean);
      return [];
    } catch {
      return props.content.split('\n').filter(line => line.trim());
    }
  };

  const count = () => files().length;
  const pattern = () => {
    try {
      const data = JSON.parse(props.content);
      return data.pattern || data.glob || '';
    } catch {
      return '';
    }
  };

  return (
    <Box sx={{ maxHeight: props.maxHeight || 300, overflow: 'auto' }}>
      <Show when={pattern()}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          Pattern: {pattern()}
        </Typography>
      </Show>
      <Typography variant="caption" sx={{ color: '#34d399', mb: 0.5, display: 'block' }}>
        {count()} files found
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <For each={files().slice(0, 100)}>
          {(file) => (
            <Typography variant="caption" sx={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: 'text.secondary',
              pl: 1,
            }}>
              {typeof file === 'string' ? file : file.path || file.name || file}
            </Typography>
          )}
        </For>
      </Box>
      <Show when={count() > 100}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5 }}>
          ... and {count() - 100} more
        </Typography>
      </Show>
    </Box>
  );
};

export default GlobContent;
