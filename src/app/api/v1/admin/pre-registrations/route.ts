import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

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
    if (ministry_name !== undefined) updateData.ministry_name = ministry_name;
    if (cpf_cnpj !== undefined) updateData.cpf_cnpj = cpf_cnpj;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp;
    if (website !== undefined) updateData.website = website;
    if (responsible_name !== undefined) updateData.responsible_name = responsible_name;
    if (pastor_name !== undefined) updateData.pastor_name = pastor_name;
    if (address_zip !== undefined) updateData.address_zip = address_zip;
    if (address_street !== undefined) updateData.address_street = address_street;
    if (address_number !== undefined) updateData.address_number = address_number;
    if (address_complement !== undefined) updateData.address_complement = address_complement;
    if (address_city !== undefined) updateData.address_city = address_city;
    if (address_state !== undefined) updateData.address_state = address_state;
    if (quantity_temples !== undefined) updateData.quantity_temples = quantity_temples;
    if (quantity_members !== undefined) updateData.quantity_members = quantity_members;
    if (description !== undefined) updateData.description = description;
    if (plan !== undefined) updateData.plan = plan;

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
