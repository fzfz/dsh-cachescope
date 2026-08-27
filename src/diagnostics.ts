/** Retain bounded model-call observations and calculate dashboard summaries. */
import { performance } from 'node:perf_hooks'
import { Context, Service } from '@deepseek-ai/cordis'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { isTokenDelta } from '@deepseek-ai/dsh-llm'
import { analyzeInput, diagnosePrefix } from './analysis.ts'
import type {
  AttemptHandle,
  AttemptPurpose,
  CacheAttempt,
  CacheAttemptSummary,
  CacheUsage,
  CapturedInputSnapshot,
  CostEstimate,
  DiagnosticsConfig,
  DiagnosticsSnapshot,
  DiagnosticsSummary,
  InputAnalysis,
} from './types.ts'
import { normalizeUsage } from './types.ts'

interface ComparableAttempt {
  id: string
  analysis: InputAnalysis
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    cacheScope: CacheScope
  }
}

function roundedMilliseconds(value: number): number {
  return Math.round(value * 10) / 10
}

function renderError(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown downstream error'
  const code = Reflect.get(error, 'code')
  return typeof code === 'string' && code !== '' ? `${error.name} (${code})` : error.name
}

function estimateCost(usage: CacheUsage, config: DiagnosticsConfig): CostEstimate | undefined {
  const pricing = config.pricing
  if (pricing === undefined) return undefined
  const amount = (
    usage.inputTokens * pricing.uncachedInputPerMillion
    + (usage.cacheReadTokens ?? 0) * pricing.cacheReadPerMillion
    + (usage.cacheWriteTokens ?? 0) * pricing.cacheWritePerMillion
    + usage.outputTokens * pricing.outputPerMillion
  ) / 1_000_000
  return { amount, currency: pricing.currency }
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  values.sort((a, b) => a - b)
  const middle = Math.floor(values.length / 2)
  if (values.length % 2 === 1) return values[middle]!
  return (values[middle - 1]! + values[middle]!) / 2
}

/** Bounded in-memory service behind CacheScope's diagnostics queries. */
export class CacheScope extends Service {
  private sequence = 0
  private readonly attempts: CacheAttempt[] = []
  private readonly baselines = new Map<string, ComparableAttempt>()
  private readonly scopeByAttempt = new Map<string, string>()

  constructor(ctx: Context, private readonly config: DiagnosticsConfig) {
    super(ctx, 'cacheScope')
  }

  /** Begin one llm/stream attempt and compare it with its previous session/purpose request. */
  begin(options: GenerateOptions, purpose: AttemptPurpose): AttemptHandle {
    const sequence = ++this.sequence
    const id = `call-${sequence}`
    const analysis = analyzeInput(
      options,
      this.config.captureInput === 'full',
      this.config.maxRawInputBytes,
    )
    const scope = `${String(options.sessionId ?? 'no-session')}\u0000${purpose}`
    const diagnosis = diagnosePrefix(analysis, this.baselines.get(scope))
    const record: CacheAttempt = {
      id,
      sequence,
      ...options.sessionId === undefined ? {} : { sessionId: String(options.sessionId) },
      purpose,
      provider: options.provider,
      model: options.model,
      startedAt: Date.now(),
      status: 'running',
      diagnosis,
      input: analysis.metadata,
      ...analysis.rawInput === undefined ? {} : { rawInput: analysis.rawInput },
      rawState: analysis.rawState,
    }
    this.attempts.push(record)
    this.scopeByAttempt.set(id, scope)
    this.baselines.set(scope, {
      id,
      analysis: {
        metadata: analysis.metadata,
        configHash: analysis.configHash,
        systemHash: analysis.systemHash,
        toolHashes: analysis.toolHashes,
        messageHashes: analysis.messageHashes,
        rawState: analysis.rawState,
      },
    })
    this.enforceRetention()
    return { record, startedMonotonic: performance.now(), finalized: false }
  }

  /** Observe one stream chunk without modifying it. */
  observe(handle: AttemptHandle, chunk: StreamChunk): void {
    const elapsed = roundedMilliseconds(performance.now() - handle.startedMonotonic)
    handle.record.firstChunkMs ??= elapsed
    if (handle.record.firstTokenMs === undefined && isTokenDelta(chunk)) {
      handle.record.firstTokenMs = elapsed
    }
    if (chunk.type === 'usage') {
      handle.record.usage = normalizeUsage(chunk.usage)
      const cost = estimateCost(handle.record.usage, this.config)
      if (cost !== undefined) handle.record.cost = cost
    }
    if (chunk.type === 'finish') handle.record.finishKind = chunk.reason.kind
  }

  /** Mark normal exhaustion of the observed stream. */
  complete(handle: AttemptHandle): CacheAttempt {
    const status = handle.record.finishKind === 'error'
      ? 'failed'
      : handle.record.finishKind === 'aborted'
        ? 'cancelled'
        : handle.record.finishKind === undefined
          ? 'incomplete'
          : 'completed'
    return this.finalize(handle, status)
  }

