const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTicketsSchema() {
  try {
    console.log('📋 Verificando schema da tabela tickets_suporte...\n');
    
    const { data, error } = await supabase
      .from('tickets_suporte')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Erro:', error);
      return;
    }

    console.log('✅ Tabela tickets_suporte encontrada');
    
    if (data && data.length > 0) {
      const record = data[0];
      console.log('\n📊 Dados do primeiro registro:');
      console.log(JSON.stringify(record, null, 2));
      
      console.log('\n🔑 Colunas disponíveis:');
      Object.keys(record).forEach(key => {
        console.log(`   - ${key}: ${typeof record[key]}`);
      });
    } else {
      console.log('⚠️ Nenhum registro encontrado na tabela');
      console.log('Criando um registro de teste para ver o schema...');
      
      const { error: insertError } = await supabase
        .from('tickets_suporte')
        .insert({
          titulo: 'Teste',
          descricao: 'Teste',
          status: 'aberto',
        });
      
      if (insertError) {
        console.error('Erro ao criar teste:', insertError);
      } else {
        console.log('Registro de teste criado. Consultando novamente...');
        const { data: newData } = await supabase
          .from('tickets_suporte')
          .select('*')
          .limit(1);
        
        if (newData && newData.length > 0) {
          console.log('\n🔑 Colunas disponíveis:');
          Object.keys(newData[0]).forEach(key => {
            console.log(`   - ${key}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

checkTicketsSchema();
