import type { CacheAttemptSummary, CacheUsage } from '../types.ts'
export type Evidence = '' | 'friendly-read' | 'friendly-zero' | 'changed-read' | 'changed-zero' | 'unresolved'
export interface Filters { query: string; sessionId: string; provider: string; model: string; purpose: string; status: string; evidence: Evidence; sort: string }
export const initialFilters: Filters = { query: '', sessionId: '', provider: '', model: '', purpose: 'conversation', status: '', evidence: '', sort: 'newest' }
export function evidenceOf(item: CacheAttemptSummary): Exclude<Evidence, ''> {
  const kind = item.diagnosis.kind
  if (kind === 'first-observation' || kind === 'route-or-options-changed' || item.usage?.cacheReadTokens === undefined) return 'unresolved'
  const friendly = kind === 'identical-input' || kind === 'append-only'
  return friendly ? item.usage.cacheReadTokens > 0 ? 'friendly-read' : 'friendly-zero' : item.usage.cacheReadTokens > 0 ? 'changed-read' : 'changed-zero'
}
export function filterAttempts(attempts: readonly CacheAttemptSummary[], filters: Filters): CacheAttemptSummary[] {
  const query = filters.query.trim().toLowerCase()
  const items = attempts.filter(item =>
    ['sessionId', 'provider', 'model', 'purpose', 'status'].every(key => !filters[key as keyof Filters] || item[key as 'model'] === filters[key as keyof Filters])
    && (!query || [item.id, item.sessionId, item.provider, item.model].join(' ').toLowerCase().includes(query))
    && (!filters.evidence || evidenceOf(item) === filters.evidence))
  return items.sort((a, b) => {
    if (filters.sort === 'oldest') return a.sequence - b.sequence
    if (filters.sort === 'cache-desc') return (b.usage?.cacheReadRatio ?? -1) - (a.usage?.cacheReadRatio ?? -1) || b.sequence - a.sequence
    if (filters.sort === 'ttft-desc') return (b.firstTokenMs ?? -1) - (a.firstTokenMs ?? -1) || b.sequence - a.sequence
    return b.sequence - a.sequence
  })
}
export type Inference = 'stable' | 'changed' | 'downstream' | 'unknown'
/** Deterministic comparison of structural paths and previously calculated prefix lengths. */
export function inferenceFor(item: CacheAttemptSummary, path: string): Inference | undefined {
  const d = item.diagnosis
  const message = /^\$\.messages\[(\d+)\]$/.exec(path)
  const tool = /^\$\.tools\[(\d+)\]$/.exec(path)
  if (!['$.system', '$.tools', '$.messages'].includes(path) && !message && !tool) return undefined
  if (d.kind === 'first-observation' || d.kind === 'route-or-options-changed') return 'unknown'
  if (path === '$.system') return d.systemStable === false ? 'changed' : 'stable'
  if (d.systemStable === false) return 'downstream'
  if (path === '$.tools') return d.previousToolCount === item.input.toolCount && d.stableToolCount === item.input.toolCount ? 'stable' : 'changed'
  if (tool) {
    const index = Number(tool[1])
    return index < d.stableToolCount ? 'stable' : index >= (d.previousToolCount ?? 0) || index === d.stableToolCount ? 'changed' : 'downstream'
  }
  if (d.previousToolCount !== item.input.toolCount || d.stableToolCount !== item.input.toolCount) return 'downstream'
  if (path === '$.messages') return d.previousMessageCount === item.input.messageCount && d.stableMessageCount === item.input.messageCount ? 'stable' : 'changed'
  const index = Number(message![1])
  return index < d.stableMessageCount ? 'stable' : index >= (d.previousMessageCount ?? 0) || index === d.stableMessageCount ? 'changed' : 'downstream'
}
export function evolution(current?: CacheUsage, previous?: CacheUsage) {
  if (!current || !previous) return { unavailable: 'noBaseline' as const }
  if (current.cacheReadTokens === undefined || previous.cacheReadTokens === undefined) return { unavailable: 'noRead' as const }
  if ((current.cacheWriteTokens === undefined) !== (previous.cacheWriteTokens === undefined)) return { unavailable: 'noWrite' as const }
  return { previous: previous.inputTokens, prompt: current.promptTokens - previous.promptTokens, read: current.cacheReadTokens - previous.cacheReadTokens, write: (current.cacheWriteTokens ?? 0) - (previous.cacheWriteTokens ?? 0), current: current.inputTokens }
}
