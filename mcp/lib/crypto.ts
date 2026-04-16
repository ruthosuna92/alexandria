import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'alexandria-v1-salt-2026'

function deriveKey(machineId: string): Buffer {
  return crypto.scryptSync(machineId + SALT, SALT, 32)
}

export function decrypt(encryptedData: string, machineId: string): string {
  const key = deriveKey(machineId)
  const buf = Buffer.from(encryptedData, 'base64')
  const iv  = buf.subarray(0, 16)
  const tag = buf.subarray(16, 32)
  const enc = buf.subarray(32)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final('utf8')
}

export function encrypt(text: string, machineId: string): string {
  const key = deriveKey(machineId)
  const iv  = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}
