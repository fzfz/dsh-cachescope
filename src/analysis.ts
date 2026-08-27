/** Build privacy-preserving fingerprints and compare adjacent logical model inputs. */
import { createHmac, randomBytes } from 'node:crypto'
import type { GenerateOptions, Message, ToolSchema } from '@deepseek-ai/dsh-llm'
import { snapshotJsonValue } from '@deepseek-ai/dsh-session'
import type {
  CapturedGenerateInput,
  InputAnalysis,
  PrefixDiagnosis,
} from './types.ts'

const HMAC_KEY = randomBytes(32)

function stablePrimitive(value: string | boolean | number): string {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error(`unsupported input value: ${typeof value}`)
  return serialized
}

function omittedByJson(value: unknown): boolean {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol'
}

/** Deterministically serialize values with the same omission rules as JSON.stringify. */
export function stableJson(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return stablePrimitive(value)
  }
  if (typeof value !== 'object') throw new Error(`unsupported input value: ${typeof value}`)
  if (Array.isArray(value)) {
    return `[${Array.from(value, item => omittedByJson(item) ? 'null' : stableJson(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .sort()
    .filter(key => !omittedByJson(record[key]))
    .map(key => `${stablePrimitive(key)}:${stableJson(record[key])}`)
  return `{${entries.join(',')}}`
}

function fingerprint(serialized: string): string {
  return createHmac('sha256', HMAC_KEY).update(serialized).digest('hex')
}

function bytes(serialized: string): number {
  return Buffer.byteLength(serialized, 'utf8')
}

/** Project one message onto fields that DSH adapters can send to a provider. */
function providerMessage(message: Message): unknown {
  const source = message.source.kind === 'model'
    ? {
        provider: message.source.provider,
        model: message.source.model,
        ...message.source.replayState === undefined ? {} : { replayState: message.source.replayState },
      }
    : undefined
  return {
    role: message.role,
    content: message.content,
    ...source === undefined ? {} : { source },
  }
}

function requestConfig(options: GenerateOptions): Record<string, unknown> {
  return {
    provider: options.provider,
    model: options.model,
    ...options.reasoningEffort === undefined ? {} : { reasoningEffort: options.reasoningEffort },
    ...options.temperature === undefined ? {} : { temperature: options.temperature },
    ...options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens },
    ...options.stop === undefined ? {} : { stop: options.stop },
  }
}

function requestWithoutSignal(options: GenerateOptions): CapturedGenerateInput {
  return {
    provider: options.provider,
    model: options.model,
    messages: options.messages,
    ...options.reasoningEffort === undefined ? {} : { reasoningEffort: options.reasoningEffort },
    ...options.system === undefined ? {} : { system: options.system },
    ...options.tools === undefined ? {} : { tools: options.tools },
    ...options.temperature === undefined ? {} : { temperature: options.temperature },
    ...options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens },
    ...options.stop === undefined ? {} : { stop: options.stop },
    ...options.sessionId === undefined ? {} : { sessionId: options.sessionId },
    ...options.purpose === undefined ? {} : { purpose: options.purpose },
  }
}

/** Analyze a DSH logical input while retaining raw text only when explicitly enabled. */
export function analyzeInput(options: GenerateOptions, captureRaw: boolean, maxRawInputBytes: number): InputAnalysis {
  const configJson = stableJson(requestConfig(options))
  const systemJson = stableJson(options.system ?? null)
  const tools = options.tools ?? []
  const toolJson = tools.map((tool: ToolSchema) => stableJson(tool))
  const messages = options.messages.map(providerMessage)
  const messageJson = messages.map(stableJson)
  const toolsJson = `[${toolJson.join(',')}]`
  const messagesJson = `[${messageJson.join(',')}]`
  const overallJson = `[${configJson},${systemJson},${toolsJson},${messagesJson}]`

  let rawInput: CapturedGenerateInput | undefined
  let rawState: InputAnalysis['rawState'] = captureRaw ? 'unserializable' : 'disabled'
  if (captureRaw) {
    rawInput = snapshotJsonValue(requestWithoutSignal(options))
    if (rawInput !== undefined) {
      if (Buffer.byteLength(JSON.stringify(rawInput), 'utf8') <= maxRawInputBytes) {
        rawState = 'available'
      } else {
        rawInput = undefined
        rawState = 'too-large'
      }
    }
  }

  return {
    metadata: {
      overallFingerprint: fingerprint(overallJson),
      configFingerprint: fingerprint(configJson),
      systemFingerprint: fingerprint(systemJson),
      toolsFingerprint: fingerprint(toolsJson),
      messagesFingerprint: fingerprint(messagesJson),
      totalBytes: bytes(overallJson),
      configBytes: bytes(configJson),
      systemBytes: bytes(systemJson),
      toolsBytes: bytes(toolsJson),
      messagesBytes: bytes(messagesJson),
      toolCount: tools.length,
      messageCount: messages.length,
    },
    configHash: fingerprint(configJson),
    systemHash: fingerprint(systemJson),
    toolHashes: toolJson.map(fingerprint),
    messageHashes: messageJson.map(fingerprint),
    ...rawInput === undefined ? {} : { rawInput },
    rawState,
  }
}

function sharedPrefixLength(previous: readonly string[], current: readonly string[]): number {
  const limit = Math.min(previous.length, current.length)
  let index = 0
  while (index < limit && previous[index] === current[index]) index++
  return index
}

/** Compare two requests in provider-neutral DSH input space. */
export function diagnosePrefix(
  current: InputAnalysis,
  previous: { id: string; analysis: InputAnalysis } | undefined,
): PrefixDiagnosis {
  if (previous === undefined) {
    return { kind: 'first-observation', stableToolCount: 0, stableMessageCount: 0 }
  }

  const base = {
    comparedTo: previous.id,
    previousToolCount: previous.analysis.toolHashes.length,
    previousMessageCount: previous.analysis.messageHashes.length,
    configStable: previous.analysis.configHash === current.configHash,
    systemStable: previous.analysis.systemHash === current.systemHash,
    stableToolCount: sharedPrefixLength(previous.analysis.toolHashes, current.toolHashes),
    stableMessageCount: sharedPrefixLength(previous.analysis.messageHashes, current.messageHashes),
  }
  if (!base.configStable) {
    return { kind: 'route-or-options-changed', ...base }
  }
  if (!base.systemStable) {
    return { kind: 'system-changed', ...base }
  }
  if (
    previous.analysis.toolHashes.length !== current.toolHashes.length
    || previous.analysis.toolHashes.some((hash, index) => hash !== current.toolHashes[index])
  ) {
    return { kind: 'tools-changed', ...base }
  }
  if (
    previous.analysis.messageHashes.length === current.messageHashes.length
    && base.stableMessageCount === current.messageHashes.length
  ) {
    return { kind: 'identical-input', ...base }
  }
  if (base.stableMessageCount === previous.analysis.messageHashes.length) {
    return { kind: 'append-only', ...base }
  }
  return {
    kind: 'history-rewritten',
    ...base,
    firstChangedMessage: base.stableMessageCount,
  }
}
