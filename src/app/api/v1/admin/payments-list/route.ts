import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Obter user do header (JWT)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Obter ministry_id
    const muResult = await supabase
      .from('ministry_users')
      .select('ministry_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let ministryId = (muResult.data as any)?.ministry_id as string | undefined;

    if (!ministryId) {
      const mResult = await supabase
        .from('ministries')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      ministryId = (mResult.data as any)?.id as string | undefined;
    }

    if (!ministryId) {
      return NextResponse.json(
        { error: 'Ministry not found' },
        { status: 404 }
      );
    }

    // Buscar payments com service role (bypass RLS)
    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('ministry_id', ministryId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Payments API] Erro ao buscar pagamentos:', error);
      return NextResponse.json(
        { error: 'Failed to fetch payments', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ payments: payments || [] });
  } catch (error: any) {
    console.error('[Payments API] Erro geral:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
