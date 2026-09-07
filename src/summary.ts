import type { CacheAttemptSummary, DiagnosticsSummary, EvidenceCorrelation } from './types.ts'
function roundedMilliseconds(value: number): number { return Math.round(value * 10) / 10 }
function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  values.sort((a, b) => a - b)
  const middle = Math.floor(values.length / 2)
  if (values.length % 2 === 1) return values[middle]!
  return (values[middle - 1]! + values[middle]!) / 2
}

function nearestRank(values: number[], percentile: number): number | undefined {
  if (values.length === 0) return undefined
  const ordered = [...values].sort((a, b) => a - b)
  const rank = Math.max(1, Math.ceil(ordered.length * percentile))
  return ordered[rank - 1]
}

function isComparablePrefix(attempt: CacheAttemptSummary): boolean {
  return attempt.diagnosis.kind !== 'first-observation'
    && attempt.diagnosis.kind !== 'route-or-options-changed'
}

function isPrefixFriendly(attempt: CacheAttemptSummary): boolean {
  return attempt.diagnosis.kind === 'identical-input'
    || attempt.diagnosis.kind === 'append-only'
}

export function summarizeAttempts(attempts: readonly CacheAttemptSummary[]): DiagnosticsSummary {
    let promptTokens = 0
    let inputTokens = 0
    let cacheReadTokens = 0
    let cacheWriteTokens = 0
    let outputTokens = 0
    let reportedPromptTokens = 0
    let reportedCacheAttempts = 0
    let estimatedCost = 0
    let pricedAttempts = 0
    let comparablePrefixAttempts = 0
    let prefixFriendlyAttempts = 0
    const correlation: EvidenceCorrelation = {
      comparedAttempts: 0,
      prefixFriendlyWithRead: 0,
      prefixFriendlyWithoutRead: 0,
      prefixChangedWithRead: 0,
      prefixChangedWithoutRead: 0,
    }
    const firstTokenValues: number[] = []

    for (const attempt of attempts) {
      const comparablePrefix = isComparablePrefix(attempt)
      const prefixFriendly = isPrefixFriendly(attempt)
      if (comparablePrefix) {
        comparablePrefixAttempts++
        if (prefixFriendly) prefixFriendlyAttempts++
      }
      if (comparablePrefix && attempt.usage?.cacheReadTokens !== undefined) {
        correlation.comparedAttempts++
        const hasRead = attempt.usage.cacheReadTokens > 0
        if (prefixFriendly && hasRead) correlation.prefixFriendlyWithRead++
        else if (prefixFriendly) correlation.prefixFriendlyWithoutRead++
        else if (hasRead) correlation.prefixChangedWithRead++
        else correlation.prefixChangedWithoutRead++
      }
      if (attempt.firstTokenMs !== undefined) firstTokenValues.push(attempt.firstTokenMs)
      const usage = attempt.usage
      if (usage !== undefined) {
        promptTokens += usage.promptTokens
        inputTokens += usage.inputTokens
        cacheReadTokens += usage.cacheReadTokens ?? 0
        cacheWriteTokens += usage.cacheWriteTokens ?? 0
        outputTokens += usage.outputTokens
        if (usage.cacheReadTokens !== undefined) {
          reportedCacheAttempts++
          reportedPromptTokens += usage.promptTokens
        }
      }
      if (attempt.cost !== undefined) {
        estimatedCost += attempt.cost.amount
        pricedAttempts++
      }
    }

    const cacheReadRatio = reportedPromptTokens === 0
      ? undefined
      : cacheReadTokens / reportedPromptTokens
    const prefixFriendlyRatio = comparablePrefixAttempts === 0
      ? undefined
      : prefixFriendlyAttempts / comparablePrefixAttempts
    const medianFirstTokenMs = median(firstTokenValues)
    const p95FirstTokenMs = nearestRank(firstTokenValues, 0.95)
    return {
      attemptCount: attempts.length,
      completedCount: attempts.filter(attempt => attempt.status === 'completed').length,
      comparablePrefixAttempts,
      prefixFriendlyAttempts,
      promptTokens,
      inputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      outputTokens,
      correlation,
      ...cacheReadRatio === undefined ? {} : { cacheReadRatio },
      ...prefixFriendlyRatio === undefined ? {} : { prefixFriendlyRatio },
      reportedCacheAttempts,
      ...medianFirstTokenMs === undefined ? {} : { medianFirstTokenMs: roundedMilliseconds(medianFirstTokenMs) },
      ...p95FirstTokenMs === undefined ? {} : { p95FirstTokenMs: roundedMilliseconds(p95FirstTokenMs) },
      ...pricedAttempts === 0
        ? {}
        : { estimatedCost: { amount: estimatedCost, currency: attempts.find(attempt => attempt.cost !== undefined)!.cost!.currency } },
    }
  }
