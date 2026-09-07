import { useState } from 'react'
import { Button, DisclosureRow, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CacheAttemptSummary, CapturedGenerateInput } from '../types.ts'
import { inferenceFor } from './dashboard-state.ts'
import type { Translate } from './locales.ts'

export function InputInspector({ data, item, t }: { data: CapturedGenerateInput; item: CacheAttemptSummary; t: Translate }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['$']))
  const [expandAll, setExpandAll] = useState(false)
  const [status, setStatus] = useState('')
  async function copy() {
    try { const accepted = await writeClipboard(JSON.stringify(data, null, 2)); setStatus(t(accepted ? 'copied' : 'copyFailed')) }
    catch { setStatus(t('copyFailed')) }
  }
  function render(value: unknown, path: string, label: string) {
    const inference = inferenceFor(item, path)
    const entries = value !== null && typeof value === 'object' ? Object.entries(value) : null
    const open = expanded.has(path) !== expandAll
    const preview = entries ? `${Array.isArray(value) ? '[]' : '{}'} ${entries.length}` : JSON.stringify(value)
    return <div key={path} className="cs-tree-node" data-inference={inference}>
      <DisclosureRow icon={<span className="cs-tree-dot" />} title={label} open={open} expandable={!!entries?.length} expandOnRowClick
        onToggle={() => setExpanded(old => { const next = new Set(old); next.has(path) ? next.delete(path) : next.add(path); return next })}
        collapsedContent={<span className="cs-tree-value">{preview}{inference && <span className="cs-inference-label">{t(inference)}</span>}</span>} keepContentWhenOpen>
        {entries && open && <div className="cs-tree-children">{entries.map(([key, child]) => render(child, Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, key))}</div>}
      </DisclosureRow>
    </div>
  }
  return <div className="cs-input-inspector">
    <div className="cs-toolbar"><Button size="sm" onClick={() => { setExpandAll(true); setExpanded(new Set()) }}>{t('expand')}</Button><Button size="sm" onClick={() => { setExpandAll(false); setExpanded(new Set()) }}>{t('collapse')}</Button><Button size="sm" onClick={() => { void copy() }}>{t('copyInput')}</Button><span role="status">{status}</span></div>
    <div className="cs-legend">{(['stable', 'changed', 'downstream', 'unknown'] as const).map(kind => <span key={kind} data-inference={kind}>{t(kind)}</span>)}</div>
    {render(data, '$', '$')}
  </div>
}
