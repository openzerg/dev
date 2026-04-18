import { type Component, Show } from 'solid-js';
import { Box, Typography } from '@suid/material';
import hljs from 'highlight.js';

interface DiffContentProps {
  content: string;
  maxHeight?: number;
}

const DiffContent: Component<DiffContentProps> = (props) => {
  const highlightedDiff = () => {
    try {
      return hljs.highlight(props.content, { language: 'diff' }).value;
    } catch {
      return props.content;
    }
  };

  const stats = () => {
    const lines = props.content.split('\n');
    const added = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
    const removed = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
    return { added, removed };
  };

  const fileName = () => {
    const match = props.content.match(/^---\s+(?:a\/)?(.+)$/m);
    return match ? match[1] : null;
  };

  return (
    <Box sx={{ maxHeight: props.maxHeight || 300, overflow: 'auto' }}>
      <Show when={fileName()}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          {fileName()}
        </Typography>
      </Show>
      <Show when={stats().added > 0 || stats().removed > 0}>
        <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#34d399' }}>
            +{stats().added}
          </Typography>
          <Typography variant="caption" sx={{ color: '#f87171' }}>
            -{stats().removed}
          </Typography>
        </Box>
      </Show>
      <pre 
        class="hljs diff-content"
        style={{
          margin: 0,
          padding: '8px 12px',
          'border-radius': '4px',
          background: 'rgba(0,0,0,0.4)',
          'font-size': '0.75rem',
          'line-height': 1.5,
          'white-space': 'pre',
          'overflow-x': 'auto',
        }}
      >
        <code innerHTML={highlightedDiff()} />
      </pre>
    </Box>
  );
};

export default DiffContent;
