// `npm run novos`: confere os inventários da caixa de entrada (../inventarios-teste/novos).
import { spawnSync } from 'node:child_process'

const r = spawnSync('npx', ['vitest', 'run', '--dir', '.', 'scripts/novos.test.ts'], { stdio: 'inherit', shell: true, env: { ...process.env, NOVOS: '1' } })
process.exit(r.status ?? 1)
