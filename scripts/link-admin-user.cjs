const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function linkAdminUser() {
  try {
    console.log('🔍 Buscando usuário admin no Supabase Auth...');
    
    // Buscar usuário pelo email
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Erro ao listar usuários:', usersError);
      return;
    }

    const adminAuthUser = users.find(u => u.email === 'admin@gestaoeklesia.local');
    
    if (!adminAuthUser) {
      console.error('❌ Usuário admin@gestaoeklesia.local não encontrado em auth');
      return;
    }

    console.log('✅ Usuário encontrado em auth:', adminAuthUser.id);
    console.log('   Email:', adminAuthUser.email);
    
    // Verificar registro em admin_users
    const { data: adminData, error: selectError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', 'admin@gestaoeklesia.local');

    if (selectError) {
      console.error('❌ Erro ao buscar em admin_users:', selectError);
      return;
    }

    console.log('📋 Encontrado em admin_users:', adminData.length > 0 ? 'SIM' : 'NÃO');

    if (adminData && adminData.length > 0) {
      const adminRecord = adminData[0];
      console.log('   ID:', adminRecord.id);
      console.log('   user_id:', adminRecord.user_id);
      console.log('   role:', adminRecord.role);
      console.log('   status:', adminRecord.status);

      if (!adminRecord.user_id || adminRecord.user_id === null) {
        console.log('\n🔗 Atualizando user_id...');
        
        const { error: updateError } = await supabase
          .from('admin_users')
          .update({ user_id: adminAuthUser.id })
          .eq('email', 'admin@gestaoeklesia.local');

        if (updateError) {
          console.error('❌ Erro ao atualizar:', updateError);
          return;
        }
        console.log('✅ user_id atualizado com sucesso!');
      } else {
        console.log('\n✅ user_id já está vinculado');
      }
    } else {
      console.log('\n📋 Criando registro em admin_users...');
      
      const { error: insertError } = await supabase
        .from('admin_users')
        .insert({
          user_id: adminAuthUser.id,
          email: 'admin@gestaoeklesia.local',
          nome: 'Admin Gestão Eklesia',
          role: 'super_admin',
          ativo: true,
          status: 'ATIVO',
        });

      if (insertError) {
        console.error('❌ Erro ao criar:', insertError);
        return;
      }
      console.log('✅ Registro criado com sucesso!');
    }

    console.log('\n🎉 Configuração concluída!');
    console.log('\n📧 Credenciais de login:');
    console.log('   Email: admin@gestaoeklesia.local');
    console.log('   Senha: Admin123!@#');
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

linkAdminUser();
