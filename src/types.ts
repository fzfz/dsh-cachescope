/** Shared CacheScope configuration, observation, and dashboard read-model types. */
import type { FinishReason, GenerateOptions, TokenUsage } from '@deepseek-ai/dsh-llm'

/** Optional deployment prices used only for clearly labelled cost estimates. */
export interface PricingConfig {
  currency: string
  uncachedInputPerMillion: number
  cacheReadPerMillion: number
  cacheWritePerMillion: number
  outputPerMillion: number
}

/** Plugin configuration after Schemastery has supplied defaults. */
export interface DiagnosticsConfig {
  captureInput: 'metadata' | 'full'
  maxAttempts: number
  rawRetentionAttempts: number
  maxRawInputBytes: number
  refreshMs: number
  logAttempts: boolean
  includeAuxiliary: boolean
  dashboard: boolean
  pricing?: PricingConfig
}

/** Provider-neutral classification of the model call. */
export type AttemptPurpose = 'conversation' | 'compaction' | 'session-title' | 'direct'

/** How the current logical input differs from the previous comparable input. */
export type PrefixChangeKind =
  | 'first-observation'
  | 'identical-input'
  | 'append-only'
  | 'route-or-options-changed'
  | 'system-changed'
  | 'tools-changed'
  | 'history-rewritten'

/** Provider-neutral prefix comparison. This is diagnostic evidence, not a provider cache verdict. */
export interface PrefixDiagnosis {
  kind: PrefixChangeKind
  comparedTo?: string
  firstChangedMessage?: number
  previousMessageCount?: number
  previousToolCount?: number
  configStable?: boolean
  systemStable?: boolean
  stableToolCount: number
  stableMessageCount: number
}

/** HMAC fingerprints and byte counts for one logical request. */
export interface InputMetadata {
  overallFingerprint: string
  configFingerprint: string
  systemFingerprint: string
  toolsFingerprint: string
  messagesFingerprint: string
  totalBytes: number
  configBytes: number
  systemBytes: number
  toolsBytes: number
  messagesBytes: number
  toolCount: number
  messageCount: number
}

/** Internal fingerprints retained to compare later requests without retaining their text. */
export interface InputAnalysis {
  metadata: InputMetadata
  configHash: string
  systemHash: string
  toolHashes: string[]
  messageHashes: string[]
  rawInput?: CapturedGenerateInput
  rawState: 'available' | 'disabled' | 'too-large' | 'unserializable'
}

/** Signal-free, lossless-JSON DSH logical model input. */
export type CapturedGenerateInput = Omit<GenerateOptions, 'signal'>

/** Normalized token facts and ratios derived from one provider usage chunk. */
export interface CacheUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  promptTokens: number
  cacheReadRatio?: number
  cacheState: 'read-reported' | 'no-read-reported'
}

/** One optional price estimate derived from normalized token buckets. */
export interface CostEstimate {
  amount: number
  currency: string
}

/** Cross-tabulation of provider Cache Read evidence and comparable local prefix state. */
export interface EvidenceCorrelation {
  comparedAttempts: number
  prefixFriendlyWithRead: number
  prefixFriendlyWithoutRead: number
  prefixChangedWithRead: number
  prefixChangedWithoutRead: number
}

/** Lifecycle outcome of one invocation of the llm/stream waterfall. */
export type AttemptStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'consumer-stopped' | 'incomplete'

/** Public read model for one model-call attempt. */
export interface CacheAttempt {
  id: string
  sequence: number
  sessionId?: string
  purpose: AttemptPurpose
  provider: string
  model: string
  startedAt: number
  finishedAt?: number
  durationMs?: number
  firstChunkMs?: number
  firstTokenMs?: number
  status: AttemptStatus
  finishKind?: FinishReason['kind']
  error?: string
  usage?: CacheUsage
  cost?: CostEstimate
  diagnosis: PrefixDiagnosis
  input: InputMetadata
  rawInput?: CapturedGenerateInput
  rawState: 'available' | 'disabled' | 'evicted' | 'too-large' | 'unserializable'
}

/** Attempt fields returned by the polling snapshot without complete request content. */
export type CacheAttemptSummary = Omit<CacheAttempt, 'rawInput'>

/** Complete input fetched only for the currently selected attempt. */
export interface CapturedInputSnapshot {
  id: string
  rawState: CacheAttempt['rawState']
  overallFingerprint: string
  rawInput?: CapturedGenerateInput
}

/** Aggregate values shown above the attempt list. */
export interface DiagnosticsSummary {
  attemptCount: number
  completedCount: number
  comparablePrefixAttempts: number
  prefixFriendlyAttempts: number
  promptTokens: number
  inputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  correlation: EvidenceCorrelation
  cacheReadRatio?: number
  prefixFriendlyRatio?: number
  reportedCacheAttempts: number
  medianFirstTokenMs?: number
  p95FirstTokenMs?: number
  estimatedCost?: CostEstimate
}

/** Complete snapshot returned by the local diagnostics Interface. */
export interface DiagnosticsSnapshot {
  generatedAt: number
  captureInput: DiagnosticsConfig['captureInput']
  rawRetentionAttempts: number
  summary: DiagnosticsSummary
  attempts: CacheAttemptSummary[]
  notes: {
    cacheEvidence: string
    prefixEvidence: string
    timingEvidence: string
  }
}

/** Mutable attempt handle used only by the stream observer. */
export interface AttemptHandle {
  record: CacheAttempt
  startedMonotonic: number
  finalized: boolean
}

/** Convert the provider's disjoint usage buckets into cache diagnostics. */
export function normalizeUsage(usage: TokenUsage): CacheUsage {
  const cacheRead = usage.cacheReadTokens
  const cacheWrite = usage.cacheWriteTokens
  const promptTokens = usage.inputTokens + (cacheRead ?? 0) + (cacheWrite ?? 0)
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    ...cacheRead === undefined ? {} : { cacheReadTokens: cacheRead },
    ...cacheWrite === undefined ? {} : { cacheWriteTokens: cacheWrite },
    ...usage.reasoningTokens === undefined ? {} : { reasoningTokens: usage.reasoningTokens },
    promptTokens,
    ...cacheRead === undefined || promptTokens === 0 ? {} : { cacheReadRatio: cacheRead / promptTokens },
    cacheState: cacheRead === undefined ? 'no-read-reported' : 'read-reported',
  }
}
