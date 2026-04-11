import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function upperText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.toUpperCase();
}

function lowerText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.toLowerCase();
}

function onlyDigits(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  return digits.length ? digits : null;
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' });
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const {
      id,
      // Informações Básicas
      ministry_name,
      cpf_cnpj,
      
      // Contatos
      phone,
      email,
      whatsapp,
      website,
      
      // Responsável
      responsible_name,
      pastor_name,
      
      // Endereço
      address_zip,
      address_street,
      address_number,
      address_complement,
      address_city,
      address_state,
      
      // Estrutura
      quantity_temples,
      quantity_members,
      
      // Informações Adicionais
      description,
      plan,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do pré-registro é obrigatório' },
        { status: 400 }
      );
    }

    const updateData: any = {};

    // Adicionar cada campo ao objeto de atualização se fornecido
    if (ministry_name !== undefined) updateData.ministry_name = upperText(ministry_name);
    if (cpf_cnpj !== undefined) updateData.cpf_cnpj = onlyDigits(cpf_cnpj);
    if (phone !== undefined) updateData.phone = onlyDigits(phone);
    if (email !== undefined) updateData.email = lowerText(email);
    if (whatsapp !== undefined) updateData.whatsapp = onlyDigits(whatsapp);
    if (website !== undefined) updateData.website = lowerText(website);
    if (responsible_name !== undefined) updateData.responsible_name = upperText(responsible_name);
    if (pastor_name !== undefined) updateData.pastor_name = upperText(pastor_name);
    if (address_zip !== undefined) updateData.address_zip = onlyDigits(address_zip);
    if (address_street !== undefined) updateData.address_street = upperText(address_street);
    if (address_number !== undefined) updateData.address_number = upperText(address_number);
    if (address_complement !== undefined) updateData.address_complement = upperText(address_complement);
    if (address_city !== undefined) updateData.address_city = upperText(address_city);
    if (address_state !== undefined) updateData.address_state = upperText(address_state);
    if (quantity_temples !== undefined) updateData.quantity_temples = quantity_temples;
    if (quantity_members !== undefined) updateData.quantity_members = quantity_members;
    if (description !== undefined) updateData.description = upperText(description);
    if (plan !== undefined) updateData.plan = plan;
    if (body.status !== undefined) updateData.status = body.status;

    const { data, error } = await supabase
      .from('pre_registrations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      meta: { updated_at: new Date().toISOString() },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar pré-registro' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' });
    if (!guard.ok) return guard.response;

    const { supabaseAdmin } = guard.ctx;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '50')));
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('pre_registrations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao listar pré-registros' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' });
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID é obrigatório' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('pre_registrations')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao deletar pré-registro' },
      { status: 500 }
    );
  }
}
