#!/usr/bin/env node

/**
 * Script para criar usuário de teste com acesso ao sistema GestãoEklesia
 * 
 * Uso: node scripts/create-test-user.cjs
 * 
 * Variáveis de ambiente necessárias:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: Variáveis de ambiente não configuradas');
  console.error('SET NEXT_PUBLIC_SUPABASE_URL=sua_url (antes de rodar)');
  console.error('SET SUPABASE_SERVICE_ROLE_KEY=sua_chave (antes de rodar)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestUser() {
  try {
    const randomSuffix = Math.random().toString(36).substring(7);
    const testEmail = `pastor${randomSuffix}@iglesia.local`;
    const testPassword = 'Teste123456!';
    const testMinistryName = `Igreja de Teste ${randomSuffix}`;

    console.log('🔧 Criando usuário de teste...\n');

    // Passo 1: Criar usuário no Supabase Auth
    console.log(`📧 Criando usuário: ${testEmail}`);
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Pastor de Teste',
      },
    });

    if (authError) {
      console.error('❌ Erro ao criar usuário em auth:', authError.message);
      process.exit(1);
    }

    const userId = authUser.user.id;
    console.log(`✅ Usuário criado: ${userId}\n`);

    // Passo 2: Criar ministry (tenant)
    console.log(`🏛️  Criando ministry: ${testMinistryName}`);
    const { data: ministry, error: ministryError } = await supabase
      .from('ministries')
      .insert({
        user_id: userId,
        name: testMinistryName,
        slug: `iglesia-${randomSuffix}`,
        email_admin: testEmail,
        cnpj_cpf: '00.000.000/0001-00',
        phone: '(11) 99999-9999',
        plan: 'trial',
        subscription_status: 'active',
        timezone: 'America/Sao_Paulo',
      })
      .select()
      .single();

    if (ministryError) {
      console.error('❌ Erro ao criar ministry:', ministryError.message);
      process.exit(1);
    }

    const ministryId = ministry.id;
    console.log(`✅ Ministry criado: ${ministryId}\n`);

    // Passo 3: Criar vínculo ministry_users
    console.log('🔗 Criando vínculo ministry_users (role: admin)');
    const { error: ministryUsersError } = await supabase
      .from('ministry_users')
      .insert({
        ministry_id: ministryId,
        user_id: userId,
        role: 'admin',
        is_active: true,
      });

    if (ministryUsersError) {
      console.error('❌ Erro ao criar ministry_users:', ministryUsersError.message);
      process.exit(1);
    }

    console.log('✅ Vínculo criado\n');

    // Resultado final
    console.log('🎉 Usuário de teste criado com sucesso!\n');
    console.log('═══════════════════════════════════════');
    console.log('📧 Email:', testEmail);
    console.log('🔑 Senha:', testPassword);
    console.log('🏛️  Ministry:', testMinistryName);
    console.log('═══════════════════════════════════════\n');

    console.log('✅ PRÓXIMOS PASSOS:');
    console.log('1. Acesse a aplicação: http://localhost:3000 (ou URL de produção)');
    console.log('2. Clique em "Login"');
    console.log('3. Digite o email e senha acima');
    console.log('4. Pronto! Você está dentro do sistema\n');

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message);
    process.exit(1);
  }
}

createTestUser();
