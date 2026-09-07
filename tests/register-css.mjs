import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
// Native controls import CSS modules; DOM tests need their class names, not a CSS renderer.
registerHooks({ load(url, context, nextLoad) {
  if (!url.endsWith('.css')) return nextLoad(url, context)
  const css = readFileSync(new URL(url), 'utf8')
  const source = url.endsWith('.module.css')
    ? 'export default new Proxy({}, {get: (_, key) => String(key)})'
    : `export default ${JSON.stringify(css)}`
  return { format: 'module', source, shortCircuit: true }
} })
