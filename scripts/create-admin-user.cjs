const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser() {
  try {
    console.log('🔧 Criando usuário admin no Supabase Auth...');
    
    // Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@gestaoeklesia.local',
      password: 'Admin123!@#',
      email_confirm: true,
      user_metadata: {
        name: 'Admin Gestão Eklesia',
        role: 'admin',
      },
    });

    if (authError) {
      console.error('❌ Erro ao criar usuário em auth:', authError);
      return;
    }

    console.log('✅ Usuário criado em auth.users:', authUser.user.id);

    // Verificar se já existe registro em admin_users
    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', 'admin@gestaoeklesia.local')
      .single();

    if (existingAdmin) {
      console.log('📋 Usuário já existe em admin_users, atualizando user_id...');
      
      const { error: updateError } = await supabase
        .from('admin_users')
        .update({ user_id: authUser.user.id })
        .eq('email', 'admin@gestaoeklesia.local');

      if (updateError) {
        console.error('❌ Erro ao atualizar user_id:', updateError);
        return;
      }
      console.log('✅ user_id atualizado com sucesso');
    } else {
      console.log('📋 Criando entrada em admin_users...');
      
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert({
          user_id: authUser.user.id,
          email: 'admin@gestaoeklesia.local',
          nome: 'Admin Gestão Eklesia',
          role: 'super_admin',
          ativo: true,
        });

      if (insertError) {
        console.error('❌ Erro ao criar entrada em admin_users:', insertError);
        return;
      }
      console.log('✅ Entrada criada em admin_users');
    }

    console.log('\n🎉 Usuário admin criado com sucesso!');
    console.log('📧 Email: admin@gestaoeklesia.local');
    console.log('🔑 Senha: Admin123!@#');
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

createAdminUser();
