/** Retain bounded model-call observations and calculate dashboard summaries. */
import { performance } from 'node:perf_hooks'
import { Context, Service } from '@deepseek-ai/cordis'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
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
  InputAnalysis,
} from './types.ts'
import type { RecordingSettings } from './contracts.ts'
import { summarizeAttempts } from './summary.ts'
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

/** Bounded in-memory service behind CacheScope's diagnostics queries. */
export class CacheScope extends Service {
  private sequence = 0
  private epoch = 0
  private readonly active = new Set<AttemptHandle>()
  private readonly attempts: CacheAttempt[] = []
  private readonly baselines = new Map<string, ComparableAttempt>()
  private readonly scopeByAttempt = new Map<string, string>()

  constructor(ctx: Context, private readonly config: DiagnosticsConfig) {
    super(ctx, 'cacheScope')
  }

  /** An epoch prevents a stream created before a stop from recording after restart. */
  recordingEpoch(): number { return this.epoch }
  canRecord(epoch: number): boolean { return this.config.recordingEnabled && epoch === this.epoch }

  configure(next: RecordingSettings): void {
    if (this.config.recordingEnabled && !next.recordingEnabled) {
      this.epoch++
      for (const handle of this.active) this.finalize(handle, 'recording-stopped')
      this.baselines.clear()
      this.scopeByAttempt.clear()
    }
    if (this.config.captureInput === 'full' && next.captureInput === 'metadata') {
      for (const attempt of this.attempts) {
        delete attempt.rawInput
        attempt.rawState = 'disabled'
      }
      for (const handle of this.active) {
        delete handle.record.rawInput
        handle.record.rawState = 'disabled'
      }
    }
    Object.assign(this.config, next)
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
    const scope = options.sessionId === undefined
      ? undefined
      : `${String(options.sessionId)}\u0000${purpose}`
    const diagnosis = diagnosePrefix(
      analysis,
      scope === undefined ? undefined : this.baselines.get(scope),
    )
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
    if (scope !== undefined) {
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
    }
    this.enforceRetention()
    const handle = { record, startedMonotonic: performance.now(), finalized: false }
    this.active.add(handle)
    return handle
  }

  /** Observe one stream chunk without modifying it. */
  observe(handle: AttemptHandle, chunk: StreamChunk): void {
    if (handle.finalized) return
    const elapsed = roundedMilliseconds(performance.now() - handle.startedMonotonic)
    handle.record.firstChunkMs ??= elapsed
    if (handle.record.firstTokenMs === undefined && ((chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') ? chunk.text !== '' : chunk.type === 'tool-call-delta' && (chunk.argumentsDelta !== '' || chunk.name !== undefined))) {
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
    if (handle.finalized) return handle.record
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
      recordingEnabled: this.config.recordingEnabled,
      logAttempts: this.config.logAttempts,
      refreshMs: this.config.refreshMs,
      captureInput: this.config.captureInput,
      includeAuxiliary: this.config.includeAuxiliary,
      rawRetentionAttempts: this.config.rawRetentionAttempts,
      summary: summarizeAttempts(attempts),
      attempts,
      notes: {
        cacheEvidence: 'Cache Read Token 来自 Harness 标准化 usage；未缓存输入是 Prompt 减去 Cache Read/Write 后的独立 Token 桶，不是本轮新增或变化 Token。字段缺失表示该 usage 未携带 Cache Read，不能按 0 处理。',
        prefixEvidence: '前缀结论只比较本进程内同 Session、同用途的相邻 DSH 逻辑输入；采集发生在提供方专用序列化之前，不等同于真实 wire payload、cache key、逐字段命中位置或命中原因。',
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
    this.active.delete(handle)
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


}
