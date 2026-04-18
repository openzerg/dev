import { type Component } from 'solid-js';
import { Box } from '@suid/material';

interface GenericContentProps {
  content: string;
  maxHeight?: number;
}

const GenericContent: Component<GenericContentProps> = (props) => {
  return (
    <Box sx={{ maxHeight: props.maxHeight || 300, overflow: 'auto' }}>
      <pre style={{
        margin: 0,
        padding: '8px',
        'border-radius': '4px',
        background: 'rgba(0,0,0,0.3)',
        'font-size': '0.75rem',
        'white-space': 'pre-wrap' as const,
        'word-break': 'break-all',
        color: 'var(--color-on-surface-variant)',
        'font-family': 'monospace',
      }}>
        {props.content}
      </pre>
    </Box>
  );
};

export default GenericContent;
