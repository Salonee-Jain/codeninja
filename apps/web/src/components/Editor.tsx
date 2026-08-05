'use client';

import Monaco, { loader, type Monaco as MonacoApi } from '@monaco-editor/react';
import { useTheme } from './ThemeProvider';

loader.config({ paths: { vs: '/monaco/vs' } });

const DARK_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'a78bfa' },
    { token: 'string', foreground: '34d399' },
    { token: 'number', foreground: 'fbbf24' },
    { token: 'type', foreground: '60a5fa' },
    { token: 'tag', foreground: '60a5fa' },
    { token: 'attribute.name', foreground: 'fdba74' },
  ],
  colors: {
    'editor.background': '#0b0e14',
    'editorGutter.background': '#0b0e14',
    'editor.lineHighlightBackground': '#141821',
    'editorLineNumber.foreground': '#39415a',
    'editorLineNumber.activeForeground': '#94a3b8',
    'editor.selectionBackground': '#1d4ed855',
    'editorWidget.background': '#141821',
    'editorSuggestWidget.background': '#141821',
  },
};

const LIGHT_THEME = {
  base: 'vs' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '94a3b8', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7c3aed' },
    { token: 'string', foreground: '059669' },
    { token: 'number', foreground: 'd97706' },
    { token: 'type', foreground: '2563eb' },
    { token: 'tag', foreground: '2563eb' },
    { token: 'attribute.name', foreground: 'ea580c' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editorGutter.background': '#ffffff',
    'editor.lineHighlightBackground': '#f8fafc',
    'editorLineNumber.foreground': '#cbd5e1',
    'editorLineNumber.activeForeground': '#64748b',
    'editor.selectionBackground': '#3b82f633',
    'editorWidget.background': '#f8fafc',
    'editorSuggestWidget.background': '#f8fafc',
  },
};

export interface EditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const Loading = () => (
  <div className="grid h-full place-items-center text-sm text-slate-500">Loading editor…</div>
);

export function Editor({ language, value, onChange, readOnly }: EditorProps) {
  const { theme } = useTheme();
  const themeName = theme === 'dark' ? 'ninja-dark' : 'ninja-light';

  return (
    <Monaco
      language={language}
      theme={themeName}
      value={value}
      onChange={(v) => onChange(v ?? '')}
      loading={<Loading />}
      beforeMount={(monaco: MonacoApi) => {
        monaco.editor.defineTheme('ninja-dark', DARK_THEME);
        monaco.editor.defineTheme('ninja-light', LIGHT_THEME);
        monaco.languages.typescript?.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: true,
          noSyntaxValidation: false,
        });
      }}
      options={{
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 12, bottom: 12 },
        smoothScrolling: true,
        renderLineHighlight: 'gutter',
        lineNumbersMinChars: 3,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
        readOnly,
        wordWrap: 'on',
      }}
    />
  );
}
