import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireFlowAuth } from '@/lib/flows/flow-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Autentica o usuário e obtém o ministério do contexto da requisição
    const authContext = await requireFlowAuth(request)
    const { ministryId, userId } = authContext
    const supabase = createServerClient()

    // 1. Dados do Ministério (verificar se preencheu CNPJ ou telefone ou se alterou o nome padrão)
    const { data: ministry } = await supabase
      .from('tenants')
      .select('cnpj, telefone, responsavel, name')
      .eq('id', ministryId)
      .maybeSingle()

    const hasMinistryData = !!(
      ministry?.cnpj ||
      ministry?.telefone ||
      ministry?.responsavel ||
      (ministry?.name && !ministry.name.toLowerCase().includes('eklésia') && !ministry.name.toLowerCase().includes('igreja provisória'))
    )

    // 2. Primeira Congregação
    const { count: countCongregacoes } = await supabase
      .from('congregacoes')
      .select('*', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)

    const hasCongregacao = (countCongregacoes || 0) > 0

    // 3. Convidar Usuários (contagem em ministry_users > 1)
    const { count: countUsers } = await supabase
      .from('ministry_users')
      .select('*', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)

    const hasInvitedUsers = (countUsers || 0) > 1

    // 4. Cadastrar primeiro membro
    const { count: countMembers } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)

    const hasMembers = (countMembers || 0) > 0

    // 5. Registrar primeiro culto
    const { count: countCultos } = await supabase
      .from('culto_registros')
      .select('*', { count: 'exact', head: true })
      .eq('ministry_id', ministryId)

    const hasCultos = (countCultos || 0) > 0

    // Obter parâmetros da URL
    const { searchParams } = new URL(request.url)
    const tourCompleted = searchParams.get('tourCompleted') === 'true'

    // Checklist final estruturado
    const steps = [
      { id: 'tour', label: 'Conhecer o Gestão Eklésia', completed: tourCompleted, path: '#tour' },
      { id: 'ministry', label: 'Completar dados do Ministério', completed: hasMinistryData, path: '/configuracoes' },
      { id: 'congregacao', label: 'Cadastrar primeira Congregação', completed: hasCongregacao, path: '/secretaria/congregacoes' },
      { id: 'usuarios', label: 'Convidar usuários', completed: hasInvitedUsers, path: '/usuarios' },
      { id: 'membro', label: 'Cadastrar primeiro membro', completed: hasMembers, path: '/secretaria/membros' },
      { id: 'culto', label: 'Registrar primeiro culto', completed: hasCultos, path: '/secretaria/cultos' },
    ]

    const completedCount = steps.filter(s => s.completed).length
    const progressPercent = Math.round((completedCount / steps.length) * 100)

    // Período restante do trial
    const { data: preReg } = await supabase
      .from('pre_registrations')
      .select('trial_expires_at, status')
      .eq('user_id', userId)
      .maybeSingle()

    let trialDaysRemaining = 0
    if (preReg?.trial_expires_at) {
      const expires = new Date(preReg.trial_expires_at)
      const diffTime = expires.getTime() - Date.now()
      trialDaysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
    }

    return NextResponse.json({
      steps,
      progressPercent,
      trialDaysRemaining,
      trialStatus: preReg?.status || 'trial',
      isCompleted: progressPercent === 100
    })
  } catch (error: any) {
    console.error('Erro na API de status do onboarding:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
