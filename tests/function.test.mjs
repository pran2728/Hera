// Runs the Deno tests for both Edge Functions if Deno is installed (DENO=/path/to/deno to override).
import { execSync } from 'node:child_process'
const deno = process.env.DENO || 'deno'
const run = (map, file) => execSync(`${deno} test --no-check --node-modules-dir=none --allow-net --allow-env --allow-read --import-map=${map} ${file}`, { stdio: 'inherit' })
run('tests/import_map.json', 'tests/function.test.ts')
run('tests/import_map.nudge.json', 'tests/nudge-function.test.ts')
