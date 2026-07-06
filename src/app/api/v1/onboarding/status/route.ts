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

    // Parâmetros da URL
    const { searchParams } = new URL(request.url)
    const tourCompleted = searchParams.get('tourCompleted') === 'true'

    // Todas as queries em paralelo para evitar latência sequencial
    const [
      ministryResult,
      congregacoesResult,
      usersResult,
      membersResult,
      cultosResult,
      preRegResult,
      configResult,
    ] = await Promise.all([
      // 1. Dados do Ministério — tabela correta é 'ministries'
      supabase
        .from('ministries')
        .select('name, cnpj_cpf, phone, description, email_admin')
        .eq('id', ministryId)
        .maybeSingle(),

      // 2. Primeira Congregação
      supabase
        .from('congregacoes')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministryId),

      // 3. Usuários do ministério
      supabase
        .from('ministry_users')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministryId),

      // 4. Membros
      supabase
        .from('members')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministryId),

      // 5. Cultos
      supabase
        .from('culto_registros')
        .select('*', { count: 'exact', head: true })
        .eq('ministry_id', ministryId),

      // 6. Trial
      supabase
        .from('pre_registrations')
        .select('trial_expires_at, status')
        .eq('user_id', userId)
        .maybeSingle(),

      // 7. Responsável (salvo em configurations.church_profile)
      supabase
        .from('configurations')
        .select('church_profile')
        .eq('ministry_id', ministryId)
        .maybeSingle(),
    ])

    const ministry = ministryResult.data
    const responsavel = (configResult.data as any)?.church_profile?.responsavel || null

    // Considera dados preenchidos se: CNPJ, telefone, responsável, e-mail ou nome alterado do padrão
    const nomeAlterado = ministry?.name
      ? !ministry.name.toLowerCase().includes('eklésia') &&
        !ministry.name.toLowerCase().includes('eklesia') &&
        !ministry.name.toLowerCase().includes('provisória') &&
        !ministry.name.toLowerCase().includes('provisoria') &&
        ministry.name.trim().length > 3
      : false

    const hasMinistryData = !!(
      ministry?.cnpj_cpf ||
      ministry?.phone ||
      ministry?.email_admin ||
      responsavel ||
      nomeAlterado
    )

    const hasCongregacao = (congregacoesResult.count || 0) > 0
    const hasInvitedUsers = (usersResult.count || 0) > 1
    const hasMembers = (membersResult.count || 0) > 0
    const hasCultos = (cultosResult.count || 0) > 0

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

    // Trial
    const preReg = preRegResult.data
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
      isCompleted: progressPercent === 100,
      ministryName: ministry?.name || null,
    })
  } catch (error: any) {
    console.error('Erro na API de status do onboarding:', error)
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
  }
}
