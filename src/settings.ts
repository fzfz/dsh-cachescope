import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { recordingSchema } from './config.ts'
import { plugin, type RecordingSettings } from './contracts.ts'
import type { CacheScope } from './diagnostics.ts'
import type { DiagnosticsConfig } from './types.ts'

export function installSettings(ctx: Context, config: DiagnosticsConfig, diagnostics: CacheScope): void {
  const base: RecordingSettings = {
    recordingEnabled: config.recordingEnabled, captureInput: config.captureInput, logAttempts: config.logAttempts,
  }
  const scope = ctx.settings.register(plugin.namespace, recordingSchema, { base, applies: 'live' })
  diagnostics.configure(scope.get())
  ctx.effect(() => scope.watch(next => diagnostics.configure(next)), 'CacheScope settings')
}
