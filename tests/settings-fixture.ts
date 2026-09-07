import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
export class TestSettings extends SettingsProvider {
  readonly writable = true
  static saved: Record<string, unknown> = {}
  protected async load(): Promise<Record<string, unknown>> { return structuredClone(TestSettings.saved) }
  protected async persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    TestSettings.saved[ns] = structuredClone(section)
  }
}
