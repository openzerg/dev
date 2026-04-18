import { type Component, Show } from 'solid-js';
import { Box, Typography } from '@suid/material';
import hljs from 'highlight.js';

interface WriteContentProps {
  content: string;
  filePath?: string;
  maxHeight?: number;
}

const WriteContent: Component<WriteContentProps> = (props) => {
  const parsed = () => {
    try {
      const data = JSON.parse(props.content);
      return {
        bytes: data.bytes || data.metadata?.bytes || 0,
        lines: data.lines || (data.output?.split('\n').length) || 0,
        output: data.output || props.content,
      };
    } catch {
      return { bytes: props.content.length, lines: props.content.split('\n').length, output: props.content };
    }
  };

  const getLanguage = () => {
    if (!props.filePath) return 'plaintext';
    const ext = props.filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', go: 'go', rs: 'rust', java: 'java', c: 'c', cpp: 'cpp',
      json: 'json', yaml: 'yaml', yml: 'yaml', md: 'markdown', sh: 'bash',
      sql: 'sql', html: 'html', css: 'css', scss: 'scss', toml: 'toml',
    };
    return langMap[ext || ''] || 'plaintext';
  };

  const contentWithLineNumbers = () => {
    return parsed().output;
  };

  const highlighted = () => {
    const lang = getLanguage();
    const content = contentWithLineNumbers();
    try {
      if (lang === 'plaintext') return content;
      return hljs.highlight(content, { language: lang }).value;
    } catch {
      return content;
    }
  };

  return (
    <Box sx={{ maxHeight: props.maxHeight || 400, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#34d399' }}>
          {parsed().bytes} bytes
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {parsed().lines} lines
        </Typography>
      </Box>
      <pre class="hljs" style={{
        margin: 0, padding: '8px 12px', 'border-radius': '4px',
        background: 'rgba(0,0,0,0.4)', 'font-size': '0.7rem', 'line-height': 1.4,
        'white-space': 'pre', 'overflow-x': 'auto',
      }}>
        <code innerHTML={highlighted()} />
      </pre>
    </Box>
  );
};

export default WriteContent;
