import { machineIdSync } from "node-machine-id"

let _id: string | null = null

export function getMachineId(): string {
  if (_id) return _id
  try {
    _id = machineIdSync(true)
  } catch {
    _id = 'fallback-key-alexandria-2026'
  }
  return _id
}
