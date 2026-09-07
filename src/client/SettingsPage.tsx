import { useState, useSyncExternalStore } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsScope } from './host.ts'
import type { Translate, TextKey } from './locales.ts'
import type { RecordingSettings } from '../contracts.ts'

export function SettingsPage({ scope, t }: { scope: SettingsScope; t: Translate }) {
  const value = useSyncExternalStore(cb => scope.subscribe(cb), () => scope.getSnapshot())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<TextKey | null>(null)
  async function update(key: keyof RecordingSettings, checked: boolean) {
    setSaving(true); setError(null)
    try { await scope.set(key, key === 'captureInput' ? checked ? 'full' : 'metadata' : checked) }
    catch (error) { setError(error && typeof error === 'object' && 'code' in error && error.code === 'SETTINGS_CONFLICT' ? 'conflict' : 'saveFailed') }
    finally { setSaving(false) }
  }
  const settings = value.value
  return <section className="cs-settings" aria-label={t('settings')}>
    <h2>{t('settings')}</h2>
    {value.status !== 'ready' || !settings ? <p role="status">{t(value.status === 'loading' ? 'loading' : 'unavailable')}</p> : <>
      {!value.writable && <p>{t('readOnly')}</p>}
      {([
        ['recordingEnabled', 'recording', 'recordingHelp'], ['captureInput', 'capture', 'captureHelp'], ['logAttempts', 'logging', 'loggingHelp'],
      ] as const).map(([key, label, help]) => {
        const checked = key === 'captureInput' ? settings.captureInput === 'full' : settings[key]
        return <div className="cs-setting-row" key={key}>
          <div><strong id={`cs-${key}`}>{t(label)}</strong><p id={`cs-${key}-help`}>{t(help)}</p></div>
          <Button role="switch" aria-checked={checked} aria-labelledby={`cs-${key}`} aria-describedby={`cs-${key}-help`} className="cs-switch" data-checked={checked}
            disabled={saving || !value.writable || value.mode !== 'host' || (key !== 'recordingEnabled' && !settings.recordingEnabled)} onClick={() => { void update(key, !checked) }}><span /></Button>
        </div>
      })}
      {!settings.recordingEnabled && <p>{t('stoppedHelp')}</p>}
    </>}
    {error && <p role="alert">{t(error)}</p>}
  </section>
}
