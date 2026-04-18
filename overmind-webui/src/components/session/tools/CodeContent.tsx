import { type Component, Show, createMemo } from 'solid-js';
import { Box } from '@suid/material';
import hljs from 'highlight.js';

interface CodeContentProps {
  content: string;
  filePath?: string;
  maxHeight?: number;
}

const CodeContent: Component<CodeContentProps> = (props) => {
  const getLanguage = () => {
    if (!props.filePath) return 'plaintext';
    const ext = props.filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      swift: 'swift',
      kt: 'kotlin',
      scala: 'scala',
      sql: 'sql',
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      html: 'html',
      css: 'css',
      scss: 'scss',
      sass: 'sass',
      less: 'less',
      md: 'markdown',
      markdown: 'markdown',
      dockerfile: 'dockerfile',
      makefile: 'makefile',
      toml: 'toml',
      ini: 'ini',
      cfg: 'ini',
      conf: 'ini',
    };
    return langMap[ext || ''] || 'plaintext';
  };

  const contentWithLineNumbers = createMemo(() => {
    const lines = props.content.split('\n');
    return lines.map((line, idx) => `${idx + 1}: ${line}`).join('\n');
  });

  const highlightedContent = () => {
    const lang = getLanguage();
    const content = props.filePath?.includes(':') ? props.content : contentWithLineNumbers();
    try {
      if (lang === 'plaintext') return content;
      return hljs.highlight(content, { language: lang }).value;
    } catch {
      return content;
    }
  };

  return (
    <Box sx={{ maxHeight: props.maxHeight || 400, overflow: 'auto' }}>
      <pre 
        class="hljs"
        style={{
          margin: 0,
          padding: '8px 12px',
          'border-radius': '4px',
          background: 'rgba(0,0,0,0.4)',
          'font-size': '0.7rem',
          'line-height': 1.4,
          'white-space': 'pre',
          'overflow-x': 'auto',
        }}
      >
        <code innerHTML={highlightedContent()} />
      </pre>
    </Box>
  );
};

export default CodeContent;
