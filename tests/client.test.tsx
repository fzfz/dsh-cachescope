import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'
import { JSDOM } from 'jsdom'
import { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Dashboard } from '../src/client/Dashboard.tsx'
import { SettingsPage } from '../src/client/SettingsPage.tsx'
import { apply } from '../src/client/index.tsx'
import { en, type Translate } from '../src/client/locales.ts'
import type { ClientContext, SettingsSnapshot, SettingsScope } from '../src/client/host.ts'
import { filterAttempts, initialFilters, inferenceFor, evolution, evidenceOf } from '../src/client/dashboard-state.ts'
import { summarizeAttempts } from '../src/summary.ts'
import { CacheScope } from '../src/diagnostics.ts'
import { Context } from '@deepseek-ai/cordis'
import { defaults } from '../src/config.ts'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'

const t: Translate = key => en[key]
let dom: JSDOM
let root: Root
let container: HTMLElement
let copied = ''
const originalFetch = globalThis.fetch
before(() => {
  dom = new JSDOM('<html><body><main id="root"></main></body></html>', { url: 'http://127.0.0.1:40123', pretendToBeVisual: true })
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async (text: string) => { copied = text } }, configurable: true })
})
after(() => { globalThis.fetch = originalFetch; dom.window.close() })
function scopeFixture() {
  let value: SettingsSnapshot = { status: 'ready', writable: true, mode: 'host', value: { recordingEnabled: true, captureInput: 'full', logAttempts: true } }
  const listeners = new Set<() => void>()
  const scope: SettingsScope = {
    getSnapshot: () => value,
    subscribe: cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    set: async (field, next) => { value = { ...value, value: { ...value.value!, [field]: next } }; listeners.forEach(fn => fn()) },
  }
  return { scope, change(next: Partial<SettingsSnapshot>) { value = { ...value, ...next }; listeners.forEach(fn => fn()) } }
}
async function mount(component: React.ReactNode) {
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => { root.render(component) })
}
async function unmount() { await act(async () => root.unmount()); container.remove() }
async function click(text: string, target: ParentNode = document) {
  const button = Array.from(target.querySelectorAll<HTMLButtonElement>('button')).find(el => el.textContent === text || el.getAttribute('aria-label') === text || document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent === text)
  assert.ok(button, `Button ${text}`)
  await act(async () => button.click())
}
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) }) }
function fixture() {
  const ctx = new Context(); const diagnostics = new CacheScope(ctx, { ...defaults, captureInput: 'full' })
  const req = { provider: 'provider', model: 'model', sessionId: SessionId('session'), system: 'system', messages: [createUserMessage({ content: [{ type: 'text' as const, text: 'PRIVATE INPUT' }], source: { kind: 'user' as const } })] }
  const first = diagnostics.begin(req, 'conversation')
  diagnostics.observe(first, { type: 'usage', usage: { inputTokens: 20, cacheReadTokens: 80, outputTokens: 2 } }); diagnostics.observe(first, { type: 'finish', reason: { kind: 'stop' } }); diagnostics.complete(first)
  const second = diagnostics.begin(req, 'conversation')
  diagnostics.observe(second, { type: 'usage', usage: { inputTokens: 10, cacheReadTokens: 90, outputTokens: 2 } }); diagnostics.observe(second, { type: 'finish', reason: { kind: 'stop' } }); diagnostics.complete(second)
  return { ctx, diagnostics }
}

