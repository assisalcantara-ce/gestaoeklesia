import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

type AlertLevel = 'warning' | 'critical'

interface CapacityAlert {
  level: AlertLevel
  code: 'DB_NEAR_LIMIT' | 'DB_LIMIT_REACHED' | 'DB_LIMIT_NOT_CONFIGURED'
  message: string
}

interface CapacityMetrics {
  generatedAt: string
  plan: {
    name: string | null
    dbBytesLimit: number | null
    warnPct: number
    criticalPct: number
  }
  usage: {
    dbBytesUsed: number
  }
  computed: {
    dbPercentUsed: number | null
    dbBytesRemaining: number | null
  }
  alerts: CapacityAlert[]
}

function parseEnvInt(value: string | undefined): number | null {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function clampPct(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(100, value))
}

function parseBigintLike(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response

    const { supabaseAdmin: supabase } = result.ctx

    const planName = process.env.SUPABASE_PLAN_NAME || null
    const dbBytesLimit = parseEnvInt(process.env.SUPABASE_PLAN_DB_BYTES_LIMIT)
    const warnPct = clampPct(parseEnvInt(process.env.SUPABASE_PLAN_DB_WARN_PCT) ?? 80, 80)
    const criticalPct = clampPct(parseEnvInt(process.env.SUPABASE_PLAN_DB_CRITICAL_PCT) ?? 95, 95)

    let dbBytesUsed = 0

    // Preferência: tamanho TOTAL do banco (todos os schemas)
    const { data: dbSizeBytes, error: dbSizeError } = await supabase.rpc('get_database_size_bytes')
    const parsedDbSize = parseBigintLike(dbSizeBytes)

    if (!dbSizeError && parsedDbSize !== null) {
      dbBytesUsed = parsedDbSize
    } else {
      // Fallback: somar apenas schema public (menos preciso)
      if (dbSizeError) {
        console.log('[SUPABASE METRICS] RPC get_database_size_bytes indisponível:', dbSizeError.message)
      }

      const { data: tables, error: tablesError } = await supabase.rpc('get_tables_info');
      if (tables && !tablesError) {
        dbBytesUsed = (tables as any[]).reduce((sum: number, t: any) => {
          const size = Number(t.table_size || 0)
          return sum + (Number.isFinite(size) ? size : 0)
        }, 0)
      } else {
        console.log('[SUPABASE METRICS] RPC get_tables_info indisponível');
        if (tablesError) console.log('[SUPABASE METRICS] Erro RPC:', tablesError.message);
      }
    }

    const alerts: CapacityAlert[] = []
    let dbPercentUsed: number | null = null
    let dbBytesRemaining: number | null = null

    if (dbBytesLimit && dbBytesLimit > 0) {
      dbPercentUsed = Math.round((dbBytesUsed / dbBytesLimit) * 100)
      dbBytesRemaining = Math.max(dbBytesLimit - dbBytesUsed, 0)

      if (dbBytesUsed >= dbBytesLimit) {
        alerts.push({
          level: 'critical',
          code: 'DB_LIMIT_REACHED',
          message: 'Limite do plano atingido (pode causar estagnação por falta de recursos).',
        })
      } else if (dbPercentUsed >= criticalPct) {
        alerts.push({
          level: 'critical',
          code: 'DB_NEAR_LIMIT',
          message: `Uso do banco acima de ${criticalPct}%. Planeje upgrade para evitar estagnação.`,
        })
      } else if (dbPercentUsed >= warnPct) {
        alerts.push({
          level: 'warning',
          code: 'DB_NEAR_LIMIT',
          message: `Uso do banco acima de ${warnPct}%. Monitore de perto.`,
        })
      }
    } else {
      alerts.push({
        level: 'warning',
        code: 'DB_LIMIT_NOT_CONFIGURED',
        message: 'Limite do plano não configurado (defina SUPABASE_PLAN_DB_BYTES_LIMIT).',
      })
    }

    const metrics: CapacityMetrics = {
      generatedAt: new Date().toISOString(),
      plan: { name: planName, dbBytesLimit, warnPct, criticalPct },
      usage: { dbBytesUsed },
      computed: { dbPercentUsed, dbBytesRemaining },
      alerts,
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Erro ao buscar métricas do Supabase:', error);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      plan: { name: process.env.SUPABASE_PLAN_NAME || null, dbBytesLimit: parseEnvInt(process.env.SUPABASE_PLAN_DB_BYTES_LIMIT), warnPct: 80, criticalPct: 95 },
      usage: { dbBytesUsed: 0 },
      computed: { dbPercentUsed: null, dbBytesRemaining: null },
      alerts: [
        {
          level: 'critical',
          code: 'DB_NEAR_LIMIT',
          message: 'Erro ao carregar métricas.',
        },
      ],
    });
  }
}
