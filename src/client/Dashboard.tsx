import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button, Input, Menu, JsonTree, writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import { plugin } from '../contracts.ts'
import type { CacheAttemptSummary, CapturedInputSnapshot, DiagnosticsSnapshot } from '../types.ts'
import { summarizeAttempts } from '../summary.ts'
import { evolution, filterAttempts, initialFilters, type Filters } from './dashboard-state.ts'
import { InputInspector } from './InputInspector.tsx'
import type { SettingsScope } from './host.ts'
import { query, QueryError } from './api.ts'
import type { TextKey, Translate } from './locales.ts'

function Choice({ label, value, choices, change }: { label: string; value: string; choices: [string, string][]; change: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  return <Menu open={open} onClose={() => setOpen(false)} selectedId={value} onSelect={id => { change(id); setOpen(false) }} portal
    anchor={<Button size="sm" variant="outline" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}>{label}: {choices.find(([key]) => key === value)?.[1]}</Button>}
    items={choices.map(([id, label]) => ({ id, label }))} />
}
const number = (value?: number) => value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
const percent = (value?: number) => value === undefined ? '—' : `${number(value * 100)}%`

export function Dashboard({ scope, t }: { scope: SettingsScope; t: Translate }) {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null)
  const [filters, setFilters] = useState<Filters>({ ...initialFilters })
  const [selected, setSelected] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [follow, setFollow] = useState(true)
  const [focused, setFocused] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState<TextKey | null>(null)
  const [copyStatus, setCopyStatus] = useState('')
  const settings = useSyncExternalStore(cb => scope.subscribe(cb), () => scope.getSnapshot())
  const [raw, setRaw] = useState<CapturedInputSnapshot | null>(null)
  const [rawError, setRawError] = useState<TextKey | null>(null)
  const [retryInput, setRetryInput] = useState(0)
  const rawGeneration = useRef(0)
  const attempts = snapshot?.attempts ?? []
  const visible = filterAttempts(attempts, filters)
  const newest = visible.reduce<CacheAttemptSummary | undefined>((a, b) => !a || a.sequence < b.sequence ? b : a, undefined)
  const item = follow ? newest : visible.find(a => a.id === selected) ?? visible[0]
  const canShowRaw = settings.status === 'ready' && settings.value?.captureInput === 'full' && snapshot?.captureInput === 'full' && item?.rawState === 'available'

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const controller = new AbortController()
    async function load() {
      try {
        const next = await query<DiagnosticsSnapshot>(plugin.dataPath, controller.signal)
        if (controller.signal.aborted) return
        setSnapshot(next); setError(null)
        if (!paused) timer = setTimeout(() => { void load() }, next.refreshMs)
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof QueryError ? error.key : 'fetchFailed')
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [paused, refresh, settings.value?.recordingEnabled, settings.value?.captureInput])

  useEffect(() => {
    const generation = ++rawGeneration.current
    const controller = new AbortController()
    setRaw(null); setRawError(null)
    if (canShowRaw && item) {
      void query<CapturedInputSnapshot>(`${plugin.inputPath}?id=${encodeURIComponent(item.id)}`, controller.signal).then(next => {
        if (!controller.signal.aborted && generation === rawGeneration.current) setRaw(next)
      }).catch(error => {
        if (!controller.signal.aborted) setRawError(error instanceof QueryError ? error.key : 'inputFailed')
      })
    }
    return () => { rawGeneration.current++; controller.abort() }
  }, [item?.id, item?.input.overallFingerprint, item?.rawState, canShowRaw, retryInput])

  const summary = summarizeAttempts(visible)
  const prior = attempts.find(a => a.id === item?.diagnosis.comparedTo)
  const change = evolution(item?.usage, prior?.usage)
  const dictionaryChoices = (keys: TextKey[]) => keys.map(key => [key, t(key)] as [string, string])
  const setFilter = (key: keyof Filters, value: string) => setFilters(old => ({ ...old, [key]: value }))
  async function copyMetadata() {
    try { const accepted = await writeClipboard(JSON.stringify({ generatedAt: snapshot?.generatedAt, filters, scope: { captureInput: snapshot?.captureInput, includeAuxiliary: snapshot?.includeAuxiliary }, summary, attempts: visible, notes: snapshot?.notes }, null, 2)); setCopyStatus(t(accepted ? 'copied' : 'copyFailed')) }
    catch { setCopyStatus(t('copyFailed')) }
  }
  const jsonLabels = { copyValue: t('copyValue'), copyJson: t('copyJson'), copyPath: t('copyPath'), copyPrettyJson: t('copyPrettyJson'), copyCompactJson: t('copyCompactJson'), copied: t('copied'), copyFailed: t('copyFailed'), collapseNode: t('collapseNode'), expandNode: t('expandNode'), copyButtonTitle: (action: string) => action }
  return <section className="cs-dashboard" aria-label={t('title')}>
    <div className="cs-toolbar">
      <span className="cs-recording" data-enabled={settings.value?.recordingEnabled ?? snapshot?.recordingEnabled}>{t((settings.value?.recordingEnabled ?? snapshot?.recordingEnabled) ? 'recordingOn' : 'recordingOff')}</span>
      <Button size="sm" onClick={() => setRefresh(n => n + 1)}>{t('refresh')}</Button>
      <Button size="sm" onClick={() => setPaused(!paused)}>{t(paused ? 'resume' : 'pause')}</Button>
      <Button size="sm" aria-pressed={follow} onClick={() => setFollow(!follow)}>{t('follow')}</Button>
      <Button size="sm" disabled={!snapshot} onClick={() => { void copyMetadata() }}>{t('copyMetadata')}</Button><span role="status">{copyStatus}</span>
    </div>
    {error && <p role="alert">{t(error)}</p>}
    {!snapshot ? <p>{t(error ? 'fetchFailed' : 'loading')}</p> : <>
      <div className="cs-metrics">
        {[[t('selectedRatio'), percent(item?.usage?.cacheReadRatio)], [t('weightedRatio'), percent(summary.cacheReadRatio)], [t('timing'), `${number(summary.medianFirstTokenMs)} / ${number(summary.p95FirstTokenMs)} ms`], [t('count'), number(summary.attemptCount)], [t('prefixRatio'), percent(summary.prefixFriendlyRatio)], [t('cost'), summary.estimatedCost ? `${summary.estimatedCost.currency} ${summary.estimatedCost.amount.toFixed(5)}` : t('noPrice')]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="cs-filters">
        <Input type="search" aria-label={t('query')} placeholder={t('query')} value={filters.query} onChange={event => setFilter('query', event.target.value)} />
        {(['sessionId', 'provider', 'model'] as const).map(key => <Choice key={key} label={t(key)} value={filters[key]} choices={[[ '', t('all') ], ...[...new Set(attempts.map(a => a[key]).filter((v): v is string => !!v))].map(v => [v, v] as [string, string])]} change={value => setFilter(key, value)} />)}
        <Choice label={t('purpose')} value={filters.purpose} choices={[[ '', t('all') ], ...dictionaryChoices(['conversation', 'compaction', 'session-title', 'direct'])]} change={v => setFilter('purpose', v)} />
        <Choice label={t('status')} value={filters.status} choices={[[ '', t('all') ], ...dictionaryChoices(['running', 'completed', 'failed', 'cancelled', 'consumer-stopped', 'incomplete', 'recording-stopped'])]} change={v => setFilter('status', v)} />
        <Choice label={t('evidence')} value={filters.evidence} choices={[[ '', t('all') ], ...dictionaryChoices(['friendly-read', 'friendly-zero', 'changed-read', 'changed-zero', 'unresolved'])]} change={v => setFilter('evidence', v)} />
        <Choice label={t('sort')} value={filters.sort} choices={dictionaryChoices(['newest', 'oldest', 'cache-desc', 'ttft-desc'])} change={v => setFilter('sort', v)} />
      </div>
      <p className="cs-note">{t('evidenceNote')}</p>
      {!item ? <p className="cs-empty">{t('empty')}</p> : <>
        <Button size="sm" onClick={() => setFocused(!focused)}>{t(focused ? 'unfocus' : 'focused')}</Button>
        <div className="cs-workspace" data-focused={focused}>
          {!focused && <div className="cs-call-list"><table><thead><tr>{(['call', 'model', 'read', 'ttft', 'status'] as const).map(key => <th key={key}>{t(key)}</th>)}</tr></thead><tbody>{visible.map(call => <tr key={call.id} data-selected={item.id === call.id}><td><button type="button" aria-pressed={item.id === call.id} onClick={() => { setSelected(call.id); setFollow(false) }}>{call.id}</button></td><td>{call.model}</td><td>{percent(call.usage?.cacheReadRatio)}</td><td>{number(call.firstTokenMs)}</td><td>{t(call.status)}</td></tr>)}</tbody></table></div>}
          <div className="cs-detail" aria-label={t('detail')}>
            <h3>{item.id} · {item.provider} / {item.model}</h3><p>{item.sessionId} · {t(item.purpose)} · {t(item.status)} · {new Date(item.startedAt).toLocaleString()}</p>
            <dl className="cs-token-grid">{([[ 'prompt', item.usage?.promptTokens ], ['read', item.usage?.cacheReadTokens], ['write', item.usage?.cacheWriteTokens], ['uncached', item.usage?.inputTokens], ['output', item.usage?.outputTokens], ['ttft', item.firstTokenMs], ['duration', item.durationMs]] as const).map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{value === undefined ? t('missing') : number(value)}</dd></div>)}</dl>
            <h4>{t('diagnosis')}</h4><p>{t(item.diagnosis.kind)}{item.diagnosis.comparedTo && ` · ${t('baseline')} ${item.diagnosis.comparedTo}`}</p>
            <h4>{t('evolution')}</h4>{'unavailable' in change ? <p>{t(change.unavailable!)}</p> : <><p className="cs-equation">{number(change.previous)} + ({number(change.prompt)}) − ({number(change.read)}) − ({number(change.write)}) = {number(change.current)}</p><p>{t('equation')}</p></>}
            <details><summary>{t('metadata')}</summary><JsonTree data={{ ...item.input, diagnosis: item.diagnosis }} label={t('metadata')} labels={jsonLabels} copyable /></details>
            <h4>{t('input')}</h4>
            {!canShowRaw ? <p>{t(item.rawState === 'available' ? 'disabled' : item.rawState)}</p> : rawError ? <p role="alert">{t(rawError)} <Button size="sm" onClick={() => setRetryInput(n => n + 1)}>{t('retry')}</Button></p> : raw?.id === item.id && raw.rawInput ? <InputInspector key={`${item.id}|${item.input.overallFingerprint}`} data={raw.rawInput} item={item} t={t} /> : raw ? <p>{t(raw.rawState)}</p> : <p>{t('loading')}</p>}
          </div>
        </div>
      </>}
      <details className="cs-correlation"><summary>{t('correlation')}</summary><dl className="cs-token-grid">{([['friendly-read', summary.correlation.prefixFriendlyWithRead], ['friendly-zero', summary.correlation.prefixFriendlyWithoutRead], ['changed-read', summary.correlation.prefixChangedWithRead], ['changed-zero', summary.correlation.prefixChangedWithoutRead]] as const).map(([key, count]) => <div key={key}><dt>{t(key)}</dt><dd>{count}</dd></div>)}</dl></details>
      <p className="cs-note">{t('timingNote')}</p>
    </>}
  </section>
}
