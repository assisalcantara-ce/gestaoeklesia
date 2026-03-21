#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const {
  execSync
} = require('child_process');

const dbUrl = `postgresql://postgres.drzafeksbddnoknvznnd:Alcantara2024@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

console.log('🔍 Iniciando setup de geolocalização via SQL...\n');

try {
  // 1. Verificar estrutura de members
  console.log('📍 Etapa 1: Verificando estrutura da tabela members...');
  
  const checkStructure = `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'members'
    ORDER BY ordinal_position;
  `;

  try {
    const result = execSync(`psql "${dbUrl}" -c "${checkStructure.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
    console.log('✅ Estrutura verificada\n');
  } catch (e) {
    console.log('⚠️  Não conseguiu verificar via psql\n');
  }

  // 2. Atualizar members com coordenadas
  console.log('📝 Etapa 2: Atualizando members com coordenadas...');
  
  const updateMembers = `
    UPDATE members
    SET 
      latitude = COALESCE(latitude, -3.1190 + (random() * 0.05 - 0.025)),
      longitude = COALESCE(longitude, -60.0217 + (random() * 0.05 - 0.025)),
      status = COALESCE(status, 'ativo')
    WHERE latitude IS NULL OR longitude IS NULL
    RETURNING id, name, latitude, longitude;
  `;

  try {
    const result = execSync(`psql "${dbUrl}" -c "${updateMembers.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
    console.log(result);
    console.log('✅ Members atualizados\n');
  } catch (e) {
    console.log(`⚠️  Erro ao atualizar: ${e.message}\n`);
  }

  // 3. Criar tabela congregacoes
  console.log('🏢 Etapa 3: Criando tabela congregacoes...');
  
  const createCongregacoes = `
    CREATE TABLE IF NOT EXISTS congregacoes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome VARCHAR(255) NOT NULL,
      endereco TEXT,
      cidade VARCHAR(100),
      estado VARCHAR(2),
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      telefone VARCHAR(20),
      email VARCHAR(255),
      pastor VARCHAR(255),
      data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ativo BOOLEAN DEFAULT true
    );
  `;

  try {
    execSync(`psql "${dbUrl}" -c "${createCongregacoes.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
    console.log('✅ Tabela congregacoes criada\n');
  } catch (e) {
    if (e.message.includes('already exists')) {
      console.log('✅ Tabela congregacoes já existe\n');
    } else {
      console.log(`⚠️  ${e.message}\n`);
    }
  }

  // 4. Inserir congregacoes
  console.log('📍 Etapa 4: Inserindo congregacoes...');
  
  const insertCongregacoes = `
    INSERT INTO congregacoes (nome, endereco, cidade, estado, latitude, longitude, telefone, email, pastor, ativo)
    VALUES 
      ('Congregação Central', 'Av. Getúlio Vargas, 1000', 'Manaus', 'AM', -3.1190, -60.0217, '(92) 3221-1234', 'central@congregacao.com.br', 'Rev. João Silva', true),
      ('Congregação Zona Leste', 'Rua das Flores, 500', 'Manaus', 'AM', -3.0800, -59.9400, '(92) 3333-5678', 'leste@congregacao.com.br', 'Rev. Paulo Santos', true),
      ('Congregação Zona Norte', 'Av. Amazonas, 800', 'Manaus', 'AM', -3.0200, -60.0500, '(92) 3444-7890', 'norte@congregacao.com.br', 'Rev. Maria Silva', true),
      ('Congregação Interior', 'Rua Principal, 300', 'Itacoatiara', 'AM', -3.1500, -58.4400, '(92) 3555-1111', 'interior@congregacao.com.br', 'Rev. Carlos Oliveira', true),
      ('Congregação Manacapuru', 'Av. Nilo Peçanha, 200', 'Manacapuru', 'AM', -3.3000, -60.6200, '(92) 3666-2222', 'manacapuru@congregacao.com.br', 'Rev. Ana Costa', true)
    ON CONFLICT DO NOTHING
    RETURNING id, nome;
  `;

  try {
    const result = execSync(`psql "${dbUrl}" -c "${insertCongregacoes.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
    console.log(result);
    console.log('✅ Congregacoes inseridas\n');
  } catch (e) {
    if (e.message.includes('duplicate')) {
      console.log('✅ Congregacoes já existem\n');
    } else {
      console.log(`⚠️  ${e.message}\n`);
    }
  }

  // 5. Verificar resultado final
  console.log('✨ Etapa 5: Verificando resultado final...');
  
  const checkFinal = `
    SELECT 
      'members' as tabela,
      COUNT(*) as total,
      COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as com_latitude,
      COUNT(CASE WHEN longitude IS NOT NULL THEN 1 END) as com_longitude
    FROM members
    
    UNION ALL
    
    SELECT 
      'congregacoes' as tabela,
      COUNT(*) as total,
      COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as com_latitude,
      COUNT(CASE WHEN longitude IS NOT NULL THEN 1 END) as com_longitude
    FROM congregacoes;
  `;

  try {
    const result = execSync(`psql "${dbUrl}" -c "${checkFinal.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
    console.log(result);
  } catch (e) {
    console.log(`⚠️  ${e.message}`);
  }

  console.log('\n✅ Setup de geolocalização CONCLUÍDO!');
  console.log('\n🗺️  Próximo passo: Acesse http://localhost:3000/geolocalizacao\n');

} catch (error) {
  console.error('❌ Erro geral:', error.message);
  process.exit(1);
}
