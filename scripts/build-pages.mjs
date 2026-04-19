import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const compositionDir = resolve(rootDir, 'composition')
const distDir = resolve(rootDir, 'dist')

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

rmSync(distDir, { recursive: true, force: true })
mkdirSync(distDir, { recursive: true })

run('npm', ['run', 'build:data'], rootDir)
run('npm', ['run', 'build', '--', '--outDir', 'dist/market-map'], rootDir)

run('npm', ['run', 'build:data'], compositionDir)
run('npm', ['run', 'build', '--', '--outDir', '../dist/composition'], compositionDir)

copyFileSync(resolve(rootDir, 'pages', 'index.html'), resolve(distDir, 'index.html'))
