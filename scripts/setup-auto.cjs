#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://drzafeksbddnoknvznnd.supabase.co";

// Service Role Key (tem permissão para DDL)
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2RyemFmZWtzYmRkbm9rbnZ6bm5kLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI1YTQxNjU4NS05ZGY2LTQ1OGUtODU3Ny1mYzFkN2VkODI0YTYiLCJhdWQiOiJzZXJ2aWNlX3JvbGUiLCJleHAiOjE5Njk4MzIzODgsImlhdCI6MTYxNDQ1MjM4OH0.xvBUlBb3XYqn5x7zr4T0j1Dta4LswQUKx1c95Cf-x40";

async function createTablesWithSQL() {
  console.log("\n🔧 Criando tabelas no Supabase...\n");

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // 1️⃣ Criar tabela membros com dados
    console.log("1️⃣ Criando tabela 'membros'...");

    const sqlMembros = `
      CREATE TABLE IF NOT EXISTS membros (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        telefone VARCHAR(20),
        cidade VARCHAR(100),
        estado VARCHAR(2),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        status VARCHAR(50) DEFAULT 'ativo',
        tipoCadastro VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO membros (nome, email, telefone, cidade, estado, latitude, longitude, status, tipoCadastro)
      VALUES 
        ('João Silva', 'joao@email.com', '(92) 98765-4321', 'Manaus', 'AM', -3.1200, -60.0220, 'ativo', 'membro'),
        ('Maria Santos', 'maria@email.com', '(92) 98765-4322', 'Manaus', 'AM', -3.0950, -59.9800, 'ativo', 'membro'),
        ('Pedro Oliveira', 'pedro@email.com', '(92) 98765-4323', 'Manaus', 'AM', -3.1500, -60.1000, 'ativo', 'visitante')
      ON CONFLICT DO NOTHING;
    `;

    const { error: errorMembros } = await supabase.rpc("exec_sql", {
      sql_query: sqlMembros,
    });

    if (errorMembros) {
      console.log("   ⚠️ Método 1 falhou, tentando com REST API...");

      // Fallback: usar REST API
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ sql_query: sqlMembros }),
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      console.log("   ✅ Tabela 'membros' criada com 3 registros");
    } else {
      console.log("   ✅ Tabela 'membros' criada com 3 registros");
    }

    // 2️⃣ Criar tabela congregacoes com dados
    console.log("\n2️⃣ Criando tabela 'congregacoes'...");

    const sqlCongregacoes = `
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

      INSERT INTO congregacoes (nome, endereco, cidade, estado, latitude, longitude, telefone, pastor, ativo)
      VALUES 
        ('Congregação Central', 'Av. Getúlio Vargas, 1000', 'Manaus', 'AM', -3.1190, -60.0217, '(92) 3221-1234', 'Rev. João Silva', true),
        ('Congregação Zona Leste', 'Rua das Flores, 500', 'Manaus', 'AM', -3.0800, -59.9400, '(92) 3333-5678', 'Rev. Paulo Santos', true),
        ('Congregação Zona Norte', 'Av. Amazonas, 800', 'Manaus', 'AM', -3.0200, -60.0500, '(92) 3444-7890', 'Rev. Maria Silva', true),
        ('Congregação Interior', 'Rua Principal, 300', 'Itacoatiara', 'AM', -3.1500, -58.4400, '(92) 3555-1111', 'Rev. Carlos Oliveira', true),
        ('Congregação Manacapuru', 'Av. Nilo Peçanha, 200', 'Manacapuru', 'AM', -3.3000, -60.6200, '(92) 3666-2222', 'Rev. Ana Costa', true)
      ON CONFLICT DO NOTHING;
    `;

    const { error: errorCongregacoes } = await supabase.rpc("exec_sql", {
      sql_query: sqlCongregacoes,
    });

    if (errorCongregacoes) {
      console.log("   ⚠️ Método 1 falhou, tentando com REST API...");

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/exec_sql`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ sql_query: sqlCongregacoes }),
        }
      );

      if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
      }

      console.log("   ✅ Tabela 'congregacoes' criada com 5 registros");
    } else {
      console.log("   ✅ Tabela 'congregacoes' criada com 5 registros");
    }

    // 3️⃣ Verificar dados
    console.log("\n3️⃣ Verificando dados inseridos...");

    const anonKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2RyemFmZWtzYmRkbm9rbnZ6bm5kLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI1YTQxNjU4NS05ZGY2LTQ1OGUtODU3Ny1mYzFkN2VkODI0YTYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMzUzMDQzMTQ4LCJpYXQiOjE2NzMwNDMxNDgsImVtYWlsIjoiYWxjYW50YXJhLm9saXZlaXJhQHVudGVuZXQuY29tLmJyIiwiZXZlbnQiOiJjb3JkLjEyNzl9.aP3XZHdhdaW_pYZlkn5W6cZs6BVvYl5lPqjdPQNbPqE";

    const supabaseAnon = createClient(SUPABASE_URL, anonKey);

    const { data: membros, error: errMembros } = await supabaseAnon
      .from("membros")
      .select("id, nome, status, latitude, longitude");

    if (!errMembros && membros && membros.length > 0) {
      console.log(`   ✅ ${membros.length} membros encontrados:`);
      membros.forEach((m) => {
        const coords = m.latitude && m.longitude ? "✅" : "❌";
        console.log(`      ${coords} ${m.nome} (${m.status})`);
      });
    } else {
      console.log("   ⚠️ Membros não encontrados ou erro: ", errMembros);
    }

    const { data: congregacoes, error: errCongregacoes } = await supabaseAnon
      .from("congregacoes")
      .select("id, nome, cidade, ativo");

    if (!errCongregacoes && congregacoes && congregacoes.length > 0) {
      console.log(`\n   ✅ ${congregacoes.length} congregações encontradas:`);
      congregacoes.forEach((c) => {
        const status = c.ativo ? "✅" : "❌";
        console.log(`      ${status} ${c.nome} (${c.cidade})`);
      });
    } else {
      console.log("\n   ⚠️ Congregações não encontradas ou erro: ",
        errCongregacoes
      );
    }

    console.log("\n✅ Setup concluído!\n");
    console.log("🌐 Acesse: http://localhost:3000/geolocalizacao");
    console.log("📍 Pressione F5 para recarregar o mapa\n");
  } catch (error) {
    console.error("\n❌ Erro ao criar tabelas:", error.message);
    console.error("\n📝 Se o erro persistir, copie e cole este SQL no Editor SQL do Supabase:");
    console.error(
      "Link: https://supabase.com/dashboard/project/drzafeksbddnoknvznnd/sql/new\n"
    );

    console.log(`
-- SQL para criar tabelas manualmente:

CREATE TABLE IF NOT EXISTS membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(20),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status VARCHAR(50) DEFAULT 'ativo',
  tipoCadastro VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO membros (nome, email, telefone, cidade, estado, latitude, longitude, status, tipoCadastro)
VALUES 
  ('João Silva', 'joao@email.com', '(92) 98765-4321', 'Manaus', 'AM', -3.1200, -60.0220, 'ativo', 'membro'),
  ('Maria Santos', 'maria@email.com', '(92) 98765-4322', 'Manaus', 'AM', -3.0950, -59.9800, 'ativo', 'membro'),
  ('Pedro Oliveira', 'pedro@email.com', '(92) 98765-4323', 'Manaus', 'AM', -3.1500, -60.1000, 'ativo', 'visitante');

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

INSERT INTO congregacoes (nome, endereco, cidade, estado, latitude, longitude, telefone, pastor, ativo)
VALUES 
  ('Congregação Central', 'Av. Getúlio Vargas, 1000', 'Manaus', 'AM', -3.1190, -60.0217, '(92) 3221-1234', 'Rev. João Silva', true),
  ('Congregação Zona Leste', 'Rua das Flores, 500', 'Manaus', 'AM', -3.0800, -59.9400, '(92) 3333-5678', 'Rev. Paulo Santos', true),
  ('Congregação Zona Norte', 'Av. Amazonas, 800', 'Manaus', 'AM', -3.0200, -60.0500, '(92) 3444-7890', 'Rev. Maria Silva', true),
  ('Congregação Interior', 'Rua Principal, 300', 'Itacoatiara', 'AM', -3.1500, -58.4400, '(92) 3555-1111', 'Rev. Carlos Oliveira', true),
  ('Congregação Manacapuru', 'Av. Nilo Peçanha, 200', 'Manacapuru', 'AM', -3.3000, -60.6200, '(92) 3666-2222', 'Rev. Ana Costa', true);
    `);
  }
}

createTablesWithSQL();
