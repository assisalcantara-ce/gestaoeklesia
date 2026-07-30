import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Obtém a chave de criptografia de 256 bits a partir da variável de ambiente TECHNICAL_ACCESS_ENCRYPTION_KEY.
 * Lança erro explícito se a variável de ambiente não estiver definida ou for inválida.
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.TECHNICAL_ACCESS_ENCRYPTION_KEY;
  if (!envKey || envKey.trim().length === 0) {
    throw new Error(
      '[CRITICAL_SECURITY_ERROR] A variável de ambiente TECHNICAL_ACCESS_ENCRYPTION_KEY não está configurada no servidor. O módulo de Acesso Técnico não pode inicializar sem uma chave de criptografia AES-256 válida.'
    );
  }

  const trimmedKey = envKey.trim();

  // Se a chave for fornecida em formato hexadecimal (64 caracteres hex = 32 bytes)
  if (trimmedKey.length === 64 && /^[0-9a-fA-F]+$/.test(trimmedKey)) {
    return Buffer.from(trimmedKey, 'hex');
  }

  // Se for uma string de 32 caracteres ou derivável em 32 bytes SHA-256
  return crypto.createHash('sha256').update(trimmedKey).digest();
}

export interface EncryptedData {
  encryptedPassword: string;
  iv: string;
  authTag: string;
}

/**
 * Criptografa uma senha em texto claro usando AES-256-GCM.
 */
export function encryptPassword(plainTextPassword: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96 bits recomendados para AES-GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainTextPassword, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedPassword: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Descriptografa uma senha criptografada usando AES-256-GCM.
 */
export function decryptPassword(encryptedPassword: string, ivHex: string, authTagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Gera uma senha aleatória extremamente forte de 32 caracteres contendo
 * letras maiúsculas, minúsculas, números e caracteres especiais.
 */
export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = upper + lower + numbers + symbols;

  // Garantir pelo menos 2 caracteres de cada grupo
  const required = [
    upper[crypto.randomInt(0, upper.length)],
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    lower[crypto.randomInt(0, lower.length)],
    numbers[crypto.randomInt(0, numbers.length)],
    numbers[crypto.randomInt(0, numbers.length)],
    symbols[crypto.randomInt(0, symbols.length)],
    symbols[crypto.randomInt(0, symbols.length)],
  ];

  const remainingLength = 32 - required.length;
  for (let i = 0; i < remainingLength; i++) {
    required.push(all[crypto.randomInt(0, all.length)]);
  }

  // Embaralhar o vetor de caracteres usando Fisher-Yates
  for (let i = required.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [required[i], required[j]] = [required[j], required[i]];
  }

  return required.join('');
}
