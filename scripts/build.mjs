/** Produce a clean ESM build and make declaration imports resolve inside the npm package. */
import { spawn } from 'node:child_process'
import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const output = join(root, 'lib')
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')

await rm(output, { recursive: true, force: true })
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [tsc, '-p', join(root, 'tsconfig.build.json')], {
    cwd: root,
    stdio: 'inherit',
  })
  child.once('error', reject)
  child.once('exit', (code, signal) => {
    if (code === 0) resolve()
    else reject(new Error(`TypeScript build failed (${signal ?? `exit ${String(code)}`})`))
  })
})

for (const entry of await readdir(output)) {
  if (!entry.endsWith('.d.ts')) continue
  const path = join(output, entry)
  const declaration = await readFile(path, 'utf8')
  const rewritten = declaration.replace(/(["']\.\.?\/[^"']+)\.ts(["'])/g, '$1.js$2')
  if (rewritten !== declaration) await writeFile(path, rewritten)
}

// Desktop injects these modules. The Client artifact contains only CacheScope code.
const { build } = await import('esbuild')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
await build({
  entryPoints: [join(root, 'src/client/index.tsx')],
  outfile: join(root, 'client/client.js'), bundle: true, format: 'cjs', platform: 'browser',
  target: 'es2022', jsx: 'automatic', loader: { '.css': 'text' },
  external: ['react', 'react/jsx-runtime', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: { js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(manifest.name)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;` },
  footer: { js: 'return module.exports; } });' },
  define: { 'process.env.NODE_ENV': '"production"' },
})
