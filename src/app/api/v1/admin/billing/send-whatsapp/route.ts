import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  if (dateStr.length <= 10) {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
  }
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function sanitizePhone(rawPhone: unknown): string | null {
  if (!rawPhone) return null
  const digits = String(rawPhone).replace(/\D/g, '')
  if (!digits || digits.length < 8) return null

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }
  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits
  }
  return digits
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredModule: 'pagamentos' })
    if (!result.ok) return result.response
    const { supabaseAdmin: supabase, user } = result.ctx

    const body = await request.json()
    const { invoice_id } = body

    if (!invoice_id) {
      return NextResponse.json({ error: 'ID da fatura é obrigatório.' }, { status: 400 })
    }

    // Buscar a cobrança e o cliente
    const { data: invoice, error: invoiceErr } = await supabase
      .from('platform_billing_invoices')
      .select(`
        id,
        plano_slug,
        status,
        amount,
        due_date,
        asaas_invoice_url,
        ministries (
          id,
          name,
          phone
        )
      `)
      .eq('id', invoice_id)
      .maybeSingle()

    if (invoiceErr || !invoice) {
      return NextResponse.json({ error: 'Fatura não encontrada.' }, { status: 404 })
    }

    // Validar status (Paga ou Cancelada)
    const statusLower = String(invoice.status || '').toLowerCase()
    if (statusLower === 'paid' || statusLower === 'pago' || statusLower === 'canceled' || statusLower === 'cancelada') {
      return NextResponse.json(
        { error: 'Somente cobranças pendentes podem ser enviadas.' },
        { status: 400 },
      )
    }

    // Buscar telefone do ministério
    const minObj = (invoice as any).ministries || {}
    const rawPhone = minObj.phone || minObj.responsavel_phone || minObj.contact_phone || null
    const cleanPhone = sanitizePhone(rawPhone)

    if (!cleanPhone) {
      return NextResponse.json(
        { error: 'Cliente não possui número de WhatsApp cadastrado.' },
        { status: 400 },
      )
    }

    const paymentUrl = invoice.asaas_invoice_url || ''
    if (!paymentUrl) {
      return NextResponse.json({ error: 'Fatura não possui link de pagamento (payment_url) disponível.' }, { status: 400 })
    }

    const ministryName = minObj.name || 'Cliente'
    const planoName = String(invoice.plano_slug || 'Plano').toUpperCase()
    const valorStr = formatCurrency(invoice.amount)
    const vencimentoStr = formatDate(invoice.due_date)

    // Mensagem Padrão Exata Requisitada:
    const textMessage = `Olá, *${ministryName}*.

Segue sua cobrança referente ao plano *${planoName}*.

💰 Valor:
${valorStr}

📅 Vencimento:
${vencimentoStr}

🔗 Pagamento:
${paymentUrl}

Qualquer dúvida estamos à disposição.`

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(textMessage)}`

    // Registro de Auditoria Obrigatório em admin_audit_logs
    try {
      await supabase.from('admin_audit_logs').insert([
        {
          action: 'send_whatsapp_invoice',
          entity_type: 'platform_billing_invoices',
          entity_id: invoice.id,
          changes: {
            operator: user.email,
            cliente: ministryName,
            fatura_id: invoice.id,
            telefone: cleanPhone,
            data_hora: new Date().toISOString(),
          },
          status: 'success',
        },
      ])
    } catch {
      // Ignora falha de log secundária se auditoria indisponível
    }

    return NextResponse.json({
      success: true,
      whatsapp_url: whatsappUrl,
      phone: cleanPhone,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno ao preparar mensagem de WhatsApp.' }, { status: 500 })
  }
}
