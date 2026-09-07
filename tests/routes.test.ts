import assert from 'node:assert/strict'
import { it } from 'node:test'
import { get } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import * as Plugin from '../src/index.ts'
import { defaults } from '../src/config.ts'
import { plugin } from '../src/contracts.ts'
import { TestSettings } from './settings-fixture.ts'

it('keeps native queries without the legacy page and returns structured route errors', async t => {
  TestSettings.saved = {}
  const ctx = new Context(); t.after(() => ctx.root.fiber.dispose())
  await ctx.plugin(TestSettings); await ctx.plugin(LlmRuntime); await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  const fiber = await ctx.plugin(Plugin, { ...defaults, dashboard: false })
  const base = `http://127.0.0.1:${ctx.webServer.port}`
  assert.equal((await fetch(base + plugin.dashboardPath)).status, 404)
  const data = await fetch(base + plugin.dataPath); assert.equal(data.status, 200)
  assert.equal((await data.json() as { recordingEnabled: boolean }).recordingEnabled, true)
  const head = await fetch(base + plugin.dataPath, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '')
  for (const [path, options, code, status] of [
    [plugin.dataPath, { method: 'POST' }, 'METHOD_NOT_ALLOWED', 405],
    [plugin.inputPath + '?id=wrong', {}, 'INVALID_ATTEMPT', 400],
    [plugin.inputPath + '?id=call-999', {}, 'ATTEMPT_NOT_FOUND', 404],
    [plugin.dataPath, { headers: { origin: 'https://other.example' } }, 'FORBIDDEN', 403],
  ] as const) {
    const response = await fetch(base + path, options)
    assert.equal(response.status, status)
    assert.equal((await response.json() as { error: { code: string } }).error.code, code)
    assert.equal(response.headers.get('cache-control'), 'no-store')
  }
  await new Promise<void>((resolve, reject) => {
    get(base + plugin.dataPath, { headers: { host: 'other.example' } }, response => {
      response.resume()
      response.on('end', () => {
        try { assert.equal(response.statusCode, 403); resolve() } catch (error) { reject(error) }
      })
    }).on('error', reject)
  })
  await fiber.dispose(); assert.equal((await fetch(base + plugin.dataPath)).status, 404)
})
