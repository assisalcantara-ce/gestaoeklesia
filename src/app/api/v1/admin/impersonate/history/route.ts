import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request, { requiredRole: 'admin' });
    if (!adminCheck.ok) return adminCheck.response;

    const { supabaseAdmin } = adminCheck.ctx;
    const { searchParams } = request.nextUrl;

    const tenantId = searchParams.get('tenantId') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('admin_impersonation_sessions')
      .select('*, ministries(name), admin_users(email, nome)', { count: 'exact' });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    query = query.order('started_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('Erro ao buscar histórico de impersonação:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: data || [],
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 });
  }
}
