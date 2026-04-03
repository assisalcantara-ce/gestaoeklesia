type JsonLike = string | number | boolean | null | JsonLike[] | { [key: string]: JsonLike }

interface UppercaseNormalizerOptions {
  preserveKeys?: string[]
}

const DEFAULT_PRESERVE_KEYS = new Set([
  'id',
  'email',
  'status',
  'role',
  'sexo',
  'estado_civil',
  'tipo_registro',
  'status_processo',
  'foto_url',
  'fotourl',
  'photo_url',
  'photourl',
  'avatar_url',
  'avatarurl',
  'image_url',
  'imageurl',
  'url',
  'href',
  'src',
  'certificado_template_key',
])

function isIsoDateLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:[t\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:z|[+-]\d{2}:\d{2})?)?$/i.test(value)
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isUrlLike(value: string): boolean {
  return /^(https?:\/\/|data:|blob:|ftp:\/\/)/i.test(value)
}

function shouldPreserveStringByValue(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true

  return (
    isIsoDateLike(trimmed) ||
    isUuidLike(trimmed) ||
    isEmailLike(trimmed) ||
    isUrlLike(trimmed)
  )
}

function shouldPreserveByKey(key: string | null, preserveKeys: Set<string>): boolean {
  if (!key) return false

  const lowered = key.toLowerCase()
  if (preserveKeys.has(lowered)) return true

  if (lowered.endsWith('_id') || lowered.endsWith('id')) return true

  return false
}

function normalizeInternal(value: JsonLike, parentKey: string | null, preserveKeys: Set<string>): JsonLike {
  if (typeof value === 'string') {
    if (shouldPreserveByKey(parentKey, preserveKeys) || shouldPreserveStringByValue(value)) {
      return value
    }
    return value.toLocaleUpperCase('pt-BR')
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeInternal(item, parentKey, preserveKeys))
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, JsonLike>
    const out: Record<string, JsonLike> = {}
    for (const [key, inner] of Object.entries(obj)) {
      out[key] = normalizeInternal(inner, key, preserveKeys)
    }
    return out
  }

  return value
}

export function normalizePayloadToUppercase<T>(
  value: T,
  options?: UppercaseNormalizerOptions,
): T {
  const preserveKeys = new Set(DEFAULT_PRESERVE_KEYS)
  for (const key of options?.preserveKeys || []) {
    preserveKeys.add(String(key).toLowerCase())
  }

  return normalizeInternal(value as JsonLike, null, preserveKeys) as T
}