describe('native desktop UI', () => {
  it('saves switches through the host and distinguishes off, read-only, failure and unavailable states', async () => {
    const { scope, change } = scopeFixture()
    await mount(<SettingsPage scope={scope} t={t} />)
    await click(t('recording'))
    assert.equal(scope.getSnapshot().value?.recordingEnabled, false)
    assert.equal(document.querySelector<HTMLButtonElement>('[aria-labelledby="cs-captureInput"]')?.disabled, true)
    await click(t('recording'))
    scope.set = async () => { throw new Error('write failed') }
    await click(t('logging')); assert.match(container.textContent!, /not saved/)
    assert.equal(document.querySelector('[aria-labelledby="cs-logAttempts"]')?.getAttribute('aria-checked'), 'true')
    scope.set = async () => { throw { code: 'SETTINGS_CONFLICT' } }
    await click(t('logging')); assert.match(container.textContent!, /saved first/)
    await act(async () => change({ writable: false })); assert.match(container.textContent!, /read-only/)
    await act(async () => change({ status: 'unavailable', value: undefined })); assert.match(container.textContent!, /unavailable/)
    await unmount()
  })
  it('renders real native controls, filters calls, copies metadata without raw text, and purges raw input', async () => {
    const { ctx, diagnostics } = fixture(); const { scope } = scopeFixture()
    let requests = 0; let inputs = 0
    globalThis.fetch = async url => { requests++; if (String(url).includes('/input')) inputs++; return new Response(JSON.stringify(String(url).includes('/input') ? diagnostics.input(new URL(String(url), 'http://localhost').searchParams.get('id')!) : diagnostics.snapshot())) }
    await mount(<Dashboard scope={scope} t={t} />); await settle()
    assert.match(container.textContent!, /90%/); assert.match(container.textContent!, /85%/)
    assert.equal(inputs, 1)
    await click(t('copyMetadata')); assert.ok(JSON.parse(copied).attempts.length === 2); assert.ok(!copied.includes('PRIVATE INPUT'))
    await click(t('expand')); assert.match(container.textContent!, /PRIVATE INPUT/)
    await click(t('collapse')); assert.ok(!container.textContent!.includes('PRIVATE INPUT'))
    await click(t('expand'))
    await act(async () => scope.set('captureInput', 'metadata')); assert.ok(!container.textContent!.includes('PRIVATE INPUT'))
    await click(t('pause'))
    const before = requests; await click(t('refresh')); assert.ok(requests > before)
    await click('Purpose'); await click(t('direct')); assert.match(container.textContent!, /No calls match/)
    assert.equal(document.querySelector('iframe'), null)
    await unmount(); const finalRequests = requests; await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(requests, finalRequests)
    await ctx.root.fiber.dispose()
  })
  it('renders input failures, supports retry and switches the selected call', async () => {
    const { ctx, diagnostics } = fixture(); const { scope } = scopeFixture()
    let failed = true
    globalThis.fetch = async url => {
      if (String(url).includes('/input')) {
        if (failed) throw new Error('offline')
        return new Response(JSON.stringify(diagnostics.input(new URL(String(url), 'http://localhost').searchParams.get('id')!)))
      }
      return new Response(JSON.stringify(diagnostics.snapshot()))
    }
    await mount(<Dashboard scope={scope} t={t} />); await settle(); assert.match(container.textContent!, /could not be loaded/)
    failed = false; await click(t('retry')); await settle(); assert.ok(container.querySelector('.cs-input-inspector'))
    await click('call-1'); await settle(); assert.match(container.querySelector('.cs-detail h3')!.textContent!, /call-1/)
    await click(t('focused')); assert.equal(container.querySelector('table'), null); await click(t('unfocus')); assert.ok(container.querySelector('table'))
    await unmount(); await ctx.root.fiber.dispose()
  })
  it('registers sidebar/settings/panel contributions and closes the native Modal without touching a draft', async () => {
    const { ctx: host, diagnostics } = fixture(); const { scope } = scopeFixture()
    globalThis.fetch = async url => new Response(JSON.stringify(String(url).includes('/input') ? diagnostics.input('call-2') : diagnostics.snapshot()))
    const entries = new Map<string, ComponentType<any>>()
    const disposers: (() => void)[] = []
    const ctx: ClientContext = {
      effect(callback) { const dispose = callback(); if (dispose) disposers.push(dispose) },
      slots: { inject(_name, register) { disposers.push(register()) }, register(options, component) { entries.set(options.name, component); return () => { entries.delete(options.name) } } },
      settingsScope: { bind: () => scope }, locale: { register: () => () => {}, bind: () => t, subscribe: () => () => {}, getSnapshot: () => ({ revision: 0 }) },
    }
    apply(ctx); assert.equal(entries.size, 3)
    const Sidebar = entries.get('sidebar.footer.action')!; const Panel = entries.get('shell.overlay')!
    await mount(<><input defaultValue="UNSENT DRAFT" /><Sidebar wide={false} /><Panel /></>)
    await click(t('title')); await settle(); assert.ok(document.querySelector('[role="dialog"]'))
    await act(async () => document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    assert.equal(document.querySelector('[role="dialog"]'), null)
    assert.equal(container.querySelector('input')?.value, 'UNSENT DRAFT')
    assert.equal(document.activeElement?.getAttribute('aria-label'), t('title'))
    await unmount(); for (const dispose of disposers.reverse()) dispose()
    assert.equal(entries.size, 0); assert.equal(document.querySelector('style[data-plugin]'), null)
    await host.root.fiber.dispose()
  })
})

describe('dashboard data projections', () => {
  it('filters and sorts every supported dimension with absent usage kept distinct', async () => {
    const { ctx, diagnostics } = fixture(); const attempts = diagnostics.snapshot().attempts
    assert.equal(filterAttempts(attempts, { ...initialFilters, query: 'call-1' }).length, 1)
    for (const key of ['sessionId', 'provider', 'model', 'purpose', 'status'] as const) {
      assert.equal(filterAttempts(attempts, { ...initialFilters, [key]: 'absent' }).length, 0)
      assert.equal(filterAttempts(attempts, { ...initialFilters, [key]: attempts[0]![key]! }).length, 2)
    }
    assert.equal(filterAttempts(attempts, { ...initialFilters, evidence: 'friendly-read' }).length, 1)
    assert.equal(filterAttempts(attempts, { ...initialFilters, sort: 'oldest' })[0]?.id, 'call-1')
    assert.equal(filterAttempts(attempts, { ...initialFilters, sort: 'cache-desc' })[0]?.id, 'call-2')
    assert.equal(filterAttempts(attempts, { ...initialFilters, sort: 'ttft-desc' })[0]?.id, 'call-2')
    const second = attempts[0]!
    assert.equal(evidenceOf({ ...second, usage: { ...second.usage!, cacheReadTokens: 0 } }), 'friendly-zero')
    assert.equal(evidenceOf({ ...second, diagnosis: { ...second.diagnosis, kind: 'system-changed' } }), 'changed-read')
    assert.equal(evidenceOf({ ...second, usage: { ...second.usage!, cacheReadTokens: 0 }, diagnosis: { ...second.diagnosis, kind: 'system-changed' } }), 'changed-zero')
    assert.equal(summarizeAttempts(attempts).cacheReadRatio, 0.85)
    await ctx.root.fiber.dispose()
  })
  it('marks structured input paths and refuses incomplete token reconciliation', async () => {
    const { ctx, diagnostics } = fixture(); const [second, first] = diagnostics.snapshot().attempts
    assert.equal(inferenceFor(first!, '$.system'), 'unknown')
    assert.equal(inferenceFor(second!, '$.system'), 'stable'); assert.equal(inferenceFor(second!, '$.messages[0]'), 'stable')
    const changed = { ...second!, diagnosis: { ...second!.diagnosis, systemStable: false } }
    assert.equal(inferenceFor(changed, '$.system'), 'changed'); assert.equal(inferenceFor(changed, '$.messages[0]'), 'downstream')
    assert.equal(inferenceFor(second!, '$.model'), undefined)
    assert.equal(evolution(second!.usage, first!.usage).current, 10)
    assert.equal(evolution(undefined, first!.usage).unavailable, 'noBaseline')
    const noRead = { ...second!.usage! }; delete noRead.cacheReadTokens
    assert.equal(evolution(noRead, first!.usage).unavailable, 'noRead')
    assert.equal(evolution({ ...second!.usage!, cacheWriteTokens: 1 }, first!.usage).unavailable, 'noWrite')
    await ctx.root.fiber.dispose()
  })
})
