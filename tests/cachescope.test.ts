import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, {
  createUserMessage,
  type GenerateOptions,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { JSDOM } from 'jsdom'
import { analyzeInput, diagnosePrefix, stableJson } from '../src/analysis.ts'
import * as CacheScopePlugin from '../src/index.ts'
import { renderDashboardPage } from '../src/page.ts'
import type { DiagnosticsConfig } from '../src/types.ts'
import { normalizeUsage } from '../src/types.ts'

const CONFIG: DiagnosticsConfig = {
  captureInput: 'full',
  maxAttempts: 20,
  rawRetentionAttempts: 1,
  maxRawInputBytes: 100_000,
  refreshMs: 1000,
  logAttempts: false,
  includeAuxiliary: true,
  dashboard: false,
}

describe('installable bundle', () => {
  it('captures bounded complete inputs and excludes auxiliary calls', async () => {
    const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')

    assert.equal(patch, `- insert:
    - id: cachescope
      name: '@kober-basket/dsh-cachescope'
      config:
        captureInput: full
        includeAuxiliary: false
`)
  })
})

function message(text: string) {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

function request(overrides: Partial<GenerateOptions> = {}): GenerateOptions {
  return {
    provider: 'test-provider',
    model: 'test-model',
    system: 'stable system',
    tools: [{ name: 'echo', description: 'Echo text', parameters: { type: 'object' } }],
    messages: [message('first')],
    ...overrides,
  }
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(CacheScopePlugin, CONFIG)
  return ctx
}

function dispatch(
  ctx: Context,
  options: GenerateOptions,
  source: () => AsyncIterable<StreamChunk>,
): AsyncIterable<StreamChunk> {
  return ctx.waterfall(ctx.llm, 'llm/stream', options, source)
}

const DASHBOARD_RAW_INPUT = {
  provider: 'test-provider',
  model: 'test-model',
  messages: [
    { role: 'user', content: [{ type: 'text', text: 'first' }] },
    { role: 'assistant', content: [{ type: 'text', text: 'second' }] },
  ],
  system: 'stable system',
  tools: [{ name: 'echo', description: 'Echo text', parameters: { type: 'object' } }],
  options: { reasoningEffort: 'high', temperature: 0 },
  untrusted: '<img src=x onerror=alert(1)>',
}

const DASHBOARD_SNAPSHOT = {
  generatedAt: Date.now(),
  captureInput: 'full',
  notes: {
    cacheEvidence: 'Cache evidence',
    prefixEvidence: 'Prefix evidence',
    timingEvidence: 'Timing evidence',
  },
  summary: {
    attemptCount: 1,
    reportedCacheAttempts: 1,
    inputTokens: 20,
    outputTokens: 2,
    cacheReadTokens: 80,
    cacheWriteTokens: 0,
    promptTokens: 100,
    cacheReadRatio: 0.8,
    medianFirstTokenMs: 42,
  },
  attempts: [{
    id: 'call-1',
    startedAt: Date.now(),
    sessionId: 'session-test',
    purpose: 'conversation',
    provider: 'test-provider',
    model: 'test-model',
    status: 'completed',
    finishKind: 'stop',
    firstTokenMs: 42,
    durationMs: 57,
    usage: {
      inputTokens: 20,
      outputTokens: 2,
      cacheReadTokens: 80,
      cacheWriteTokens: 0,
      promptTokens: 100,
      cacheReadRatio: 0.8,
      cacheState: 'read-reported',
    },
    diagnosis: {
      kind: 'append-only',
      comparedTo: 'call-0',
      previousToolCount: 1,
      previousMessageCount: 1,
      configStable: true,
      systemStable: true,
      stableToolCount: 1,
      stableMessageCount: 1,
    },
    input: {
      messageCount: 2,
      toolCount: 1,
      systemBytes: 13,
      toolsBytes: 34,
      messagesBytes: 55,
      totalBytes: 102,
      overallFingerprint: '0123456789abcdef0123456789abcdef',
    },
    rawState: 'available',
  }],
}

async function renderTestDashboard(
  snapshot: typeof DASHBOARD_SNAPSHOT = DASHBOARD_SNAPSHOT,
  rawInput: typeof DASHBOARD_RAW_INPUT = DASHBOARD_RAW_INPUT,
): Promise<{
  dom: JSDOM
  poll: () => unknown
  requests: string[]
}> {
  let poll: (() => unknown) | undefined
  const requests: string[] = []
  const dom = new JSDOM(renderDashboardPage('test-nonce', 1000), {
    runScripts: 'dangerously',
    url: 'http://127.0.0.1/cachescope',
    beforeParse(window) {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        value: async (input: unknown) => {
          const url = String(input)
          requests.push(url)
          return {
            ok: true,
            json: async () => url.startsWith('/cachescope/api/input')
              ? {
                  id: 'call-1',
                  rawState: 'available',
                  overallFingerprint: '0123456789abcdef0123456789abcdef',
                  rawInput,
                }
              : snapshot,
          }
        },
      })
      Object.defineProperty(window, 'setInterval', {
        configurable: true,
        value: (callback: unknown) => {
          assert.equal(typeof callback, 'function')
          poll = callback as () => unknown
          return 1
        },
      })
    },
  })
  for (let attempt = 0; attempt < 10 && !dom.window.document.querySelector('[data-json-tree]'); attempt++) {
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  assert.ok(dom.window.document.querySelector('tbody tr'))
  assert.ok(dom.window.document.querySelector('[data-json-tree]'))
  assert.ok(poll)
  return { dom, poll, requests }
}

describe('CacheScope input analysis', () => {
  it('fingerprints JSON-compatible optional fields without dropping the attempt', () => {
    const sparse = Array.from({ length: 3 })
    sparse[0] = 'kept'

    assert.equal(
      stableJson({ z: undefined, a: sparse, b: Number.NaN, c: () => 'ignored' }),
      '{"a":["kept",null,null],"b":null}',
    )
    assert.equal(stableJson({ b: 1, a: 2 }), '{"a":2,"b":1}')
    assert.throws(() => stableJson(1n), /unsupported input value: bigint/)
  })

  it('separates provider usage field absence from a reported zero', () => {
    const absent = normalizeUsage({ inputTokens: 10, outputTokens: 2 })
    const zero = normalizeUsage({ inputTokens: 10, outputTokens: 2, cacheReadTokens: 0 })
    assert.equal(absent.cacheState, 'no-read-reported')
    assert.equal(absent.cacheReadRatio, undefined)
    assert.equal(zero.cacheState, 'read-reported')
    assert.equal(zero.cacheReadRatio, 0)
  })

  it('distinguishes append-only context from changed stable prefix segments', () => {
    const first = analyzeInput(request(), false, 100_000)
    const identical = analyzeInput(request({ messages: [message('first')] }), false, 100_000)
    const appended = analyzeInput(request({ messages: [message('first'), message('second')] }), false, 100_000)
    const rewritten = analyzeInput(request({ messages: [message('changed')] }), false, 100_000)
    const changedSystem = analyzeInput(request({ system: 'changed system' }), false, 100_000)
    const changedTools = analyzeInput(request({ tools: [] }), false, 100_000)
    const baseline = { id: 'call-1', analysis: first }

    assert.equal(diagnosePrefix(identical, baseline).kind, 'identical-input')
    assert.equal(diagnosePrefix(appended, baseline).kind, 'append-only')
    assert.equal(diagnosePrefix(rewritten, baseline).kind, 'history-rewritten')
    assert.equal(diagnosePrefix(changedSystem, baseline).kind, 'system-changed')
    assert.equal(diagnosePrefix(changedTools, baseline).kind, 'tools-changed')
  })

  it('refuses a complete input above the configured per-request byte cap', () => {
    const analysis = analyzeInput(request({ system: 'x'.repeat(5000) }), true, 1024)
    assert.equal(analysis.rawState, 'too-large')
    assert.equal(analysis.rawInput, undefined)
  })
})

describe('dashboard interactions', () => {
  it('separates normalized usage totals from DSH-inferred input regions', async (t) => {
    const { dom } = await renderTestDashboard()
    t.after(() => { dom.window.close() })
    const document = dom.window.document

    const provider = document.querySelector('[data-cache-evidence="normalized-usage"]')
    assert.ok(provider)
    assert.match(provider.textContent ?? '', /Provider usage Cache Read\s*80/)
    assert.match(provider.textContent ?? '', /适配器归一化未缓存\s*20/)
    assert.ok(provider.querySelector('[data-cache-segment="hit"]'))
    assert.ok(provider.querySelector('[data-cache-segment="miss"]'))
    assert.equal(document.querySelector('#prefixRatio')?.textContent, '100.0%')
    assert.match(document.querySelector('#prefixRatioNote')?.textContent ?? '', /1 \/ 1 次可比较调用/)

    const inference = document.querySelector('[data-cache-evidence="dsh-inferred"]')
    assert.ok(inference)
    assert.match(inference.textContent ?? '', /不是供应商逐字段命中或未命中位置/)

    const expandTwoLevels = document.querySelector<HTMLButtonElement>('[data-json-action="expand-two"]')
    assert.ok(expandTwoLevels)
    expandTwoLevels.click()
    assert.ok(document.querySelector('[data-json-path="$.system"][data-cache-inference="stable"]'))
    assert.ok(document.querySelector('[data-json-path="$.tools[0]"][data-cache-inference="stable"]'))
    assert.ok(document.querySelector('[data-json-path="$.messages[0]"][data-cache-inference="stable"]'))
    assert.ok(document.querySelector('[data-json-path="$.messages[1]"][data-cache-inference="changed"]'))
  })

  it('keeps logical regions unknown without a local comparison even when the provider reports a hit', async (t) => {
    const snapshot = structuredClone(DASHBOARD_SNAPSHOT)
    const diagnosis = snapshot.attempts[0]!.diagnosis
    diagnosis.kind = 'first-observation'
    diagnosis.stableToolCount = 0
    diagnosis.stableMessageCount = 0
    Reflect.deleteProperty(diagnosis, 'comparedTo')
    Reflect.deleteProperty(diagnosis, 'previousToolCount')
    Reflect.deleteProperty(diagnosis, 'previousMessageCount')
    Reflect.deleteProperty(diagnosis, 'configStable')
    Reflect.deleteProperty(diagnosis, 'systemStable')
    const { dom } = await renderTestDashboard(snapshot)
    t.after(() => { dom.window.close() })
    const document = dom.window.document
    const expandTwoLevels = document.querySelector<HTMLButtonElement>('[data-json-action="expand-two"]')
    assert.ok(expandTwoLevels)
    expandTwoLevels.click()

    assert.ok(document.querySelector('[data-json-path="$.system"][data-cache-inference="unknown"]'))
    assert.ok(document.querySelector('[data-json-path="$.tools[0]"][data-cache-inference="unknown"]'))
    assert.ok(document.querySelector('[data-json-path="$.messages[0]"][data-cache-inference="unknown"]'))
    assert.equal(document.querySelector('[data-json-path="$.messages[0]"][data-cache-inference="stable"]'), null)
    assert.match(document.querySelector('[data-cache-evidence="normalized-usage"]')?.textContent ?? '', /Provider usage Cache Read\s*80/)
    const facts = Array.from(document.querySelectorAll('dt'))
    const stableTools = facts.find(node => node.textContent === '稳定 Tools')
    const stableMessages = facts.find(node => node.textContent === '稳定消息')
    assert.equal(stableTools?.nextElementSibling?.textContent, '无法比较')
    assert.equal(stableMessages?.nextElementSibling?.textContent, '无法比较')
  })

  it('shows uncached and write buckets even when normalized usage omits Cache Read', async (t) => {
    const snapshot = structuredClone(DASHBOARD_SNAPSHOT)
    const usage = snapshot.attempts[0]!.usage!
    Reflect.deleteProperty(usage, 'cacheReadTokens')
    Reflect.deleteProperty(usage, 'cacheReadRatio')
    usage.cacheState = 'no-read-reported'
    usage.inputTokens = 95
    usage.cacheWriteTokens = 5
    usage.promptTokens = 100
    const { dom } = await renderTestDashboard(snapshot)
    t.after(() => { dom.window.close() })
    const evidence = dom.window.document.querySelector('[data-cache-evidence="normalized-usage"]')
    assert.ok(evidence)
    assert.match(evidence.textContent ?? '', /Cache Read 未携带（不视为 0）/)
    assert.match(evidence.textContent ?? '', /适配器归一化未缓存\s*95/)
    assert.match(evidence.textContent ?? '', /Cache Write\s*5/)
    assert.ok(evidence.querySelector('[data-cache-segment="miss"]'))
    assert.ok(evidence.querySelector('[data-cache-segment="write"]'))
    assert.equal(evidence.querySelector('[data-cache-segment="hit"]'), null)
    assert.match(evidence.querySelector('svg')?.getAttribute('aria-label') ?? '', /Cache Write 5 Token/)
  })

  it('distinguishes a changed node from downstream nodes and marks an empty changed Tools collection', async (t) => {
    const systemSnapshot = structuredClone(DASHBOARD_SNAPSHOT)
    systemSnapshot.attempts[0]!.diagnosis.kind = 'system-changed'
    systemSnapshot.attempts[0]!.diagnosis.systemStable = false
    const systemResult = await renderTestDashboard(systemSnapshot)
    t.after(() => { systemResult.dom.window.close() })
    const systemDocument = systemResult.dom.window.document
    systemDocument.querySelector<HTMLButtonElement>('[data-json-action="expand-two"]')?.click()
    assert.ok(systemDocument.querySelector('[data-json-path="$.system"][data-cache-inference="changed"]'))
    assert.ok(systemDocument.querySelector('[data-json-path="$.tools"][data-cache-inference="downstream"]'))
    assert.ok(systemDocument.querySelector('[data-json-path="$.messages[0]"][data-cache-inference="downstream"]'))

    const toolsSnapshot = structuredClone(DASHBOARD_SNAPSHOT)
    toolsSnapshot.attempts[0]!.diagnosis.kind = 'tools-changed'
    toolsSnapshot.attempts[0]!.diagnosis.stableToolCount = 0
    toolsSnapshot.attempts[0]!.input.toolCount = 0
    const toolsInput = { ...DASHBOARD_RAW_INPUT, tools: [] }
    const toolsResult = await renderTestDashboard(toolsSnapshot, toolsInput)
    t.after(() => { toolsResult.dom.window.close() })
    const toolsDocument = toolsResult.dom.window.document
    toolsDocument.querySelector<HTMLButtonElement>('[data-json-action="expand-one"]')?.click()
    assert.ok(toolsDocument.querySelector('[data-json-path="$.tools"][data-cache-inference="changed"]'))
    assert.ok(toolsDocument.querySelector('[data-json-path="$.messages"][data-cache-inference="downstream"]'))
  })

  it('recomputes weighted provider KPIs for the active purpose filter', async (t) => {
    const snapshot = structuredClone(DASHBOARD_SNAPSHOT)
    snapshot.summary = {
      ...snapshot.summary,
      attemptCount: 2,
      reportedCacheAttempts: 2,
      inputTokens: 120,
      cacheReadTokens: 80,
      promptTokens: 200,
      cacheReadRatio: 0.4,
    }
    snapshot.attempts.push({
      ...structuredClone(snapshot.attempts[0]!),
      id: 'call-title',
      purpose: 'session-title',
      usage: {
        inputTokens: 100,
        outputTokens: 2,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        promptTokens: 100,
        cacheReadRatio: 0,
        cacheState: 'read-reported',
      },
    })
    const { dom } = await renderTestDashboard(snapshot)
    t.after(() => { dom.window.close() })
    const document = dom.window.document

    assert.equal(document.querySelector('#purposeFilter')?.getAttribute('data-default-purpose'), 'conversation')
    assert.equal(document.querySelector('#cacheRatio')?.textContent, '80.0%')
    assert.match(document.querySelector('#cacheRatioNote')?.textContent ?? '', /当前筛选.*1 \/ 1/)

    const purpose = document.querySelector<HTMLSelectElement>('#purposeFilter')
    assert.ok(purpose)
    purpose.value = ''
    purpose.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
    assert.equal(document.querySelector('#cacheRatio')?.textContent, '40.0%')
    assert.match(document.querySelector('#cacheRatioNote')?.textContent ?? '', /当前筛选.*2 \/ 2/)
  })

  it('renders complete input as a lazily disclosed JSON hierarchy', async (t) => {
    const { dom } = await renderTestDashboard()
    t.after(() => { dom.window.close() })
    const document = dom.window.document
    const row = document.querySelector('tbody tr')
    assert.ok(row)
    row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    const tree = document.querySelector('[data-json-tree]')
    assert.ok(tree)
    assert.equal(document.querySelector('#detailBody pre'), null)
    assert.equal(tree.querySelector('img'), null)
    assert.match(tree.textContent ?? '', /<img src=x onerror=alert\(1\)>/)
    const root = tree.querySelector('details[data-json-depth="0"]')
    assert.ok(root)
    assert.equal(root.hasAttribute('open'), true)
    const messages = tree.querySelector('details[data-json-path="$.messages"]')
    assert.ok(messages)
    assert.equal(messages.hasAttribute('open'), false)
    assert.equal(tree.querySelector('details[data-json-path="$.messages[0]"]'), null)

    const expandTwoLevels = document.querySelector<HTMLButtonElement>('[data-json-action="expand-two"]')
    assert.ok(expandTwoLevels)
    expandTwoLevels.click()
    assert.equal(messages.hasAttribute('open'), true)
    assert.ok(tree.querySelector('details[data-json-path="$.messages[0]"]'))

    const collapseAll = document.querySelector<HTMLButtonElement>('[data-json-action="collapse"]')
    assert.ok(collapseAll)
    collapseAll.click()
    assert.equal(root.hasAttribute('open'), false)
    assert.equal(messages.hasAttribute('open'), false)
  })

  it('uses one disclosure column and keeps the raw-input heading intact', async (t) => {
    const { dom } = await renderTestDashboard()
    t.after(() => { dom.window.close() })
    const document = dom.window.document
    const leaf = document.querySelector<HTMLElement>('details[data-json-depth="0"] > .json-children > .json-leaf')
    const branchSummary = document.querySelector<HTMLElement>('details[data-json-path="$.messages"] > summary')
    const rawHead = document.querySelector<HTMLElement>('.raw-head')
    const heading = document.querySelector<HTMLElement>('.raw-head h3')
    assert.ok(leaf)
    assert.ok(branchSummary)
    assert.ok(rawHead)
    assert.ok(heading)

    const rules = Array.from(document.styleSheets[0]?.cssRules ?? [])
    const ruleStyle = (selector: string): CSSStyleDeclaration => {
      const rule = rules.find(candidate => 'selectorText' in candidate && candidate.selectorText === selector)
      assert.ok(rule && 'style' in rule)
      return rule.style as CSSStyleDeclaration
    }
    const leafStyle = ruleStyle('.json-leaf')
    const summaryStyle = ruleStyle('.json-tree summary')
    assert.equal(summaryStyle.display, 'grid')
    assert.equal(summaryStyle.gridTemplateColumns.split(' ')[0], leafStyle.gridTemplateColumns.split(' ')[0])
    assert.ok(branchSummary.querySelector(':scope > .json-summary-line'))
    assert.equal(ruleStyle('.raw-head').flexWrap, 'wrap')
    assert.equal(ruleStyle('.raw-head h3').whiteSpace, 'nowrap')
  })

  it('preserves the selected detail DOM when a poll returns unchanged input', async (t) => {
    const { dom, poll } = await renderTestDashboard()
    t.after(() => { dom.window.close() })
    const document = dom.window.document
    const row = document.querySelector('tbody tr')
    assert.ok(row)
    row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    const detail = document.querySelector('#detailBody')
    assert.ok(detail)
    const renderedTitle = detail.firstElementChild
    assert.ok(renderedTitle)

    await poll()

    assert.equal(detail.firstElementChild, renderedTitle)
  })

  it('loads only the selected complete input and does not refetch it during polling', async (t) => {
    const { dom, poll, requests } = await renderTestDashboard()
    t.after(() => { dom.window.close() })
    assert.equal(requests.filter(url => url === '/cachescope/api').length, 1)
    assert.equal(requests.filter(url => url.startsWith('/cachescope/api/input')).length, 1)

    await poll()

    assert.equal(requests.filter(url => url === '/cachescope/api').length, 2)
    assert.equal(requests.filter(url => url.startsWith('/cachescope/api/input')).length, 1)
  })

  it('keeps keyboard focus on the keyed attempt row across selection and polling', async (t) => {
    const { dom, poll } = await renderTestDashboard()
    t.after(() => { dom.window.close() })
    const document = dom.window.document
    const row = document.querySelector<HTMLElement>('tbody tr')
    assert.ok(row)
    row.focus()
    row.dispatchEvent(new dom.window.KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
    assert.equal(document.activeElement, row)

    await poll()

    assert.equal(document.querySelector('tbody tr'), row)
    assert.equal(document.activeElement, row)
  })
})

describe('llm/stream observation', () => {
  it('constructs next synchronously, starts on iteration, and preserves chunk identity and order', async (t) => {
    const ctx = await setup()
    t.after(async () => { await ctx.root.fiber.dispose() })
    const chunks: StreamChunk[] = [
      { type: 'text-delta', index: 0, text: 'ok' },
      { type: 'usage', usage: { inputTokens: 20, outputTokens: 1, cacheReadTokens: 80 } },
      { type: 'finish', reason: { kind: 'stop' } },
    ]
    let constructed = 0
    const stream = dispatch(ctx, request(), () => {
      constructed++
      return (async function*() { yield* chunks })()
    })

    assert.equal(constructed, 1)
    assert.equal(ctx.cacheScope.snapshot().attempts.length, 0)
    const seen: StreamChunk[] = []
    for await (const chunk of stream) seen.push(chunk)
    assert.deepEqual(seen, chunks)
    assert.ok(seen.every((chunk, index) => chunk === chunks[index]))
    const attempt = ctx.cacheScope.snapshot().attempts[0]
    assert.ok(attempt)
    assert.equal(attempt.status, 'completed')
    assert.equal(attempt.usage?.cacheReadRatio, 0.8)
    assert.equal(attempt.rawState, 'available')
    assert.equal(Reflect.has(attempt, 'rawInput'), false)
    assert.equal(ctx.cacheScope.input(attempt.id)?.rawInput?.provider, 'test-provider')
  })

  it('summarizes append-only requests as locally prefix-friendly', async (t) => {
    const ctx = await setup()
    t.after(async () => { await ctx.root.fiber.dispose() })
    const inputs = [
      request(),
      request({ messages: [message('first'), message('second')] }),
    ]
    for (const input of inputs) {
      const stream = dispatch(ctx, input, () => (async function*() {
        yield { type: 'finish', reason: { kind: 'stop' } } as const
      })())
      for await (const _chunk of stream) {
        // Exhaust each call so its summary status is final.
      }
    }

    const summary = ctx.cacheScope.snapshot().summary
    assert.equal(summary.comparablePrefixAttempts, 1)
    assert.equal(summary.prefixFriendlyAttempts, 1)
    assert.equal(summary.prefixFriendlyRatio, 1)
  })

  it('rethrows synchronous next and iteration failures without replacing their identity', async (t) => {
    const ctx = await setup()
    t.after(async () => { await ctx.root.fiber.dispose() })
    const constructionError = new Error('construction sentinel')
    assert.throws(
      () => dispatch(ctx, request(), () => { throw constructionError }),
      error => error === constructionError,
    )
    assert.equal(ctx.cacheScope.snapshot().attempts.length, 0)

    const iterationError = new Error('iteration sentinel')
    const stream = dispatch(ctx, request(), () => (async function*() {
      yield { type: 'text-delta', index: 0, text: 'before error' } as const
      throw iterationError
    })())
    await assert.rejects(async () => {
      for await (const _chunk of stream) {
        // Consume until the original source throws.
      }
    }, error => error === iterationError)
    const failedAttempt = ctx.cacheScope.snapshot().attempts[0]
    assert.ok(failedAttempt)
    assert.equal(failedAttempt.status, 'failed')
  })

  it('closes the source on consumer break and retains raw input for only the configured recent attempts', async (t) => {
    const ctx = await setup()
    t.after(async () => { await ctx.root.fiber.dispose() })
    let sourceClosed = 0
    const first = dispatch(ctx, request(), () => (async function*() {
      try {
        yield { type: 'text-delta', index: 0, text: 'one' } as const
        yield { type: 'finish', reason: { kind: 'stop' } } as const
      } finally {
        sourceClosed++
      }
    })())
    for await (const _chunk of first) break
    assert.equal(sourceClosed, 1)
    const stoppedAttempt = ctx.cacheScope.snapshot().attempts[0]
    assert.ok(stoppedAttempt)
    assert.equal(stoppedAttempt.status, 'consumer-stopped')

    const second = dispatch(ctx, request({ messages: [message('second')] }), () => (async function*() {
      yield { type: 'finish', reason: { kind: 'stop' } } as const
    })())
    for await (const _chunk of second) {
      // Exhaust the terminal stream.
    }
    const attempts = ctx.cacheScope.snapshot().attempts
    assert.ok(attempts[0])
    assert.ok(attempts[1])
    assert.equal(attempts[0].rawState, 'available')
    assert.equal(attempts[1].rawState, 'evicted')
    assert.equal(ctx.cacheScope.input(attempts[0].id)?.rawInput?.provider, 'test-provider')
    assert.equal(ctx.cacheScope.input(attempts[1].id)?.rawInput, undefined)
  })
})

describe('loopback dashboard', () => {
  it('serves captured attempts with security headers and rejects cross-site origins', async (t) => {
    const ctx = new Context()
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    await ctx.plugin(CacheScopePlugin, { ...CONFIG, dashboard: true })
    t.after(async () => { await ctx.root.fiber.dispose() })

    const stream = dispatch(ctx, request(), () => (async function*() {
      yield { type: 'text-delta', index: 0, text: 'ok' } as const
      yield { type: 'usage', usage: { inputTokens: 25, outputTokens: 2, cacheReadTokens: 75 } } as const
      yield { type: 'finish', reason: { kind: 'stop' } } as const
    })())
    for await (const _chunk of stream) {
      // Exhaust the attempt before querying its read model.
    }

    const base = `http://127.0.0.1:${ctx.webServer.port}`
    const page = await fetch(`${base}/cachescope`)
    assert.equal(page.status, 200)
    assert.match(page.headers.get('content-security-policy') ?? '', /default-src 'none'/)
    assert.match(await page.text(), /DSH CacheScope/)

    const response = await fetch(`${base}/cachescope/api`)
    assert.equal(response.status, 200)
    const body = await response.json() as {
      attempts: Array<{ id: string, rawInput?: unknown, usage?: { cacheReadRatio?: number } }>
    }
    assert.equal(body.attempts[0]?.usage?.cacheReadRatio, 0.75)
    assert.equal(body.attempts[0]?.rawInput, undefined)

    const inputResponse = await fetch(`${base}/cachescope/api/input?id=${body.attempts[0]?.id}`)
    assert.equal(inputResponse.status, 200)
    const input = await inputResponse.json() as { rawInput?: { provider?: string } }
    assert.equal(input.rawInput?.provider, 'test-provider')

    const crossSite = await fetch(`${base}/cachescope/api`, {
      headers: { origin: 'https://attacker.example' },
    })
    assert.equal(crossSite.status, 403)
  })
})
