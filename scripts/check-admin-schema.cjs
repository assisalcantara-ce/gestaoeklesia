const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  try {
    console.log('📋 Verificando schema da tabela admin_users...\n');
    
    // Fazer uma consulta vazia para ver as colunas
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erro:', error);
      return;
    }

    console.log('✅ Tabela admin_users encontrada');
    console.log('\n📊 Dados do primeiro registro:');
    if (data && data.length > 0) {
      const record = data[0];
      console.log(JSON.stringify(record, null, 2));
      
      console.log('\n🔑 Colunas disponíveis:');
      Object.keys(record).forEach(key => {
        console.log(`   - ${key}`);
      });
    } else {
      console.log('Nenhum registro encontrado. Tentando listar colunas de outra forma...');
      
      // Tentar buscar via RPC
      const { data: columns, error: columnError } = await supabase
        .rpc('get_table_columns', { table_name: 'admin_users' })
        .limit(50);
      
      if (!columnError && columns) {
        console.log('\n🔑 Colunas:');
        columns.forEach(col => {
          console.log(`   - ${col.name} (${col.type})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

checkSchema();
