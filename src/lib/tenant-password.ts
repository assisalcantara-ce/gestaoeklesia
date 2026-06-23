import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32   // 256 bits
const IV_BYTES = 12    // GCM padrao
const TAG_BYTES = 16   // GCM auth tag

function requireEncKey(): Buffer {
  const raw = process.env.TENANT_PASSWORD_SECRET || process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw || raw.trim().length < 16) {
    throw new Error(
      '[tenant-password] TENANT_PASSWORD_SECRET ou CREDENTIALS_ENCRYPTION_KEY nao configurada.'
    )
  }
  const src = Buffer.from(raw.trim(), 'utf-8')
  const key = Buffer.alloc(KEY_BYTES, 0)
  src.copy(key, 0, 0, Math.min(src.length, KEY_BYTES))
  return key
}

export function encryptTenantPassword(password: string): string {
  const key = requireEncKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plain = Buffer.from(password, 'utf-8')
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptTenantPassword(encryptedBase64: string): string {
  const key = requireEncKey()
  const buf = Buffer.from(encryptedBase64, 'base64')
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('[tenant-password] Payload de senha invalido ou corrompido.')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf-8')
}
