-- =============================================================================
-- HOMOLOGAÇÃO FASE 4A — Eventos Pagos ASAAS PIX
-- Script de Validação SQL — Execute no Supabase SQL Editor
-- Data: 2026-05-23
-- =============================================================================
-- INSTRUÇÕES: Execute cada seção separadamente, observando os resultados.
-- =============================================================================


-- =============================================================================
-- FASE 1 — INFRAESTRUTURA: Verificar que a migration foi aplicada
-- =============================================================================

-- 1A. Verificar que a tabela eventos_pagamentos existe
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'eventos_pagamentos';
-- ESPERADO: 1 linha com table_name='eventos_pagamentos'

-- 1B. Verificar colunas da tabela eventos_pagamentos
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'eventos_pagamentos'
ORDER BY ordinal_position;
-- ESPERADO: 20+ colunas incluindo id, ministry_id, evento_id, inscricao_id,
--           gateway, gateway_charge_id, status, pix_payload, pix_qrcode,
--           expires_at, paid_at, updated_at

-- 1C. Verificar coluna updated_at em eventos_inscricoes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'eventos_inscricoes'
  AND column_name = 'updated_at';
-- ESPERADO: 1 linha — confirma que o bug #2 foi corrigido

-- 1D. Verificar CHECK constraint de eventos_inscricoes (novos status)
SELECT 
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class cls ON cls.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname = 'eventos_inscricoes'
  AND con.contype = 'c';
-- ESPERADO: inscricao_status_valido deve incluir 'aguardando_pagamento' e 'expirado'

-- 1E. Verificar CHECK constraint de eventos_pagamentos
SELECT 
  con.conname AS constraint_name,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class cls ON cls.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname = 'eventos_pagamentos'
  AND con.contype = 'c';
-- ESPERADO: ep_status_valido com 'pendente','pago','cancelado','expirado','estornado'

-- 1F. Verificar índices em eventos_pagamentos
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'eventos_pagamentos'
ORDER BY indexname;
-- ESPERADO: idx_ep_ministry, idx_ep_evento, idx_ep_inscricao, idx_ep_charge, idx_ep_status_expires

-- 1G. Verificar RLS ativa
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'eventos_pagamentos';
-- ESPERADO: rowsecurity = true

-- 1H. Verificar políticas RLS
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'eventos_pagamentos';
-- ESPERADO: policy 'ep_select' para SELECT (INSERT/UPDATE só via service_role)


-- =============================================================================
-- FASE 2 — GATEWAY: Verificar configuração
-- =============================================================================

-- 2A. Listar gateways configurados (sem expor credenciais)
SELECT 
  id,
  ministry_id,
  gateway,
  environment,
  is_active,
  webhook_token,
  created_at,
  -- NÃO mostra encrypted_credentials por segurança
  CASE WHEN encrypted_credentials IS NOT NULL THEN 'CONFIGURADO' ELSE 'AUSENTE' END AS creds_status
FROM public.ministry_payment_gateways
ORDER BY created_at DESC;
-- ESPERADO: pelo menos 1 linha com gateway='asaas', is_active=true, creds_status='CONFIGURADO'

-- 2B. Verificar que o webhook_token é um UUID válido
SELECT 
  gateway,
  webhook_token,
  webhook_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AS token_valido
FROM public.ministry_payment_gateways
WHERE gateway = 'asaas';
-- ESPERADO: token_valido = true


-- =============================================================================
-- FASE 3 — EVENTO DE TESTE: Verificar dados após criação manual
-- =============================================================================

-- 3A. Listar eventos pagos ativos
SELECT 
  id,
  titulo,
  slug,
  status,
  is_publico,
  aceita_inscricao,
  capacidade,
  valor_inscricao,
  data_inicio,
  ministry_id
FROM public.eventos
WHERE valor_inscricao > 0
  AND is_publico = true
ORDER BY created_at DESC
LIMIT 10;
-- ESPERADO após criar o evento TESTE PIX ASAAS:
-- titulo='TESTE PIX ASAAS', valor_inscricao=10.00, capacidade=2, is_publico=true

-- 3B. Gerar URL pública de exemplo (use o slug da linha acima)
-- Link público: http://localhost:3000/eventos/e/{slug}


-- =============================================================================
-- FASE 4 — INSCRIÇÃO: Verificar após inscrição externa
-- =============================================================================

