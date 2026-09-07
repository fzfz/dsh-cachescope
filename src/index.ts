/** Observe DSH model calls and expose bounded prompt-cache diagnostics. */
import { randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { Config } from './config.ts'
import { plugin } from './contracts.ts'
import { errors, type ErrorCode } from './errors.ts'
import { installSettings } from './settings.ts'
export { Config } from './config.ts'
import { isAgentLoopRequest, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { CacheScope } from './diagnostics.ts'
import { renderDashboardPage } from './page.ts'
import type {
  AttemptHandle,
  AttemptPurpose,
  CacheAttempt,
  DiagnosticsConfig,
  PricingConfig,
} from './types.ts'

export const name = 'dsh-cachescope'
export const inject = ['llm', 'settings']

const { dashboardPath: DASHBOARD_PATH, dataPath: DATA_PATH, inputPath: INPUT_PATH } = plugin
const AGENT_LOOP_REQUESTS_KEY = Symbol.for('@deepseek-ai/dsh-llm/agent-loop-requests/v1')

function validatePricing(pricing: PricingConfig | undefined): void {
  if (pricing === undefined) return
  if (pricing === null || typeof pricing !== 'object' || Array.isArray(pricing)) {
    throw new Error('dsh-cachescope: pricing must be an object')
  }
  if (typeof pricing.currency !== 'string' || pricing.currency.trim() === '') {
    throw new Error('dsh-cachescope: pricing.currency must be a non-empty string')
  }
  for (const field of [
    'uncachedInputPerMillion',
    'cacheReadPerMillion',
    'cacheWritePerMillion',
    'outputPerMillion',
  ] as const) {
    if (typeof pricing[field] !== 'number' || !Number.isFinite(pricing[field]) || pricing[field] < 0) {
      throw new Error(`dsh-cachescope: pricing.${field} must be a non-negative finite number`)
    }
  }
}

function isConversationRequest(options: GenerateOptions): boolean {
  const sharedRegistry = (
    globalThis as unknown as Record<symbol, WeakSet<GenerateOptions> | undefined>
  )[AGENT_LOOP_REQUESTS_KEY]
  if (isAgentLoopRequest(options) || sharedRegistry?.has(options) === true) return true
  return options.purpose === undefined && options.sessionId !== undefined
}

function purposeOf(options: GenerateOptions): AttemptPurpose {
  if (isConversationRequest(options)) return 'conversation'
  return options.purpose ?? 'direct'
}

function safeLog(ctx: Context, level: 'info' | 'warn', message: string): void {
  try {
    ctx.logger[level](message)
  } catch {
    // Diagnostics logging is never allowed to change model-stream behavior.
  }
}

function logAttempt(ctx: Context, record: CacheAttempt): void {
  const usage = record.usage
  const cache = usage?.cacheReadTokens === undefined
    ? 'cache_read=not-carried'
    : `cache_read=${usage.cacheReadTokens}/${usage.promptTokens} (${((usage.cacheReadRatio ?? 0) * 100).toFixed(1)}%)`
  safeLog(
    ctx,
    'info',
    `[cachescope] ${record.id} ${record.purpose} ${record.provider}/${record.model}`
      + ` ${cache} uncached=${usage?.inputTokens ?? 'unreported'}`
      + ` call_ttft=${record.firstTokenMs ?? 'unreported'}ms prefix=${record.diagnosis.kind}`,
  )
}

function trustedLoopbackRequest(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress
  if (remote !== '127.0.0.1' && remote !== '::ffff:127.0.0.1' && remote !== '::1') return false
  const localPort = req.socket.localPort
  if (localPort === undefined) return false
  const expectedHost = `127.0.0.1:${localPort}`
  if (req.headers.host !== expectedHost) return false
  const fetchSite = req.headers['sec-fetch-site']
  if (fetchSite !== undefined && fetchSite !== 'same-origin' && fetchSite !== 'none') return false
  const origin = req.headers.origin
  if (origin !== undefined && origin !== `http://${expectedHost}`) return false
  return true
}

function securityHeaders(contentType: string): Record<string, string> {
  return {
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  }
}

function send(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string>,
): void {
  res.writeHead(status, { ...headers, 'Content-Length': String(Buffer.byteLength(body, 'utf8')) })
  if (req.method === 'HEAD') res.end()
  else res.end(body)
}

function sendError(req: IncomingMessage, res: ServerResponse, code: ErrorCode): void {
  const error = errors[code]
  send(req, res, error.status, JSON.stringify({ error: { code, message: error.message } }), {
    ...securityHeaders('application/json; charset=utf-8'),
    ...(code === 'METHOD_NOT_ALLOWED' ? { Allow: 'GET, HEAD' } : {}),
  })
}

function guardedRoute(handler: WebRoute['handler']): WebRoute['handler'] {
  return async (req, res) => {
    if (!trustedLoopbackRequest(req)) {
      sendError(req, res, 'FORBIDDEN')
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendError(req, res, 'METHOD_NOT_ALLOWED')
      return
    }
    await handler(req, res)
  }
}

function dashboardRoute(config: DiagnosticsConfig): WebRoute {
  return {
    kind: 'exact',
    path: DASHBOARD_PATH,
    handler: guardedRoute((req, res) => {
      const nonce = randomBytes(18).toString('base64')
      const body = renderDashboardPage(nonce, config.refreshMs)
      send(req, res, 200, body, {
        ...securityHeaders('text/html; charset=utf-8'),
        'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'`,
      })
    }),
  }
}

function dataRoute(diagnostics: CacheScope): WebRoute {
  return {
    kind: 'exact',
    path: DATA_PATH,
    handler: guardedRoute((req, res) => {
      const body = JSON.stringify(diagnostics.snapshot())
      send(req, res, 200, body, securityHeaders('application/json; charset=utf-8'))
    }),
  }
}

function inputRoute(diagnostics: CacheScope): WebRoute {
  return {
    kind: 'exact',
    path: INPUT_PATH,
    handler: guardedRoute((req, res) => {
      const id = new URL(req.url ?? INPUT_PATH, 'http://127.0.0.1').searchParams.get('id')
      if (id === null || !/^call-\d+$/.test(id)) {
        sendError(req, res, 'INVALID_ATTEMPT')
        return
      }
      const input = diagnostics.input(id)
      if (input === undefined) {
        sendError(req, res, 'ATTEMPT_NOT_FOUND')
        return
      }
      const body = JSON.stringify(input)
      send(req, res, 200, body, securityHeaders('application/json; charset=utf-8'))
    }),
  }
}

function observedStream(
  ctx: Context,
  diagnostics: CacheScope,
  config: DiagnosticsConfig,
  options: GenerateOptions,
  source: AsyncIterable<StreamChunk>,
  epoch: number,
): AsyncIterable<StreamChunk> {
  return (async function*(): AsyncGenerator<StreamChunk> {
    let handle: AttemptHandle | undefined
    try {
      if (diagnostics.canRecord(epoch)) handle = diagnostics.begin(options, purposeOf(options))
    } catch {
      safeLog(ctx, 'warn', '[cachescope] input analysis failed; the model stream is unaffected')
    }

    let exhausted = false
    try {
      for await (const chunk of source) {
        if (handle !== undefined && !handle.finalized && diagnostics.canRecord(epoch)) {
          try {
            diagnostics.observe(handle, chunk)
          } catch {
            safeLog(ctx, 'warn', '[cachescope] chunk observation failed; the model stream is unaffected')
          }
        }
        yield chunk
      }
      exhausted = true
      if (handle !== undefined && !handle.finalized && diagnostics.canRecord(epoch)) {
        try {
          const record = diagnostics.complete(handle)
          if (config.logAttempts) logAttempt(ctx, record)
        } catch {
          safeLog(ctx, 'warn', '[cachescope] attempt finalization failed; the model stream is unaffected')
        }
      }
    } catch (error: unknown) {
      if (handle !== undefined && !handle.finalized && diagnostics.canRecord(epoch)) {
        try {
          const record = handle.record.finishKind === undefined
            ? diagnostics.fail(handle, error)
            : diagnostics.complete(handle)
          if (config.logAttempts) logAttempt(ctx, record)
        } catch {
          safeLog(ctx, 'warn', '[cachescope] failure recording failed; the original error is preserved')
        }
      }
      throw error
    } finally {
      if (!exhausted && handle !== undefined && !handle.finalized && diagnostics.canRecord(epoch)) {
        try {
          const record = handle.record.finishKind === undefined
            ? diagnostics.stop(handle, options.signal?.aborted === true)
            : diagnostics.complete(handle)
          if (config.logAttempts) logAttempt(ctx, record)
        } catch {
          safeLog(ctx, 'warn', '[cachescope] stream-close recording failed; the model stream is unaffected')
        }
      }
    }
  })()
}

/** Install cache observation and, when available, the loopback-only dashboard. */
export function apply(ctx: Context, config: Config): void {
  const resolved = { ...config } as DiagnosticsConfig
  if (resolved.rawRetentionAttempts > resolved.maxAttempts) {
    throw new Error('dsh-cachescope: rawRetentionAttempts cannot exceed maxAttempts')
  }
  validatePricing(resolved.pricing)
  const diagnostics = new CacheScope(ctx, resolved)
  installSettings(ctx, resolved, diagnostics)
  ctx.effect(() => () => diagnostics.configure({ recordingEnabled: false, captureInput: resolved.captureInput, logAttempts: false }), 'CacheScope recording cleanup')

  ctx.on('llm/stream', (options, next) => {
    // Preserve the waterfall's synchronous `next()` construction and exception timing.
    const epoch = diagnostics.recordingEpoch()
    const source = next()
    if (!resolved.includeAuxiliary && !isConversationRequest(options)) return source
    if (!resolved.recordingEnabled) return source
    return observedStream(ctx, diagnostics, resolved, options, source, epoch)
  })

  ctx.inject(['webServer'], (webCtx: Context) => {
    if (webCtx.webServer.host !== '127.0.0.1') {
      throw new Error('dsh-cachescope: dashboard requires WebServer host 127.0.0.1')
    }
    webCtx.effect(function*() {
      if (resolved.dashboard) yield webCtx.webServer.register(dashboardRoute(resolved))
      yield webCtx.webServer.register(dataRoute(diagnostics))
      yield webCtx.webServer.register(inputRoute(diagnostics))
    }, 'dsh-cachescope dashboard routes')
    safeLog(
      ctx,
      'info',
      `[cachescope] dashboard: http://127.0.0.1:${webCtx.webServer.port}${DASHBOARD_PATH}`,
    )
  })
}
