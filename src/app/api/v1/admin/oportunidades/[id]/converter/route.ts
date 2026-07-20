import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'
import { ensureAsaasCustomer, createAsaasPayment } from '@/lib/asaas'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await requireAdmin(request, { requiredCapability: 'can_manage_ministries' })
    if (!result.ok) return result.response
    const { supabaseAdmin, adminUser } = result.ctx

    const resolvedParams = await params
    const id = resolvedParams.id
    const { plano_slug, forma_ativacao, validade_meses } = await request.json()

    const adminEmail = adminUser?.email || 'admin@gestaoeklesia.com.br'
    const limitMonths = Number(validade_meses ?? 12)

    // 1. Busca oportunidade
    const { data: opt, error: optGetErr } = await supabaseAdmin
      .from('oportunidades_comerciais')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    let isFallback = false
    let optData = opt

    if (optGetErr || !opt) {
      isFallback = true
      // Busca no support_tickets
      const { data: ticket, error: ticketGetErr } = await supabaseAdmin
        .from('support_tickets')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (ticketGetErr || !ticket) {
        return NextResponse.json({ error: 'Oportunidade/Ticket não encontrado' }, { status: 404 })
      }
      // Mapeia para o mesmo formato
      optData = {
        id: ticket.id,
        ministry_id: ticket.ministry_id,
        status: ticket.status === 'resolved' || ticket.status === 'closed' ? 'Convertido' : 'Novo'
      }
    }

    const ministryId = optData.ministry_id

    // 2. Busca dados do ministério
    const { data: ministry, error: mError } = await supabaseAdmin
      .from('ministries')
      .select('*')
      .eq('id', ministryId)
      .single()

    if (mError || !ministry) {
      return NextResponse.json({ error: 'Ministério correspondente não encontrado' }, { status: 404 })
    }

    // 3. Busca o plano correspondente
    const { data: planRow, error: pError } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('slug', plano_slug)
      .maybeSingle()

    if (pError || !planRow) {
      return NextResponse.json({ error: 'Plano selecionado inválido' }, { status: 400 })
    }

    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + limitMonths)

    if (forma_ativacao === 'direto') {
      // --- FLUXO ATIVAÇÃO DIRETA ---

      // A. Atualizar ministério para ativo
      const { error: updateError } = await supabaseAdmin
        .from('ministries')
        .update({
          subscription_status: 'active',
          plan: plano_slug,
          subscription_plan_id: planRow.id,
          subscription_start_date: startDate.toISOString(),
          subscription_end_date: endDate.toISOString(),
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', ministryId)

      if (updateError) {
        return NextResponse.json({ error: `Erro ao atualizar ministério: ${updateError.message}` }, { status: 400 })
      }

      // B. Atualizar pre_registrations se existir
      if (ministry.user_id) {
        await supabaseAdmin
          .from('pre_registrations')
          .update({ status: 'efetivado' })
          .eq('user_id', ministry.user_id)
      }

      // C. Atualizar oportunidade comercial para Convertido
      const statusAnterior = optData.status || 'Novo'
      const obs = `Conversão efetuada diretamente pelo administrador no plano ${planRow.name}.`

      if (!isFallback) {
        await supabaseAdmin
          .from('oportunidades_comerciais')
          .update({
            status: 'Convertido',
            observacao_interna: obs,
            updated_at: new Date().toISOString(),
            updated_by: adminEmail
          })
          .eq('id', id)

        await supabaseAdmin
          .from('oportunidades_comerciais_historico')
          .insert([{
            oportunidade_id: id,
            status_anterior: statusAnterior,
            status_novo: 'Convertido',
            usuario: adminEmail,
            observacao: obs,
            created_at: new Date().toISOString()
          }])
      } else {
        // Fallback ticket
        await supabaseAdmin
          .from('support_tickets')
          .update({
            status: 'resolved',
            resolution_notes: obs,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        const systemMessage = `[Histórico Comercial] Status alterado para "Convertido".\nUsuário: ${adminEmail}\n\nObservação:\n${obs}`
        await supabaseAdmin
          .from('support_ticket_messages')
          .insert([{
            ticket_id: id,
            user_id: adminUser?.id || '00000000-0000-0000-0000-000000000000',
            message: systemMessage,
            created_at: new Date().toISOString()
          }])
      }

      return NextResponse.json({ success: true, mode: 'direto' })

    } else if (forma_ativacao === 'asaas') {
      // --- FLUXO COBRANÇA ASAAS ---

      const planPrice = Number(planRow.price_monthly || 0)
      if (!Number.isFinite(planPrice) || planPrice <= 0) {
        return NextResponse.json({ error: 'Plano selecionado não possui valor mensal configurado' }, { status: 400 })
      }

      // A. Assegurar que o cliente Asaas existe
      const asaasCustomerId = await ensureAsaasCustomer(supabaseAdmin, {
        id: ministry.id,
        name: ministry.name,
        cnpj_cpf: ministry.cnpj_cpf,
        phone: ministry.phone,
        email_admin: ministry.email_admin,
        asaas_customer_id: ministry.asaas_customer_id
      })

      if (!asaasCustomerId) {
        return NextResponse.json({ error: 'Erro ao criar/identificar cliente Asaas' }, { status: 500 })
      }

      // Se atualizou o customer_id localmente
      if (asaasCustomerId !== ministry.asaas_customer_id) {
        await supabaseAdmin
          .from('ministries')
          .update({ asaas_customer_id: asaasCustomerId })
          .eq('id', ministryId)
      }

      // B. Criar pagamento no Asaas (boleto para vencer em 7 dias)
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      
      const dueDateStr = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`

      const paymentResult = await createAsaasPayment({
        customer: asaasCustomerId,
        value: planPrice,
        dueDate: dueDateStr,
        description: `Assinatura Plano ${planRow.name} - Vigência de ${limitMonths} meses`,
        billingType: 'BOLETO',
        externalReference: id // Vincula com o ID da oportunidade/ticket
      })

      if (!paymentResult?.id) {
        return NextResponse.json({ error: 'Erro ao gerar pagamento Asaas' }, { status: 500 })
      }

      // C. Criar a fatura na tabela platform_billing_invoices (para webhook e controle)
      const { error: invoiceErr } = await supabaseAdmin
        .from('platform_billing_invoices')
        .insert([{
          ministry_id: ministryId,
          plano_slug: plano_slug,
          subscription_plan_id: planRow.id,
          amount: planPrice,
          status: 'pending',
          asaas_payment_id: paymentResult.id,
          asaas_invoice_url: paymentResult.invoiceUrl || null,
          period_start: startDate.toISOString(),
          period_end: endDate.toISOString(),
          due_date: dueDateStr,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])

      if (invoiceErr) {
        return NextResponse.json({ error: `Erro ao gerar fatura local: ${invoiceErr.message}` }, { status: 500 })
      }

      // D. Atualizar status da oportunidade para 'Aguardando Pagamento'
      const statusAnterior = optData.status || 'Novo'
      const obs = `Fatura gerada via ASAAS no plano ${planRow.name}. Aguardando confirmação de pagamento.`

      if (!isFallback) {
        await supabaseAdmin
          .from('oportunidades_comerciais')
          .update({
            status: 'Aguardando Pagamento',
            observacao_interna: obs,
            updated_at: new Date().toISOString(),
            updated_by: adminEmail
          })
          .eq('id', id)

        await supabaseAdmin
          .from('oportunidades_comerciais_historico')
          .insert([{
            oportunidade_id: id,
            status_anterior: statusAnterior,
            status_novo: 'Aguardando Pagamento',
            usuario: adminEmail,
            observacao: obs,
            created_at: new Date().toISOString()
          }])
      } else {
        // Fallback ticket
        await supabaseAdmin
          .from('support_tickets')
          .update({
            status: 'in_progress',
            resolution_notes: obs,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        const systemMessage = `[Histórico Comercial] Status alterado para "Aguardando Pagamento".\nUsuário: ${adminEmail}\n\nObservação:\n${obs}`
        await supabaseAdmin
          .from('support_ticket_messages')
          .insert([{
            ticket_id: id,
            user_id: adminUser?.id || '00000000-0000-0000-0000-000000000000',
            message: systemMessage,
            created_at: new Date().toISOString()
          }])
      }

      return NextResponse.json({
        success: true,
        mode: 'asaas',
        payment: {
          invoice_url: paymentResult.invoiceUrl,
          bank_slip_url: paymentResult.bankSlipUrl
        }
      })
    }

    return NextResponse.json({ error: 'Forma de ativação inválida' }, { status: 400 })
  } catch (err: any) {
    console.error('[CONVERTER] Erro:', err)
    return NextResponse.json({ error: err?.message || 'Erro ao converter cliente' }, { status: 500 })
  }
}
