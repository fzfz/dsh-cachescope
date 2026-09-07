import { useEffect, useSyncExternalStore } from 'react'
import { Button, Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { plugin } from '../contracts.ts'
import type { ClientContext } from './host.ts'
import { Dashboard } from './Dashboard.tsx'
import { SettingsPage } from './SettingsPage.tsx'
import { en, zh } from './locales.ts'
import css from './style.css'

export const name = plugin.namespace
export const inject = ['slots', 'locale', 'settingsScope']
export function apply(ctx: ClientContext): void {
  const scope = ctx.settingsScope.bind({ namespace: plugin.namespace })
  let open = false
  let returnFocus: HTMLElement | null = null
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  function close() { open = false; listeners.forEach(fn => fn()); returnFocus?.focus() }
  ctx.effect(() => ctx.locale.register(plugin.namespace, { en, zh }), 'CacheScope language')
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = plugin.id
    style.textContent = css
    document.head.append(style)
    return () => { style.remove(); close(); listeners.clear() }
  }, 'CacheScope styles')
  function useTranslation() {
    useSyncExternalStore(cb => ctx.locale.subscribe(cb), () => ctx.locale.getSnapshot().revision)
    return ctx.locale.bind(plugin.namespace)
  }
  function SidebarButton({ wide }: { wide: boolean }) {
    const t = useTranslation()
    return <Tooltip label={t('title')} disabled={wide}><span className="cs-sidebar-anchor"><Button className="cs-sidebar-button" aria-label={t('title')} onClick={event => {
      returnFocus = event.currentTarget; open = true; listeners.forEach(fn => fn())
    }} icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 13V8m4 5V3m4 10V6m4 7V1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}>{wide && t('title')}</Button></span></Tooltip>
  }
  function Panel() {
    const visible = useSyncExternalStore(subscribe, () => open)
    const t = useTranslation()
    // Keep focus within the native panel, restoring the trigger when it closes.
    useEffect(() => {
      if (!visible) return
      const panel = document.querySelector<HTMLElement>('.cs-modal')
      panel?.querySelector<HTMLElement>('button')?.focus()
      const trap = (event: KeyboardEvent) => {
        if (event.key !== 'Tab' || !panel) return
        const controls = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), summary, [tabindex="0"]')).filter(el => el.getClientRects().length)
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
      document.addEventListener('keydown', trap)
      return () => document.removeEventListener('keydown', trap)
    }, [visible])
    return <Modal open={visible} onClose={close} title={t('title')} closeLabel={t('close')} className="cs-modal" contentClassName="cs-modal-content">{visible && <Dashboard scope={scope} t={t} />}</Modal>
  }
  function Settings() { const t = useTranslation(); return <SettingsPage scope={scope} t={t} /> }
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: plugin.namespace }, SidebarButton))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: plugin.namespace }, Panel))
  ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: plugin.namespace, label: () => ctx.locale.bind(plugin.namespace)('title'), order: 41 }, Settings))
}
