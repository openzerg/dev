import { type Component, For, Show } from 'solid-js';
import { Box, Typography } from '@suid/material';
import FolderOutlined from '@suid/icons-material/FolderOutlined';
import DescriptionOutlined from '@suid/icons-material/DescriptionOutlined';

interface LsContentProps {
  content: string;
  maxHeight?: number;
}

interface LsEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
}

const LsContent: Component<LsContentProps> = (props) => {
  const entries = (): LsEntry[] => {
    try {
      const data = JSON.parse(props.content);
      const list = data.entries || data.files || data.items || [];
      if (Array.isArray(list)) {
        return list.map(item => {
          if (typeof item === 'string') {
            return { name: item, type: item.endsWith('/') ? 'directory' : 'file' };
          }
          return {
            name: item.name || item.path || '',
            type: item.type || (item.isDirectory ? 'directory' : 'file'),
            size: item.size,
          };
        });
      }
      return [];
    } catch {
      return props.content.split('\n').filter(Boolean).map(line => ({
        name: line.trim(),
        type: line.trim().endsWith('/') ? 'directory' : 'file',
      }));
    }
  };

  const count = () => entries().length;
  const dirs = () => entries().filter(e => e.type === 'directory').length;
  const files = () => entries().filter(e => e.type === 'file').length;

  return (
    <Box sx={{ maxHeight: props.maxHeight || 300, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#60a5fa' }}>
          {dirs()} dirs
        </Typography>
        <Typography variant="caption" sx={{ color: '#34d399' }}>
          {files()} files
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <For each={entries()}>
          {(entry) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 0.5 }}>
              {entry.type === 'directory' 
                ? <FolderOutlined sx={{ fontSize: 14, color: '#60a5fa' }} />
                : <DescriptionOutlined sx={{ fontSize: 14, color: 'text.secondary' }} />
              }
              <Typography variant="caption" sx={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                color: entry.type === 'directory' ? '#60a5fa' : 'text.secondary',
              }}>
                {entry.name}
              </Typography>
            </Box>
          )}
        </For>
      </Box>
    </Box>
  );
};

export default LsContent;
