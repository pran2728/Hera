// Runs the Deno test for the chat function if Deno is installed.
import { execSync } from 'node:child_process'
const deno = process.env.DENO || 'deno'
execSync(`${deno} test --allow-net --allow-env --allow-read --no-check --import-map=tests/import_map.json tests/function.test.ts`, { stdio: 'inherit' })
