import { createHmac } from 'crypto'

export function buildPasswordFingerprint(password: string): string {
  const pepper = process.env.PASSWORD_FINGERPRINT_PEPPER
  if (!pepper) {
    throw new Error('PASSWORD_FINGERPRINT_PEPPER_NOT_SET')
  }
  return createHmac('sha256', pepper).update(password).digest('hex')
}
