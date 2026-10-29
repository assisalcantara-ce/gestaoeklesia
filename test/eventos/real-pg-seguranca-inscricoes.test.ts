// @ts-ignore
import { Client } from 'pg';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('=== INICIANDO SUÍTE ADVERSARIAL POSTGRESQL REAL (PORT 5433) ===\n');

  const client = new Client({ connectionString: 'postgres://postgres@127.0.0.1:5433/postgres' });
  await client.connect();

  try {
    // 1. Configurar roles e schema base mínimo para espelhar Supabase
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
      END
      $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'anon');
      $$ LANGUAGE sql STABLE;

      CREATE TABLE IF NOT EXISTS public.ministries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS public.ministry_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        permissions JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN NOT NULL DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS public.members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        cpf TEXT
      );

      CREATE TABLE IF NOT EXISTS public.eventos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
        titulo TEXT NOT NULL,
        evento_pago BOOLEAN NOT NULL DEFAULT FALSE,
        valor_inscricao NUMERIC(12,2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'publicado',
        congregacao_id UUID
      );

      CREATE TABLE IF NOT EXISTS public.eventos_inscricoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
        evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
        nome_externo VARCHAR(255),
        email_externo VARCHAR(255),
        telefone VARCHAR(30),
        cpf_normalizado VARCHAR(11),
        congregacao_id UUID,
        com_hospedagem BOOLEAN NOT NULL DEFAULT FALSE,
        tem_brinde BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(20) NOT NULL DEFAULT 'confirmado',
        observacoes TEXT,
        criado_por UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS public.eventos_pagamentos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
        evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
        inscricao_id UUID NOT NULL REFERENCES public.eventos_inscricoes(id) ON DELETE CASCADE,
        gateway VARCHAR(20) NOT NULL DEFAULT 'asaas',
        gateway_charge_id VARCHAR(255),
        payment_method VARCHAR(20) NOT NULL DEFAULT 'pix',
        valor NUMERIC(12,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pendente',
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Executar a migration real
    console.log('[1] Aplicando migration 20261028140000_bloqueio_inscricoes_pagas_fluxo_convencional.sql...');
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261028140000_bloqueio_inscricoes_pagas_fluxo_convencional.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(migrationSql);
    console.log('   -> Migration aplicada com sucesso!');

    // 3. Setup de dados do teste: Dois ministérios (Tenant A e Tenant B)
    const ministryAId = '11111111-1111-1111-1111-111111111111';
    const ministryBId = '22222222-2222-2222-2222-222222222222';
    const userAdminA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const userSecretarioA = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const userInvasorB = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

    await client.query(`
      DELETE FROM public.eventos_pagamentos;
      DELETE FROM public.eventos_inscricoes;
      DELETE FROM public.eventos;
      DELETE FROM public.members;
      DELETE FROM public.ministry_users;
      DELETE FROM public.ministries;

      INSERT INTO public.ministries (id, user_id, name) VALUES 
        ('${ministryAId}', '${userAdminA}', 'Ministério Central A'),
        ('${ministryBId}', '${userInvasorB}', 'Ministério Invasor B');

      INSERT INTO public.ministry_users (ministry_id, user_id, role, permissions) VALUES
        ('${ministryAId}', '${userAdminA}', 'admin', '["ADMINISTRADOR"]'::jsonb),
        ('${ministryAId}', '${userSecretarioA}', 'secretario', '["SECRETARIO_GERAL"]'::jsonb),
        ('${ministryBId}', '${userInvasorB}', 'admin', '["ADMINISTRADOR"]'::jsonb);
    `);

    // Eventos de teste
    const eventoPagoAId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001';
    const eventoGratuitoAId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0002';
    await client.query(`
      INSERT INTO public.eventos (id, ministry_id, titulo, evento_pago, valor_inscricao) VALUES
        ('${eventoPagoAId}', '${ministryAId}', 'Congresso Nacional Pago A', TRUE, 120.00),
        ('${eventoGratuitoAId}', '${ministryAId}', 'Culto Especial Gratuito A', FALSE, 0.00);
    `);

    // Helper para simular contexto Supabase
    async function setContext(role: 'anon' | 'authenticated' | 'service_role', userId?: string) {
      await client.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
      if (userId) {
        await client.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [userId]);
      } else {
        await client.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
      }
    }

    console.log('\n[2] TESTES ADVERSARIAIS DE BLOQUEIO DE BYPASS (FLUXO CONVENCIONAL):');

    // Teste 2.1: Anon tentando INSERT direto com status = 'confirmado' em evento pago
    await setContext('anon');
    let threw = false;
    try {
      await client.query(`
        INSERT INTO public.eventos_inscricoes (ministry_id, evento_id, nome_externo, status)
        VALUES ('${ministryAId}', '${eventoPagoAId}', 'Hacker Anon', 'confirmado')
      `);
    } catch (e: any) {
      threw = true;
      assert.match(e.message, /Inscrições em eventos pagos não podem ser confirmadas diretamente/);
    }
    assert.strictEqual(threw, true, 'Anon DEVE ser bloqueado de criar inscrição confirmada');
    console.log('   ✓ Ataque 1 [Anon bypass direto]: BLOQUEADO com sucesso');

    // Teste 2.2: Anon criando inscrição pública pendente ('aguardando_pagamento') em evento pago
    await client.query(`
      INSERT INTO public.eventos_inscricoes (id, ministry_id, evento_id, nome_externo, status)
      VALUES ('99999999-9999-9999-9999-999999999001', '${ministryAId}', '${eventoPagoAId}', 'Participante Publico Legítimo', 'aguardando_pagamento')
    `);
    console.log('   ✓ Fluxo 2 [Inscrição Pública aguardando_pagamento]: PERMITIDO com sucesso');

    // Teste 2.3: Operador Secretario_Geral tentando INSERT convencional direto com status = 'confirmado' em evento pago (sem Balcão RPC)
    await setContext('authenticated', userSecretarioA);
    threw = false;
    try {
      await client.query(`
        INSERT INTO public.eventos_inscricoes (ministry_id, evento_id, nome_externo, status)
        VALUES ('${ministryAId}', '${eventoPagoAId}', 'Burla Convencional Secretario', 'confirmado')
      `);
    } catch (e: any) {
      threw = true;
      assert.match(e.message, /Inscrições em eventos pagos não podem ser confirmadas diretamente/);
    }
    assert.strictEqual(threw, true, 'Secretario_geral via INSERT convencional direto DEVE ser bloqueado');
    console.log('   ✓ Ataque 2 [Secretario_Geral bypass direto sem Balcão]: BLOQUEADO com sucesso');

    // Teste 2.4: Operador tentando fraudar status para 'confirmado' via UPDATE sem pagamento quitado
    threw = false;
    try {
      await client.query(`
        UPDATE public.eventos_inscricoes
        SET status = 'confirmado'
        WHERE id = '99999999-9999-9999-9999-999999999001'
      `);
    } catch (e: any) {
      threw = true;
      assert.match(e.message, /Não é permitido confirmar inscrição em evento pago sem quitação financeira/);
    }
    assert.strictEqual(threw, true, 'UPDATE para confirmado sem pagamento conciliado DEVE ser bloqueado');
    console.log('   ✓ Ataque 3 [UPDATE status = confirmado sem pagamento]: BLOQUEADO com sucesso');

    // Teste 2.5: Invasão direta em eventos_pagamentos para forjar status = 'pago'
    threw = false;
    try {
      await client.query(`
        INSERT INTO public.eventos_pagamentos (ministry_id, evento_id, inscricao_id, valor, status)
        VALUES ('${ministryAId}', '${eventoPagoAId}', '99999999-9999-9999-9999-999999999001', 120.00, 'pago')
      `);
    } catch (e: any) {
      threw = true;
      assert.match(e.message, /Status de pagamento "pago" só pode ser gravado via gateway oficial ou balcão/);
    }
    assert.strictEqual(threw, true, 'INSERT direto de status = pago em pagamentos DEVE ser bloqueado');
    console.log('   ✓ Ataque 4 [INSERT direto status = pago]: BLOQUEADO com sucesso');

    // Teste 2.6: Violação de imutabilidade de chaves (alterar ministry_id / evento_id)
    threw = false;
    try {
      await client.query(`
        UPDATE public.eventos_inscricoes
        SET ministry_id = '${ministryBId}'
        WHERE id = '99999999-9999-9999-9999-999999999001'
      `);
    } catch (e: any) {
      threw = true;
      assert.match(e.message, /Vínculos de ministério e evento são imutáveis/);
    }
    assert.strictEqual(threw, true, 'Mutabilidade de ministry_id na inscrição DEVE ser bloqueada');
    console.log('   ✓ Ataque 5 [Mutação de chaves estruturais]: BLOQUEADO com sucesso');

    console.log('\n[3] TESTES DE FLUXOS AUTORIZADOS:');

    // Teste 3.1: Balcão Legítimo via registrar_inscricao_balcao_rpc (Secretario_Geral com pagamento à vista)
    await setContext('authenticated', userSecretarioA);
    const rpcRes = await client.query(`
      SELECT public.registrar_inscricao_balcao_rpc(
        p_ministry_id => '${ministryAId}',
        p_evento_id => '${eventoPagoAId}',
        p_forma_pagamento => 'a_vista',
        p_nome_externo => 'Irmão Balcão Oficial',
        p_cpf => '123.456.789-01'
      ) as result
    `);
    const rpcData = rpcRes.rows[0].result;
    assert.strictEqual(rpcData.success, true);
    assert.strictEqual(rpcData.status, 'confirmado');
    assert.ok(rpcData.inscricao_id);
    assert.ok(rpcData.pagamento_id);
    console.log('   ✓ Fluxo 3 [Balcão RPC Legítimo com pagamento]: APROVADO com sucesso (Inscrição + Pagamento atômico)');

    // Teste 3.2: Cortesia com justificativa válida via Balcão RPC
    const rpcCortesia = await client.query(`
      SELECT public.registrar_inscricao_balcao_rpc(
        p_ministry_id => '${ministryAId}',
        p_evento_id => '${eventoPagoAId}',
        p_forma_pagamento => 'cortesia',
        p_nome_externo => 'Convidado de Honra',
        p_cpf => '987.654.321-09',
        p_justificativa_cortesia => 'Palestrante Convidado Oficial da Abertura'
      ) as result
    `);
    assert.strictEqual(rpcCortesia.rows[0].result.success, true);
    console.log('   ✓ Fluxo 4 [Balcão RPC Cortesia com justificativa auditável]: APROVADO com sucesso');

    // Teste 3.3: Cortesia SEM justificativa (deve falhar)
    threw = false;
    try {
      await client.query(`
        SELECT public.registrar_inscricao_balcao_rpc(
          p_ministry_id => '${ministryAId}',
          p_evento_id => '${eventoPagoAId}',
          p_forma_pagamento => 'cortesia',
          p_nome_externo => 'Burla Sem Justificativa',
          p_justificativa_cortesia => ''
        )
      `);
    } catch (e: any) {
      threw = true;
      assert.match(e.message, /Concessão de cortesia exige justificativa formal/);
    }
    assert.strictEqual(threw, true, 'Cortesia sem justificativa DEVE ser rejeitada');
    console.log('   ✓ Ataque 6 [Cortesia vazia/sem justificativa]: BLOQUEADO com sucesso');

    // Teste 3.4: Invasão multi-tenant (Operador de B tentando chamar Balcão RPC no Evento de A)
    await setContext('authenticated', userInvasorB);
    threw = false;
    try {
      await client.query(`
        SELECT public.registrar_inscricao_balcao_rpc(
          p_ministry_id => '${ministryAId}',
          p_evento_id => '${eventoPagoAId}',
          p_forma_pagamento => 'a_vista',
          p_nome_externo => 'Tentativa Invasão Tenant B'
        )
      `);
    } catch (e: any) {
      threw = true;
      assert.match(e.message, /Permissão insuficiente para registrar inscrições no Balcão/);
    }
    assert.strictEqual(threw, true, 'Operador de outro ministério DEVE ser rejeitado');
    console.log('   ✓ Ataque 7 [Invasão Multi-Tenant entre ministérios]: BLOQUEADO com sucesso');

    // Teste 3.5: Webhook legítimo via service_role atualizando pagamento e confirmando inscrição
    await setContext('service_role');
    const inscrPublicaId = '99999999-9999-9999-9999-999999999001';
    
    // Inserir registro de cobrança gerado pelo gateway
    const pagGatewayRes = await client.query(`
      INSERT INTO public.eventos_pagamentos (ministry_id, evento_id, inscricao_id, gateway, gateway_charge_id, payment_method, valor, status)
      VALUES ('${ministryAId}', '${eventoPagoAId}', '${inscrPublicaId}', 'asaas', 'pay_asaas_123', 'pix', 120.00, 'pendente')
      RETURNING id
    `);
    const pagGatewayId = pagGatewayRes.rows[0].id;

    // Webhook recebe notificação: marca pagamento como pago
    await client.query(`
      UPDATE public.eventos_pagamentos
      SET status = 'pago', paid_at = NOW()
      WHERE id = '${pagGatewayId}'
    `);

    // Webhook atualiza status da inscrição para confirmado
    await client.query(`
      UPDATE public.eventos_inscricoes
      SET status = 'confirmado'
      WHERE id = '${inscrPublicaId}'
    `);

    const checagemFinal = await client.query(`
      SELECT status FROM public.eventos_inscricoes WHERE id = '${inscrPublicaId}'
    `);
    assert.strictEqual(checagemFinal.rows[0].status, 'confirmado');
    console.log('   ✓ Fluxo 5 [Webhook Asaas/Efí via service_role com quitação real]: APROVADO com sucesso');

    console.log('\n===============================================================');
    console.log(' TODOS OS 12 TESTES ADVERSARIAIS E FUNCIONAIS PASSARAM NO POSTGRESQL REAL!');
    console.log('===============================================================\n');

  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\n❌ ERRO NA EXECUÇÃO DO TESTE:', err);
  process.exit(1);
});
