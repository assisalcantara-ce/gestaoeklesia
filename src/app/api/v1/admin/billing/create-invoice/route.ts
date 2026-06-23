import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic';

const platformAsaasFetch = async (path: string, init: RequestInit) => {
  const apiKey = process.env.PLATFORM_ASAAS_API_KEY?.replace(/^\\/, '')
  const apiUrl = process.env.PLATFORM_ASAAS_API_URL || 'https://api.asaas.com/v3'

  if (!apiKey) {
    throw new Error('PLATFORM_ASAAS_API_KEY não configurada')
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(init.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.errors?.[0]?.detail || data?.message || 'Erro ASAAS Plataforma'
    throw new Error(detail)
  }

  return data
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar admin
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase } = result.ctx

    const body = await request.json()
    const { ministry_id, plano_slug, due_date, installments, amount, description: customDescription } = body

    const installmentCount = Math.max(1, Number(installments || 1))

    if (!ministry_id || !due_date) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: ministry_id, due_date' },
        { status: 400 }
      )
    }

    if (!plano_slug && (!amount || !customDescription)) {
      return NextResponse.json(
        { error: 'É necessário fornecer o plano_slug OU o valor (amount) e a descrição para faturas avulsas' },
        { status: 400 }
      )
    }

    // 2. Buscar ministry
    const { data: ministry, error: ministryError } = await supabase
      .from('ministries')
      .select('*')
      .eq('id', ministry_id)
      .maybeSingle()

    if (ministryError || !ministry) {
      return NextResponse.json(
        { error: 'Ministério não encontrado' },
        { status: 404 }
      )
    }

    let planId: string | null = null
    let planSlug = 'avulsa'
    let totalAmount = 0
    let descriptionBase = ''

    if (plano_slug) {
      // Buscar subscription_plan
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('slug', plano_slug.toLowerCase())
        .maybeSingle()

      if (planError || !plan) {
        return NextResponse.json(
          { error: `Plano com o slug '${plano_slug}' não encontrado` },
          { status: 404 }
        )
      }
      planId = plan.id
      planSlug = plan.slug
      totalAmount = Number(plan.price_monthly) * 12
      descriptionBase = `Assinatura Anual Gestão Eklesia - Plano ${plan.name}`
    } else {
      totalAmount = Number(amount)
      if (Number.isNaN(totalAmount) || totalAmount <= 0) {
        return NextResponse.json(
          { error: 'Valor inválido para fatura avulsa' },
          { status: 400 }
        )
      }
      descriptionBase = String(customDescription).trim()
    }

    const amountPerInstallment = Number((totalAmount / installmentCount).toFixed(2))

    // 4. Resolver asaas_customer_id e criar cobrança ASAAS
    let customerId = ministry.asaas_customer_id || ''

    if (!customerId) {
      // Buscar por email ou CPF/CNPJ
      const query = new URLSearchParams()
      if (ministry.cnpj_cpf) {
        const digits = ministry.cnpj_cpf.replace(/\D/g, '')
        if (digits) query.set('cpfCnpj', digits)
      }
      if (ministry.email_admin) {
        query.set('email', ministry.email_admin.trim().toLowerCase())
      }

      if (query.toString()) {
        const searchRes = await platformAsaasFetch(`/customers?${query.toString()}`, { method: 'GET' })
        const existing = Array.isArray(searchRes?.data) ? searchRes.data[0] : null
        if (existing?.id) {
          customerId = existing.id
        }
      }

      // Se não existir, criar novo
      if (!customerId) {
        const customerPayload = {
          name: ministry.name,
          email: ministry.email_admin || `no-email-${ministry.id}@gestaoeklesia.local`,
          cpfCnpj: ministry.cnpj_cpf ? ministry.cnpj_cpf.replace(/\D/g, '') : null,
          phone: ministry.phone ? ministry.phone.replace(/\D/g, '') : null,
          mobilePhone: ministry.whatsapp ? ministry.whatsapp.replace(/\D/g, '') : null,
        }
        const createRes = await platformAsaasFetch('/customers', {
          method: 'POST',
          body: JSON.stringify(customerPayload),
        })
        customerId = createRes.id
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: 'Não foi possível resolver o cliente no ASAAS' },
        { status: 400 }
      )
    }

    // Criar faturas e registros
    const periodStart = new Date()
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + 12)

    const baseDate = new Date(`${due_date}T00:00:00`)
    const createdInvoices = []

    for (let i = 0; i < installmentCount; i++) {
      const isLast = i === installmentCount - 1
      const currentAmount = isLast
        ? Number((totalAmount - amountPerInstallment * (installmentCount - 1)).toFixed(2))
        : amountPerInstallment

      const currentDueDate = new Date(baseDate)
      currentDueDate.setMonth(baseDate.getMonth() + i)
      const currentDueDateStr = currentDueDate.toISOString().slice(0, 10)

      const description = installmentCount > 1
        ? `${descriptionBase} (${i + 1}/${installmentCount})`
        : descriptionBase

      const paymentPayload = {
        customer: customerId,
        billingType: 'UNDEFINED',
        value: currentAmount,
        dueDate: currentDueDateStr,
        description,
      }

      const paymentRes = await platformAsaasFetch('/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload),
      })

      const asaas_payment_id = paymentRes.id
      const asaas_invoice_url = paymentRes.invoiceUrl || paymentRes.bankSlipUrl
      const asaas_customer_id = customerId

      const { data: invoice, error: insertError } = await supabase
        .from('platform_billing_invoices')
        .insert({
          ministry_id,
          subscription_plan_id: planId,
          plano_slug: planSlug,
          amount: currentAmount,
          due_date: currentDueDateStr,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          status: 'pending',
          asaas_payment_id,
          asaas_invoice_url,
          asaas_customer_id,
        })
        .select('*')
        .single()

      if (insertError) {
        return NextResponse.json(
          { error: `Erro ao salvar fatura ${i + 1}: ${insertError.message}` },
          { status: 400 }
        )
      }

      createdInvoices.push(invoice)
    }

    return NextResponse.json({ success: true, data: createdInvoices[0], all_invoices: createdInvoices })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
}
