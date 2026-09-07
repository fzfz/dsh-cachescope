import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage, type GenerateOptions, type StreamChunk } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import * as Plugin from '../src/index.ts'
import { defaults } from '../src/config.ts'
import { TestSettings } from './settings-fixture.ts'
import { plugin } from '../src/contracts.ts'

function request(): GenerateOptions { return { provider: 'test', model: 'model', sessionId: SessionId('one'), messages: [createUserMessage({ content: [{ type: 'text', text: 'input' }], source: { kind: 'user' } })] } }
async function setup(saved: Record<string, unknown> = {}) {
  TestSettings.saved = saved
  const ctx = new Context()
  await ctx.plugin(TestSettings)
  await ctx.plugin(LlmRuntime)
  const fiber = await ctx.plugin(Plugin, { ...defaults, captureInput: 'full', logAttempts: false, dashboard: false })
  return { ctx, fiber }
}
const token: StreamChunk = { type: 'text-delta', index: 0, text: 'one' }
const finish: StreamChunk = { type: 'finish', reason: { kind: 'stop' } }
function stream(ctx: Context, source: AsyncIterable<StreamChunk>, options = request()) { return ctx.waterfall(ctx.llm, 'llm/stream', options, () => source) }
async function set(ctx: Context, settings: object) {
  await ctx.settings.update(plugin.namespace, settings)
  await new Promise(resolve => setImmediate(resolve))
}

describe('desktop recording settings', () => {
  it('loads saved off state and persists settings across a new host context', async t => {
    const { ctx } = await setup({ cachescope: { recordingEnabled: false } }); t.after(() => ctx.root.fiber.dispose())
    const source = (async function*() { yield token; yield finish })()
    assert.equal(stream(ctx, source), source)
    for await (const _ of source) { /* consume */ }
    assert.equal(ctx.cacheScope.snapshot().attempts.length, 0)
    await set(ctx, { recordingEnabled: true })
    const next = await setup(TestSettings.saved); t.after(() => next.ctx.root.fiber.dispose())
    assert.equal(next.ctx.cacheScope.snapshot().recordingEnabled, true)
  })
  it('does not analyze a disabled request even when input access would throw', async t => {
    const { ctx } = await setup({ cachescope: { recordingEnabled: false } }); t.after(() => ctx.root.fiber.dispose())
    const options = request(); Object.defineProperty(options, 'messages', { get() { throw new Error('must not read input') } })
    const chunks = []; for await (const value of stream(ctx, (async function*() { yield token })(), options)) chunks.push(value)
    assert.equal(chunks[0], token); assert.equal(ctx.cacheScope.snapshot().attempts.length, 0)
  })
  it('invalidates a stream created before a stop, even if iterated after restart', async t => {
    const { ctx } = await setup(); t.after(() => ctx.root.fiber.dispose())
    const old = stream(ctx, (async function*() { yield token; yield finish })())
    await set(ctx, { recordingEnabled: false }); await set(ctx, { recordingEnabled: true })
    for await (const _ of old) { /* consume */ }
    assert.equal(ctx.cacheScope.snapshot().attempts.length, 0)
    for await (const _ of stream(ctx, (async function*() { yield finish })())) { /* consume */ }
    assert.equal(ctx.cacheScope.snapshot().attempts[0]?.diagnosis.kind, 'first-observation')
  })
  for (const end of ['complete', 'fail', 'cancel', 'consumer-stop'] as const) {
    it(`freezes an active record and preserves downstream ${end} after recording is disabled`, async t => {
      const { ctx } = await setup(); t.after(() => ctx.root.fiber.dispose())
      const failure = new Error('original')
      let closed = false
      const source = (async function*() {
        try { yield token; if (end === 'fail') throw failure; yield { type: 'usage', usage: { inputTokens: 9, outputTokens: 1 } } as const; yield finish }
        finally { closed = true }
      })()
      const abort = new AbortController()
      const iterator = stream(ctx, source, { ...request(), signal: abort.signal })[Symbol.asyncIterator]()
      assert.equal((await iterator.next()).value, token)
      await set(ctx, { recordingEnabled: false })
      const frozen = ctx.cacheScope.snapshot().attempts[0]!
      assert.equal(frozen.status, 'recording-stopped')
      await set(ctx, { recordingEnabled: true })
      if (end === 'fail') await assert.rejects(iterator.next(), error => error === failure)
      else if (end === 'cancel' || end === 'consumer-stop') { if (end === 'cancel') abort.abort(); await iterator.return?.() }
      else { while (!(await iterator.next()).done) { /* consume */ } }
      assert.equal(closed, true)
      assert.deepEqual(ctx.cacheScope.snapshot().attempts[0], frozen)
      for await (const _ of stream(ctx, (async function*() { yield finish })())) { /* consume */ }
      assert.equal(ctx.cacheScope.snapshot().attempts[0]?.diagnosis.kind, 'first-observation')
    })
  }
  it('purges retained input without deleting metadata or repopulating old streams', async t => {
    const { ctx } = await setup(); t.after(() => ctx.root.fiber.dispose())
    const iterator = stream(ctx, (async function*() { yield token; yield finish })())[Symbol.asyncIterator]()
    await iterator.next(); const id = ctx.cacheScope.snapshot().attempts[0]!.id
    assert.ok(ctx.cacheScope.input(id)?.rawInput)
    await set(ctx, { captureInput: 'metadata' }); assert.equal(ctx.cacheScope.input(id)?.rawInput, undefined)
    assert.equal(ctx.cacheScope.input(id)?.rawState, 'disabled')
    await set(ctx, { captureInput: 'full' }); await iterator.next(); await iterator.next()
    assert.equal(ctx.cacheScope.input(id)?.rawInput, undefined)
  })
  it('uses the new DSH chunk union for first-token timing', async t => {
    const { ctx } = await setup(); t.after(() => ctx.root.fiber.dispose())
    for (const chunk of [
      { type: 'text-delta', index: 0, text: '' }, { type: 'reasoning-delta', index: 0, text: '' },
      { type: 'reasoning-delta', index: 0, text: 'reason' }, { type: 'tool-call-delta', index: 0, id: 'tool', argumentsDelta: '' },
      { type: 'tool-call-delta', index: 0, id: 'tool', argumentsDelta: '{' }, { type: 'tool-call-delta', index: 0, id: 'tool', name: 'echo', argumentsDelta: '' },
    ] as StreamChunk[]) {
      for await (const _ of stream(ctx, (async function*() { yield chunk; yield finish })())) { /* consume */ }
      const reported = ctx.cacheScope.snapshot().attempts[0]?.firstTokenMs !== undefined
      assert.equal(reported, chunk.type === 'reasoning-delta' ? chunk.text !== '' : chunk.type === 'tool-call-delta' && (chunk.argumentsDelta !== '' || chunk.name !== undefined))
    }
  })
  it('unregisters settings and observations on unload, then registers once on reload', async t => {
    const { ctx, fiber } = await setup(); t.after(() => ctx.root.fiber.dispose())
    await fiber.dispose()
    assert.equal(ctx.settings.get(plugin.namespace), undefined)
    await ctx.plugin(Plugin, { ...defaults, logAttempts: false, dashboard: false })
    for await (const _ of stream(ctx, (async function*() { yield finish })())) { /* consume */ }
    assert.equal(ctx.cacheScope.snapshot().attempts.length, 1)
  })
  it('rejects invalid and conflicting settings without changing the effective value', async t => {
    const { ctx } = await setup(); t.after(() => ctx.root.fiber.dispose())
    await assert.rejects(ctx.settings.update(plugin.namespace, { captureInput: 'invalid' }))
    await set(ctx, { recordingEnabled: false })
    await assert.rejects(ctx.settings.update(plugin.namespace, { recordingEnabled: true }, 0))
    assert.equal(ctx.cacheScope.snapshot().recordingEnabled, false)
  })
})

