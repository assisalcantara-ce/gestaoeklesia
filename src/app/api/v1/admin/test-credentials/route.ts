import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/admin-guard';
import { consumeRateLimit } from '@/lib/rate-limit-db';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

// Gerar senha temporária aleatória
function generatePassword(length = 12) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

// POST /api/v1/admin/test-credentials - Gerar credenciais (teste ou definitiva)
export async function POST(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' });
    if (!guard.ok) return guard.response;

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const limit = Number(process.env.ADMIN_RATE_LIMIT_TEST_CREDENTIALS_PER_10MIN || 10);
    const windowMs = 10 * 60 * 1000;
    const rate = await consumeRateLimit({
      bucketKey: `admin/test-credentials:post:${guard.ctx.user.id}:${ip}`,
      limit,
      windowMs,
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', retry_after_seconds: rate.retryAfterSeconds },
        {
          status: 429,
          headers: {
            'Retry-After': String(rate.retryAfterSeconds),
          },
        }
      );
    }

    const body = await request.json();
    const { pre_registration_id, email, is_permanent, trial_days } = body;

    if (!pre_registration_id || !email) {
      return NextResponse.json(
        { success: false, error: 'pre_registration_id e email são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se pré-registro existe
    const { data: preReg, error: preRegError } = await supabaseAdmin
      .from('pre_registrations')
      .select('id, ministry_name')
      .eq('id', pre_registration_id)
      .single();

    if (preRegError || !preReg) {
      return NextResponse.json(
        { success: false, error: 'Pré-registro não encontrado' },
        { status: 404 }
      );
    }

    const isPermanent = is_permanent === true;
    const daysValid = isPermanent ? null : (trial_days || 7);

    // Gerar credenciais (email real para credenciais permanentes, temporário para trial)
    const suffix = isPermanent ? Date.now() : `test_${Date.now()}`;
    const userEmail = isPermanent 
      ? email 
      : `${suffix}@test.local`;
    const username = isPermanent 
      ? email.split('@')[0] 
      : `test_${Date.now()}`;
    const password = generatePassword(12);

    // Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        is_permanent: isPermanent,
        created_as: isPermanent ? 'definitive' : 'trial',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json(
        { success: false, error: 'Erro ao criar usuário' },
        { status: 500 }
      );
    }

    // Calcular datas
    const startDate = new Date();
    let endDate: Date | null = null;
    
    if (daysValid) {
      endDate = new Date(startDate.getTime() + daysValid * 24 * 60 * 60 * 1000);
    }

    // Criar ministério (permanente ou temporário)
    const ministryPrefix = isPermanent ? '' : 'TESTE - ';
    const slug = isPermanent 
      ? `${preReg.ministry_name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
      : `test_${Date.now()}`;

    const { data: ministry, error: ministryError } = await supabaseAdmin
      .from('ministries')
      .insert({
        user_id: authUser.user.id,
        name: `${ministryPrefix}${preReg.ministry_name}`,
        slug: slug,
        email_admin: email,
        plan: isPermanent ? 'profissional' : 'trial',
        subscription_status: 'active',
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate?.toISOString() || null,
        max_users: isPermanent ? 50 : 5,
        max_storage_bytes: isPermanent ? 5368709120 : 1073741824, // 5GB ou 1GB
        is_trial: !isPermanent,
      })
      .select()
      .single();

    if (ministryError) {
      console.error('Error creating ministry:', ministryError);
      return NextResponse.json(
        { success: false, error: 'Erro ao criar ministério', details: ministryError },
        { status: 500 }
      );
    }

    // Adicionar usuário como admin do ministério
    const { error: userRoleError } = await supabaseAdmin.from('ministry_users').insert({
      ministry_id: ministry.id,
      user_id: authUser.user.id,
      role: 'admin',
      is_active: true,
    });

    if (userRoleError) {
      console.error('Error adding user to ministry:', userRoleError);
      return NextResponse.json(
        { success: false, error: 'Erro ao associar usuário ao ministério' },
        { status: 500 }
      );
    }

    // Salvar credenciais (se for trial, armazena em test_credentials)
    if (!isPermanent) {
      const { error: credsError } = await supabaseAdmin
        .from('test_credentials')
        .insert({
          pre_registration_id,
          username,
          password: Buffer.from(password).toString('base64'),
          temp_ministry_id: ministry.id,
          is_active: true,
          expires_at: endDate?.toISOString() || null,
        })
        .select()
        .single();

      if (credsError) {
        console.error('Error saving test credentials:', credsError);
      }
    }

    // Atualizar pré-registro para convertido
    if (isPermanent) {
      await supabaseAdmin
        .from('pre_registrations')
        .update({
          status: 'converted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', pre_registration_id);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: authUser.user.id,
        username: username,
        password: password,
        email: userEmail,
        ministry_id: ministry.id,
        ministry_name: ministry.name,
        plan: ministry.plan,
        expires_at: endDate?.toISOString() || null,
        is_permanent: isPermanent,
        access_url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/login`,
      },
      message: isPermanent 
        ? '✅ Credenciais DEFINITIVAS geradas com sucesso! Acesso permanente ativado.'
        : `✅ Credenciais de teste geradas com sucesso! Válidas por ${daysValid} dias.`,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/v1/admin/test-credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/v1/admin/test-credentials/:pre_registration_id - Obter credenciais
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdmin(request, { requiredRole: 'admin' });
    if (!guard.ok) return guard.response;

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const limit = Number(process.env.ADMIN_RATE_LIMIT_TEST_CREDENTIALS_PER_10MIN || 10);
    const windowMs = 10 * 60 * 1000;
    const rate = await consumeRateLimit({
      bucketKey: `admin/test-credentials:get:${guard.ctx.user.id}:${ip}`,
      limit,
      windowMs,
    });

    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests', retry_after_seconds: rate.retryAfterSeconds },
        {
          status: 429,
          headers: {
            'Retry-After': String(rate.retryAfterSeconds),
          },
        }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do pré-registro é obrigatório' },
        { status: 400 }
      );
    }

    const { data: credentials, error } = await supabaseAdmin
      .from('test_credentials')
      .select('id, username, is_active, accessed_at, access_count, expires_at, temp_ministry_id')
      .eq('pre_registration_id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Credenciais não encontradas' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: credentials,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/admin/test-credentials:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
