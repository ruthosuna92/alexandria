import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { machineIdSync } = require('node-machine-id')

let _id: string | null = null

export function getMachineId(): string {
  if (_id) return _id
  try { _id = machineIdSync(true) as string }
  catch { _id = 'fallback-key-alexandria-2026' }
  return _id!
}
