#!/usr/bin/env node

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://drzafeksbddnoknvznnd.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2RyemFmZWtzYmRkbm9rbnZ6bm5kLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI1YTQxNjU4NS05ZGY2LTQ1OGUtODU3Ny1mYzFkN2VkODI0YTYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMzUzMDQzMTQ4LCJpYXQiOjE2NzMwNDMxNDgsImVtYWlsIjoiYWxjYW50YXJhLm9saXZlaXJhQHVudGVuZXQuY29tLmJyIiwiZXZlbnQiOiJjb3JkLjEyNzl9.aP3XZHdhdaW_pYZlkn5W6cZs6BVvYl5lPqjdPQNbPqE";

// Usar a service role key para executar SQL
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2RyemFmZWtzYmRkbm9rbnZ6bm5kLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI1YTQxNjU4NS05ZGY2LTQ1OGUtODU3Ny1mYzFkN2VkODI0YTYiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMzUzMDQzMTQ4LCJpYXQiOjE2NzMwNDMxNDgsImVtYWlsIjoiYWxjYW50YXJhLm9saXZlaXJhQHVudGVuZXQuY29tLmJyIiwiZXZlbnQiOiJjb3JkLjEyNzl9.aP3XZHdhdaW_pYZlkn5W6cZs6BVvYl5lPqjdPQNbPqE";

async function setupTables() {
  console.log("\n🔧 Iniciando setup das tabelas...\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // 1️⃣ Verificar se membros existe
    console.log("1️⃣ Verificando tabela 'membros'...");
    const { data: membros, error: membrosError } = await supabase
      .from("membros")
      .select("id, nome", { count: "exact", head: true });

    if (membrosError) {
      console.log("   ❌ Tabela 'membros' não encontrada");
      console.log("   ⚠️ Criando tabela 'membros'...");

      // Criar tabela via REST API diretamente
      const createTableSQL = `
        CREATE TABLE membros (
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
      `;

      console.log("   📝 Execute este SQL no Editor SQL do Supabase:");
      console.log("   " + "─".repeat(80));
      console.log(createTableSQL);
      console.log("   " + "─".repeat(80));
    } else {
      console.log(`   ✅ Tabela 'membros' existe com ${membros.length} registros`);
      console.log("\n📋 Detalhes dos membros:");

      const { data: dados } = await supabase
        .from("membros")
        .select(
          "id, nome, email, status, latitude, longitude, cidade, tipoCadastro"
        );

      dados.forEach((m) => {
        console.log(`\n   👤 ${m.nome}`);
        console.log(`      Email: ${m.email}`);
        console.log(`      Status: ${m.status}`);
        console.log(`      Cidade: ${m.cidade}`);
        console.log(`      Tipo: ${m.tipoCadastro}`);
        console.log(`      Latitude: ${m.latitude}`);
        console.log(`      Longitude: ${m.longitude}`);

        if (m.latitude && m.longitude) {
          console.log(`      ✅ TEM COORDENADAS`);
        } else {
          console.log(`      ⚠️ SEM COORDENADAS`);
        }
      });
    }

    // 2️⃣ Verificar se congregacoes existe
    console.log("\n2️⃣ Verificando tabela 'congregacoes'...");
    const { data: congregacoes, error: congregError } = await supabase
      .from("congregacoes")
      .select("id", { count: "exact", head: true });

    if (congregError) {
      console.log("   ❌ Tabela 'congregacoes' não encontrada");
      console.log("   ⚠️ Criando tabela 'congregacoes'...");

      const createCongregSQL = `
        CREATE TABLE congregacoes (
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
      `;

      console.log("   📝 Execute este SQL no Editor SQL do Supabase:");
      console.log("   " + "─".repeat(80));
      console.log(createCongregSQL);
      console.log("   " + "─".repeat(80));
    } else {
      console.log(
        `   ✅ Tabela 'congregacoes' existe com ${congregacoes.length} registros`
      );

      const { data: dados } = await supabase
        .from("congregacoes")
        .select("*");

      console.log("\n   📍 Congregações registradas:");
      dados.forEach((c) => {
        console.log(`      - ${c.nome} (${c.cidade})`);
      });
    }

    console.log("\n✅ Setup concluído!\n");
  } catch (error) {
    console.error("❌ Erro:", error);
  }
}

setupTables();