-- 4A. Verificar inscrição criada (substitua o slug pelo slug real)
SELECT 
  ei.id AS inscricao_id,
  ei.nome_externo,
  ei.email_externo,
  ei.status,
  ei.created_at,
  ep.id AS pagamento_id,
  ep.gateway_charge_id,
  ep.status AS pag_status,
  ep.valor,
  ep.expires_at,
  CASE WHEN ep.pix_payload IS NOT NULL THEN 'SIM' ELSE 'NAO' END AS tem_payload,
  CASE WHEN ep.pix_qrcode IS NOT NULL THEN 'SIM' ELSE 'NAO' END AS tem_qrcode
FROM public.eventos_inscricoes ei
LEFT JOIN public.eventos_pagamentos ep ON ep.inscricao_id = ei.id
JOIN public.eventos ev ON ev.id = ei.evento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
ORDER BY ei.created_at DESC
LIMIT 5;
-- ESPERADO:
-- status='aguardando_pagamento'
-- pagamento_id NOT NULL
-- gateway_charge_id = 'pay_XXXXXXXX' (ID da cobrança ASAAS)
-- pag_status='pendente'
-- tem_payload='SIM', tem_qrcode='SIM'


-- =============================================================================
-- FASE 5 — PAGAMENTO: Verificar após simular pagamento no ASAAS Sandbox
-- =============================================================================

-- 5A. Verificar status após confirmação (substitua o pagamento_id da fase 4)
-- Substitua <PAGAMENTO_ID> pelo UUID da tabela eventos_pagamentos
SELECT
  ep.id,
  ep.status,
  ep.paid_at,
  ep.tesouraria_lancamento_id,
  ei.status AS inscricao_status
FROM public.eventos_pagamentos ep
JOIN public.eventos_inscricoes ei ON ei.id = ep.inscricao_id
JOIN public.eventos ev ON ev.id = ep.evento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
ORDER BY ep.created_at DESC
LIMIT 5;
-- ESPERADO após webhook de confirmação:
-- ep.status = 'pago'
-- ep.paid_at NOT NULL
-- inscricao_status = 'confirmado'
-- tesouraria_lancamento_id NOT NULL


-- =============================================================================
-- FASE 6 — TESOURARIA: Verificar lançamento criado
-- =============================================================================

-- 6A. Verificar lançamento no tesouraria
SELECT
  tl.id,
  tl.tipo_movimento,
  tl.tipo_recebimento,
  tl.origem_modulo,
  tl.origem_id,
  tl.valor,
  tl.descricao,
  tl.data_lancamento,
  tl.created_at
FROM public.tesouraria_lancamentos tl
WHERE tl.origem_modulo = 'evento'
ORDER BY tl.created_at DESC
LIMIT 10;
-- ESPERADO:
-- tipo_movimento = 'entrada'
-- tipo_recebimento = 'evento'
-- origem_modulo = 'evento'
-- origem_id = <id do registro em eventos_pagamentos>
-- valor = 10.00
-- descricao LIKE 'Inscrição Evento: TESTE PIX ASAAS — %'

-- 6B. Confirmar linkagem pagamento ↔ lançamento
SELECT
  ep.id AS pagamento_id,
  ep.tesouraria_lancamento_id,
  tl.id AS lancamento_id,
  tl.valor,
  tl.tipo_recebimento,
  tl.origem_modulo
FROM public.eventos_pagamentos ep
JOIN public.tesouraria_lancamentos tl ON tl.id = ep.tesouraria_lancamento_id
JOIN public.eventos ev ON ev.id = ep.evento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
  AND ep.status = 'pago';
-- ESPERADO: 1 linha — pagamento linkado ao lançamento


-- =============================================================================
-- FASE 7 — IDEMPOTÊNCIA: Verificar após reenvio do webhook
-- =============================================================================

-- 7A. Contar lançamentos para o mesmo pagamento (deve ser apenas 1)
SELECT
  ep.id AS pagamento_id,
  ep.gateway_charge_id,
  COUNT(tl.id) AS total_lancamentos
FROM public.eventos_pagamentos ep
LEFT JOIN public.tesouraria_lancamentos tl ON tl.origem_id = ep.id AND tl.origem_modulo = 'evento'
JOIN public.eventos ev ON ev.id = ep.evento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
GROUP BY ep.id, ep.gateway_charge_id;
-- ESPERADO: total_lancamentos = 1 (mesmo após múltiplos webhooks)

