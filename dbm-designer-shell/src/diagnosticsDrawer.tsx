import { Suspense, lazy } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Tabs from '@radix-ui/react-tabs';

const MonacoEditor = lazy(async () => {
  const module = await import('@monaco-editor/react');
  return {
    default: module.default
  };
});

interface DiagnosticsDrawerProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  modelText: string;
  workspaceText: string;
  graphText: string;
}

function DiagnosticsEditor({ value, path }: { value: string; path: string }) {
  return (
    <div style={editorSurfaceStyle}>
      <div style={editorPathStyle}>{path}</div>
      <div style={editorFrameStyle}>
        <Suspense fallback={<div style={editorFallbackStyle}>Loading diagnostics editor...</div>}>
          <MonacoEditor
            theme="vs-light"
            language="json"
            path={path}
            value={value}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              wordWrap: 'on',
              lineNumbersMinChars: 3,
              automaticLayout: true
            }}
            height="58vh"
          />
        </Suspense>
      </div>
    </div>
  );
}

export function DiagnosticsDrawer({
  open,
  onOpenChange,
  modelText,
  workspaceText,
  graphText
}: DiagnosticsDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={contentStyle}>
          <div style={headerStyle}>
            <div>
              <div style={eyebrowStyle}>Advanced Diagnostics</div>
              <Dialog.Title style={titleStyle}>Canonical And Derived Contracts</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" style={closeButtonStyle}>
                Close
              </button>
            </Dialog.Close>
          </div>

          <Tabs.Root defaultValue="model" style={tabsRootStyle}>
            <Tabs.List style={tabsListStyle}>
              <Tabs.Trigger value="model" style={tabsTriggerStyle}>
                Canonical Model
              </Tabs.Trigger>
              <Tabs.Trigger value="workspace" style={tabsTriggerStyle}>
                Workspace Sidecar
              </Tabs.Trigger>
              <Tabs.Trigger value="graph" style={tabsTriggerStyle}>
                Derived Graph
              </Tabs.Trigger>
            </Tabs.List>

            <ScrollArea.Root style={scrollRootStyle}>
              <ScrollArea.Viewport style={scrollViewportStyle}>
                <Tabs.Content value="model" style={tabsContentStyle}>
                  <DiagnosticsEditor value={modelText} path="model.json" />
                </Tabs.Content>
                <Tabs.Content value="workspace" style={tabsContentStyle}>
                  <DiagnosticsEditor value={workspaceText} path="model.workspace.json" />
                </Tabs.Content>
                <Tabs.Content value="graph" style={tabsContentStyle}>
                  <DiagnosticsEditor value={graphText} path="model.graph.derived.json" />
                </Tabs.Content>
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar orientation="vertical" style={scrollbarStyle}>
                <ScrollArea.Thumb style={thumbStyle} />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.42)',
  backdropFilter: 'blur(4px)',
  zIndex: 40
} as const;

const contentStyle = {
  position: 'fixed',
  inset: '5vh 4vw',
  zIndex: 41,
  borderRadius: '1.35rem',
  background: '#fffdf8',
  border: '1px solid #e7e5e4',
  boxShadow: '0 28px 60px rgba(15, 23, 42, 0.24)',
  padding: '1.25rem',
  display: 'grid',
  gap: '1rem'
} as const;

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'flex-start'
} as const;

const eyebrowStyle = {
  fontSize: '0.74rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b'
} as const;

const titleStyle = {
  margin: '0.3rem 0 0',
  fontSize: '1.45rem'
} as const;

const closeButtonStyle = {
  padding: '0.72rem 1rem',
  borderRadius: '0.9rem',
  border: '1px solid #cbd5e1',
  background: '#fff',
  cursor: 'pointer'
} as const;

const tabsRootStyle = {
  display: 'grid',
  gap: '1rem',
  minHeight: 0
} as const;

const tabsListStyle = {
  display: 'flex',
  gap: '0.75rem'
} as const;

const tabsTriggerStyle = {
  padding: '0.62rem 0.9rem',
  borderRadius: '0.85rem',
  border: '1px solid #d6d3d1',
  background: '#fff',
  cursor: 'pointer'
} as const;

const scrollRootStyle = {
  minHeight: 0
} as const;

const scrollViewportStyle = {
  height: '100%'
} as const;

const scrollbarStyle = {
  display: 'flex',
  touchAction: 'none',
  userSelect: 'none',
  padding: '2px'
} as const;

const thumbStyle = {
  flex: 1,
  background: '#cbd5e1',
  borderRadius: '999px'
} as const;

const tabsContentStyle = {
  outline: 'none'
} as const;

const editorSurfaceStyle = {
  display: 'grid',
  gap: '0.75rem'
} as const;

const editorPathStyle = {
  fontFamily: '"Cascadia Code", "Consolas", monospace',
  fontSize: '0.83rem',
  color: '#475569'
} as const;

const editorFrameStyle = {
  borderRadius: '1rem',
  border: '1px solid #d6d3d1',
  overflow: 'hidden'
} as const;

const editorFallbackStyle = {
  minHeight: '58vh',
  display: 'grid',
  placeItems: 'center',
  color: '#64748b'
} as const;
