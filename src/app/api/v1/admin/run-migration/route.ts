import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { consumeRateLimit } from '@/lib/rate-limit-db'

export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' })
    if (!guard.ok) return guard.response

    // Por segurança operacional, migrações via endpoint precisam ser explicitamente habilitadas.
    // Defina ADMIN_RUN_MIGRATIONS_ENABLED=true apenas quando for usar.
    if (process.env.ADMIN_RUN_MIGRATIONS_ENABLED !== 'true') {
      return NextResponse.json(
        { error: 'Endpoint de migração desabilitado (ADMIN_RUN_MIGRATIONS_ENABLED != true)' },
        { status: 403 }
      )
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const limit = Number(process.env.ADMIN_RATE_LIMIT_RUN_MIGRATION_PER_10MIN || 3)
    const windowMs = 10 * 60 * 1000
    const rate = await consumeRateLimit({
      bucketKey: `admin/run-migration:${guard.ctx.user.id}:${ip}`,
      limit,
      windowMs,
    })

    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retry_after_seconds: rate.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rate.retryAfterSeconds),
          },
        }
      )
    }

    const supabaseAdmin = guard.ctx.supabaseAdmin

    // Executar migration SQL
    const sql = `
      -- Fix: Make user_id nullable in pre_registrations table
      ALTER TABLE public.pre_registrations 
      DROP CONSTRAINT IF EXISTS pre_registrations_user_id_key;

      ALTER TABLE public.pre_registrations 
      ALTER COLUMN user_id DROP NOT NULL;

      ALTER TABLE public.pre_registrations 
      DROP CONSTRAINT IF EXISTS fk_pre_registrations_user_id;

      ALTER TABLE public.pre_registrations 
      ADD CONSTRAINT fk_pre_registrations_user_id 
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

      CREATE INDEX IF NOT EXISTS idx_pre_registrations_user_id_nullable ON public.pre_registrations(user_id);
    `

    // Usar rpc para executar SQL
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql })

    if (error) {
      console.error('SQL Error:', error)
      return NextResponse.json(
        { error: 'Failed to execute migration: ' + error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Migration executed successfully',
      data
    })

  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Failed to execute migration: ' + error.message },
      { status: 500 }
    )
  }
}
