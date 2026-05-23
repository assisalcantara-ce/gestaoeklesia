/**
 * ministry-credentials.ts
 *
 * Utilitários SERVER-SIDE para criptografia de credenciais de gateway de pagamento.
 *
 * ⚠️  NUNCA importe este arquivo em componentes 'use client'.
 * ⚠️  NUNCA retorne credenciais reais ao frontend.
 * ⚠️  O valor descriptografado só deve existir em memória durante a chamada ao gateway.
 *
 * Algoritmo: AES-256-GCM (Node.js crypto)
 * Formato:   base64(IV[12 bytes] + AuthTag[16 bytes] + Ciphertext)
 *
 * Configuração: defina CREDENTIALS_ENCRYPTION_KEY no .env.local e no Vercel Secrets
 * com no mínimo 32 caracteres aleatórios.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM  = 'aes-256-gcm'
const KEY_BYTES  = 32   // 256 bits
const IV_BYTES   = 12   // GCM padrão
const TAG_BYTES  = 16   // GCM auth tag

function requireEncKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!raw || raw.trim().length < 16) {
    throw new Error(
      '[ministry-credentials] CREDENTIALS_ENCRYPTION_KEY não configurada ou ' +
      'com menos de 16 caracteres. Defina a variável de ambiente com no mínimo ' +
      '32 caracteres aleatórios no Vercel Secrets e no .env.local.'
    )
  }
  // Deriva KEY_BYTES a partir da string: preenche ou trunca
  const src = Buffer.from(raw.trim(), 'utf-8')
  const key = Buffer.alloc(KEY_BYTES, 0)
  src.copy(key, 0, 0, Math.min(src.length, KEY_BYTES))
  return key
}

/**
 * Criptografa um objeto de credenciais e retorna uma string base64.
 * Armazene o resultado na coluna encrypted_credentials TEXT do banco.
 */
export function encryptCredentials(credentials: Record<string, string>): string {
  const key = requireEncKey()
  const iv  = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plain  = Buffer.from(JSON.stringify(credentials), 'utf-8')
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  // Layout: [IV 12B][TAG 16B][CIPHERTEXT]
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

/**
 * Descriptografa o payload armazenado no banco.
 * Use APENAS dentro de API Routes ou Server Actions — nunca em componentes.
 */
export function decryptCredentials(encryptedBase64: string): Record<string, string> {
  const key = requireEncKey()
  const buf = Buffer.from(encryptedBase64, 'base64')
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('[ministry-credentials] Payload de credencial inválido ou corrompido.')
  }
  const iv        = buf.subarray(0, IV_BYTES)
  const tag       = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher  = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(decrypted.toString('utf-8')) as Record<string, string>
}

/**
 * Mascara uma string sensível: mostra os 4 primeiros e 4 últimos caracteres.
 */
export function maskCredential(value: string | null | undefined): string | null {
  if (!value) return null
  const s = String(value)
  if (s.length <= 8) return '••••••••'
  return `${s.slice(0, 4)}••••••••${s.slice(-4)}`
}

/**
 * Retorna as credenciais mascaradas por tipo de gateway para exibição segura no frontend.
 */
export function maskGatewayCredentials(
  gateway: 'asaas' | 'efi',
  credentials: Record<string, string>
): Record<string, string | null> {
  if (gateway === 'asaas') {
    return {
      api_key: maskCredential(credentials.api_key),
    }
  }
  if (gateway === 'efi') {
    return {
      client_id:     maskCredential(credentials.client_id),
      client_secret: maskCredential(credentials.client_secret),
      certificate:   credentials.certificate
        ? '••••• (certificado salvo)'
        : null,
    }
  }
  return {}
}
