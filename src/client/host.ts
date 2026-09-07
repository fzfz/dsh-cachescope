import type { ComponentType } from 'react'
import type { RecordingSettings } from '../contracts.ts'
import type { Translate } from './locales.ts'
/** Public desktop service methods consumed by this external Client plugin. */
export interface SettingsSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: RecordingSettings | undefined
  writable: boolean
  mode: 'host' | 'memory'
}
export interface SettingsScope {
  getSnapshot(): SettingsSnapshot
  subscribe(listener: () => void): () => void
  set(field: keyof RecordingSettings, value: boolean | string): Promise<void>
}
export interface ClientContext {
  effect(callback: () => (() => void) | void, label?: string): void
  slots: {
    inject(name: string, register: () => (() => void)): void
    register<P>(options: { name: string; id: string; label?: () => string; order?: number }, component: ComponentType<P>): () => void
  }
  settingsScope: { bind(spec: { namespace: string }): SettingsScope }
  locale: {
    register(ns: string, dictionaries: { en: Record<string, string>; zh: Record<string, string> }): () => void
    bind(ns: string): Translate
    subscribe(listener: () => void): () => void
    getSnapshot(): { revision: number }
  }
}
