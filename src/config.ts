import z from '@deepseek-ai/schemastery'
import type { DiagnosticsConfig } from './types.ts'

/** Defaults are overridden by the composition, then by the desktop settings document. */
export const defaults: DiagnosticsConfig = {
  recordingEnabled: true, captureInput: 'metadata', maxAttempts: 500,
  rawRetentionAttempts: 12, maxRawInputBytes: 2_000_000, refreshMs: 1500,
  logAttempts: true, includeAuxiliary: true, dashboard: true,
}
export type Config = Partial<DiagnosticsConfig>
export const recordingSchema = z.object({
  recordingEnabled: z.boolean(), captureInput: z.union(['metadata', 'full'] as const), logAttempts: z.boolean(),
})
export const Config: z<Config> = z.object({
  recordingEnabled: z.boolean().default(defaults.recordingEnabled),
  captureInput: z.union(['metadata', 'full'] as const).default(defaults.captureInput),
  maxAttempts: z.natural().min(1).max(5000).default(defaults.maxAttempts),
  rawRetentionAttempts: z.natural().max(100).default(defaults.rawRetentionAttempts),
  maxRawInputBytes: z.natural().min(1024).max(20_000_000).default(defaults.maxRawInputBytes),
  refreshMs: z.natural().min(500).max(30_000).default(defaults.refreshMs),
  logAttempts: z.boolean().default(defaults.logAttempts),
  includeAuxiliary: z.boolean().default(defaults.includeAuxiliary),
  dashboard: z.boolean().default(defaults.dashboard), pricing: z.any(),
})
