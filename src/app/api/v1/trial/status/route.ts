import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

  if (authError || !authData?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('pre_registrations')
    .select('id, trial_expires_at, trial_days, status')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ expired: false })
  }

  const expiresAt = data.trial_expires_at ? new Date(data.trial_expires_at) : null
  const isExpired = data.status === 'encerrado' || (expiresAt && expiresAt.getTime() <= Date.now())

  if (isExpired && data.status !== 'encerrado') {
    await supabaseAdmin
      .from('pre_registrations')
      .update({ status: 'encerrado' })
      .eq('id', data.id)
  }

  return NextResponse.json({
    expired: isExpired,
    status: data.status,
    trial_expires_at: data.trial_expires_at,
    trial_days: data.trial_days ?? null,
  })
}
