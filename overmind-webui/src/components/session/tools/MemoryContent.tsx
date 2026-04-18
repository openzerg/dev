import { type Component, For, Show } from 'solid-js';
import { Box, Typography, Chip } from '@suid/material';
import StorageOutlined from '@suid/icons-material/StorageOutlined';
import hljs from 'highlight.js';

interface MemoryContentProps {
  content: string;
  maxHeight?: number;
}

interface MemoryEntry {
  filename?: string;
  content?: string;
  bytes?: number;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    bytes?: number;
    created_at?: string;
    updated_at?: string;
  };
}

interface MemoryList {
  files?: string[];
  filenames?: string[];
}

const MemoryContent: Component<MemoryContentProps> = (props) => {
  const parsed = (): MemoryEntry | MemoryList => {
    try {
      return JSON.parse(props.content);
    } catch {
      return { content: props.content };
    }
  };

  const isList = (): boolean => {
    const data = parsed();
    if ('files' in data) return Array.isArray(data.files);
    if ('filenames' in data) return Array.isArray(data.filenames);
    return false;
  };

  const files = (): string[] => {
    const data = parsed();
    if ('files' in data && Array.isArray(data.files)) return data.files;
    if ('filenames' in data && Array.isArray(data.filenames)) return data.filenames;
    return [];
  };

  const entry = (): MemoryEntry => {
    const data = parsed();
    if ('content' in data) {
      return {
        filename: data.filename,
        content: data.content || props.content,
        bytes: data.bytes || data.metadata?.bytes || (data.content?.length || 0),
        created_at: data.created_at || data.metadata?.created_at,
        updated_at: data.updated_at || data.metadata?.updated_at,
      };
    }
    return { content: props.content };
  };

  const highlighted = () => {
    const content = entry().content || '';
    try {
      return hljs.highlight(content, { language: 'markdown' }).value;
    } catch {
      return content;
    }
  };

  if (isList()) {
    return (
      <Box sx={{ maxHeight: props.maxHeight || 300, overflow: 'auto' }}>
        <Typography variant="caption" sx={{ color: '#34d399', mb: 0.5, display: 'block' }}>
          {files().length} memory files
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <For each={files()}>
            {(file) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <StorageOutlined sx={{ fontSize: 14, color: '#60a5fa' }} />
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                  {file}
                </Typography>
              </Box>
            )}
          </For>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxHeight: props.maxHeight || 400, overflow: 'auto' }}>
      <Show when={entry().filename}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <StorageOutlined sx={{ fontSize: 14, color: '#60a5fa' }} />
          <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
            {entry().filename}
          </Typography>
          <Typography variant="caption" sx={{ color: '#34d399' }}>
            {entry().bytes} bytes
          </Typography>
        </Box>
      </Show>
      <pre class="hljs" style={{
        margin: 0, padding: '8px 12px', 'border-radius': '4px',
        background: 'rgba(0,0,0,0.4)', 'font-size': '0.7rem', 'line-height': 1.4,
        'white-space': 'pre-wrap', 'overflow-x': 'auto',
      }}>
        <code innerHTML={highlighted()} />
      </pre>
    </Box>
  );
};

export default MemoryContent;
