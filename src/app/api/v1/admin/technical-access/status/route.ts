import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServerClientFromRequest } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClientFromRequest(request);
    const admin = createServerClient();

    // 1. Obter usuário autenticado nativamente via Supabase Auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ isTechnicalAccess: false });
    }

    const isTechnicalUser = user.app_metadata?.is_technical_user === true || user.user_metadata?.is_technical_user === true;

    if (!isTechnicalUser) {
      return NextResponse.json({ isTechnicalAccess: false });
    }

    // 2. Buscar concessão ativa para o usuário técnico
    const { data: grant } = await admin
      .from('technical_access_grants')
      .select('id, ministry_id, admin_id, reason, ticket_reference, starts_at, expires_at')
      .eq('technical_user_id', user.id)
      .eq('status', 'active')
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!grant) {
      return NextResponse.json({ isTechnicalAccess: false });
    }

    // 3. Buscar nome do ministério
    const { data: ministry } = await admin
      .from('ministries')
      .select('name')
      .eq('id', grant.ministry_id)
      .maybeSingle();

    // 4. Buscar nome do Super Admin solicitante
    const { data: adminProfile } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', grant.admin_id)
      .maybeSingle();

    return NextResponse.json({
      isTechnicalAccess: true,
      grant: {
        grantId: grant.id,
        ministryName: ministry?.name || 'Ministério',
        adminName: adminProfile?.full_name || adminProfile?.email || 'Super Admin',
        reason: grant.reason,
        ticketReference: grant.ticket_reference,
        startsAt: grant.starts_at,
        expiresAt: grant.expires_at,
      },
    });
  } catch (err: any) {
    console.error('[API technical-access/status] Exceção:', err);
    return NextResponse.json({ isTechnicalAccess: false });
  }
}