-- 7B. Verificar UNIQUE INDEX (deve existir)
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'tesouraria_lancamentos'
  AND indexname LIKE '%uq_tesouraria%';
-- ESPERADO: uq_tesouraria_origem com (ministry_id, origem_modulo, origem_id) WHERE NOT NULL


-- =============================================================================
-- FASE 8 — CAPACIDADE: Verificar contagem de vagas
-- =============================================================================

-- 8A. Ver distribuição de inscrições por status no evento teste
SELECT
  ev.titulo,
  ev.capacidade,
  ei.status,
  COUNT(*) AS quantidade
FROM public.eventos_inscricoes ei
JOIN public.eventos ev ON ev.id = ei.evento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
GROUP BY ev.titulo, ev.capacidade, ei.status
ORDER BY ei.status;
-- APÓS 2 inscrições pagas confirmadas:
-- confirmado = 2, capacidade = 2
-- PRÓXIMA INSCRIÇÃO deve gerar status = 'lista_espera'

-- 8B. Simular contagem que a API usa (incluindo aguardando_pagamento)
SELECT COUNT(*) AS vagas_ocupadas
FROM public.eventos_inscricoes ei
JOIN public.eventos ev ON ev.id = ei.evento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
  AND ei.status IN ('confirmado', 'aguardando_pagamento');
-- ESPERADO: = capacidade (2) quando lotado


-- =============================================================================
-- FASE 9 — EXPIRAÇÃO: Validar cron de expiração
-- =============================================================================

-- 9A. Forçar expiração de um pagamento pendente para teste
-- ATENÇÃO: Execute apenas em ambiente de teste!
-- Substitua <PAGAMENTO_ID> pelo ID do pagamento que deseja expirar
UPDATE public.eventos_pagamentos
SET expires_at = NOW() - INTERVAL '1 hour'
WHERE id = '<PAGAMENTO_ID>'
  AND status = 'pendente';
-- Após executar, acesse:
-- GET http://localhost:3000/api/v1/cron/expire-event-payments
-- Header: Authorization: Bearer 4otEz5iwLqZp28LgjwrTQnYtBKQpfQT2SrJkzGCwj+4=

-- 9B. Verificar estado após cron
SELECT
  ep.id AS pagamento_id,
  ep.status AS pag_status,
  ep.expires_at,
  ei.status AS inscricao_status
FROM public.eventos_pagamentos ep
JOIN public.eventos_inscricoes ei ON ei.id = ep.inscricao_id
JOIN public.eventos ev ON ev.id = ep.evento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
ORDER BY ep.created_at DESC;
-- ESPERADO após cron:
-- pag_status = 'expirado'
-- inscricao_status = 'expirado'

-- 9C. Verificar vaga liberada (contagem deve cair)
SELECT COUNT(*) AS vagas_ocupadas
FROM public.eventos_inscricoes ei
JOIN public.eventos ev ON ev.id = ei.evento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
  AND ei.status IN ('confirmado', 'aguardando_pagamento');
-- ESPERADO: valor menor após expiração (vaga liberada)


-- =============================================================================
-- FASE 10 — EVIDÊNCIAS CONSOLIDADAS
-- =============================================================================

-- 10A. Relatório completo do evento de teste
SELECT
  ev.titulo AS evento,
  ev.capacidade,
  ev.valor_inscricao,
  ei.id AS inscricao_id,
  ei.nome_externo,
  ei.email_externo,
  ei.status AS inscricao_status,
  ei.created_at AS inscricao_em,
  ep.id AS pagamento_id,
  ep.gateway AS gateway_usado,
  ep.gateway_charge_id,
  ep.valor AS valor_cobrado,
  ep.status AS pag_status,
  ep.paid_at,
  ep.expires_at,
  ep.tesouraria_lancamento_id,
  tl.tipo_recebimento,
  tl.tipo_movimento,
  tl.origem_modulo,
  tl.data_lancamento
FROM public.eventos_inscricoes ei
JOIN public.eventos ev ON ev.id = ei.evento_id
LEFT JOIN public.eventos_pagamentos ep ON ep.inscricao_id = ei.id
LEFT JOIN public.tesouraria_lancamentos tl ON tl.id = ep.tesouraria_lancamento_id
WHERE ev.titulo = 'TESTE PIX ASAAS'
ORDER BY ei.created_at;