  /** Mark an exception thrown by a downstream waterfall listener. */
  fail(handle: AttemptHandle, error: unknown): CacheAttempt {
    handle.record.error = renderError(error)
    return this.finalize(handle, 'failed')
  }

  /** Mark early stream closure by cancellation or by its consumer. */
  stop(handle: AttemptHandle, aborted: boolean): CacheAttempt {
    return this.finalize(handle, aborted ? 'cancelled' : 'consumer-stopped')
  }

  /** Return a detached newest-first dashboard snapshot without complete request content. */
  snapshot(): DiagnosticsSnapshot {
    const attempts = [...this.attempts].reverse().map((attempt): CacheAttemptSummary => {
      const summary = { ...attempt }
      delete summary.rawInput
      return structuredClone(summary)
    })
    return {
      generatedAt: Date.now(),
      captureInput: this.config.captureInput,
      rawRetentionAttempts: this.config.rawRetentionAttempts,
      summary: this.summarize(),
      attempts,
      notes: {
        cacheEvidence: 'Cache Read Token 来自 Harness 标准化 usage；未缓存输入是适配器标准化后的独立 Token 桶。字段缺失表示该 usage 未携带 Cache Read，不能按 0 处理。',
        prefixEvidence: '前缀结论只比较本进程内同 Session、同用途的相邻 DSH 逻辑输入，不等同于供应商真实 cache key、逐字段命中位置或命中原因。',
        timingEvidence: 'Call TTFT 从开始迭代模型流到首个非空 Token；它包含网络和排队，不是纯 Prefill 耗时。',
      },
    }
  }

  /**
   * Return the retained complete input for one attempt without cloning other retained inputs.
   * @param id Attempt identifier from {@link snapshot}.
   * @returns A detached input record, or `undefined` after the attempt leaves retention.
   */
  input(id: string): CapturedInputSnapshot | undefined {
    const attempt = this.attempts.find(candidate => candidate.id === id)
    if (attempt === undefined) return undefined
    return structuredClone({
      id: attempt.id,
      rawState: attempt.rawState,
      overallFingerprint: attempt.input.overallFingerprint,
      ...attempt.rawInput === undefined ? {} : { rawInput: attempt.rawInput },
    })
  }

  private finalize(handle: AttemptHandle, status: CacheAttempt['status']): CacheAttempt {
    if (handle.finalized) return handle.record
    handle.finalized = true
    handle.record.status = status
    handle.record.finishedAt = Date.now()
    handle.record.durationMs = roundedMilliseconds(performance.now() - handle.startedMonotonic)
    return handle.record
  }

  private enforceRetention(): void {
    while (this.attempts.length > this.config.maxAttempts) {
      const removed = this.attempts.shift()
      if (removed === undefined) break
      const scope = this.scopeByAttempt.get(removed.id)
      this.scopeByAttempt.delete(removed.id)
      if (scope !== undefined && this.baselines.get(scope)?.id === removed.id) this.baselines.delete(scope)
    }

    let retainedRaw = 0
    for (let index = this.attempts.length - 1; index >= 0; index--) {
      const attempt = this.attempts[index]
      if (attempt === undefined) continue
      if (attempt.rawInput === undefined) continue
      retainedRaw++
      if (retainedRaw <= this.config.rawRetentionAttempts) continue
      delete attempt.rawInput
      attempt.rawState = 'evicted'
    }
  }

  private summarize(): DiagnosticsSummary {
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
    const firstTokenValues: number[] = []

    for (const attempt of this.attempts) {
      if (
        attempt.diagnosis.kind !== 'first-observation'
        && attempt.diagnosis.kind !== 'route-or-options-changed'
      ) {
        comparablePrefixAttempts++
        if (
          attempt.diagnosis.kind === 'identical-input'
          || attempt.diagnosis.kind === 'append-only'
        ) {
          prefixFriendlyAttempts++
        }
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
    return {
      attemptCount: this.attempts.length,
      completedCount: this.attempts.filter(attempt => attempt.status === 'completed').length,
      comparablePrefixAttempts,
      prefixFriendlyAttempts,
      promptTokens,
      inputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      outputTokens,
      ...cacheReadRatio === undefined ? {} : { cacheReadRatio },
      ...prefixFriendlyRatio === undefined ? {} : { prefixFriendlyRatio },
      reportedCacheAttempts,
      ...medianFirstTokenMs === undefined ? {} : { medianFirstTokenMs: roundedMilliseconds(medianFirstTokenMs) },
      ...pricedAttempts === 0 || this.config.pricing === undefined
        ? {}
        : { estimatedCost: { amount: estimatedCost, currency: this.config.pricing.currency } },
    }
  }
}