it('stops writes by an already iterating stream when the plugin is unloaded', async t => {
  const { ctx, fiber } = await setup(); t.after(() => ctx.root.fiber.dispose())
  const diagnostics = ctx.cacheScope
  const iterator = stream(ctx, (async function*() { yield token; yield finish })())[Symbol.asyncIterator]()
  await iterator.next(); await fiber.dispose()
  const stopped = diagnostics.snapshot().attempts[0]
  assert.equal(stopped?.status, 'recording-stopped')
  await iterator.next(); await iterator.next()
  assert.deepEqual(diagnostics.snapshot().attempts[0], stopped)
})

it('suppresses successful and failed call summaries while recording or logging is off', async t => {
  const { ctx } = await setup(); t.after(() => ctx.root.fiber.dispose())
  const messages: unknown[][] = []
  ctx.logger.exporter({ export: message => { messages.push(message.args) } })
  const summaries = () => messages.filter(args => String(args[0]).includes('[cachescope] call-')).length
  await set(ctx, { logAttempts: true })
  for await (const _ of stream(ctx, (async function*() { yield finish })())) { /* consume */ }
  assert.equal(summaries(), 1)
  await set(ctx, { logAttempts: false })
  for await (const _ of stream(ctx, (async function*() { yield finish })())) { /* consume */ }
  assert.equal(summaries(), 1)
  await set(ctx, { logAttempts: true, recordingEnabled: false })
  const failure = new Error('original')
  await assert.rejects(async () => { for await (const _ of stream(ctx, (async function*(): AsyncGenerator<StreamChunk> { throw failure })())) { /* consume */ } }, error => error === failure)
  assert.equal(summaries(), 1)
})
