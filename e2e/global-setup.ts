import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Garante as tabelas no D1 local antes de subir o servidor.
export default function globalSetup() {
  const result = spawnSync('npm', ['run', 'db:migrate:local'], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(
      'Falha ao aplicar as migrations no D1 local (npm run db:migrate:local).',
    )
  }
}
