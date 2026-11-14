-- ==============================================================================
-- GESTÃO EKLÉSIA - MÓDULO CÉLULAS
-- FASE 7: Inteligência Pastoral e Relatórios Avançados
-- Migration: 20261113200000_fase7_modulo_celulas_inteligencia_pastoral.sql
--
-- Descrição:
--   Criação de índices compostos aditivos de alta performance para otimização
--   de agregações de inteligência pastoral, reconciliação de presenças,
--   crescimento, acompanhamento de saúde da célula e detecção de alertas operacionais.
--
-- Invariantes de Segurança:
--   - Aditiva e estritamente não destrutiva.
--   - Preserva total isolamento multi-tenant por ministry_id.
--   - Compatível com todos os lotes 1 a 6.
-- ==============================================================================

-- 1. Otimização de consultas temporais de reuniões finalizadas por ministério, congregação e célula
CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_intel_periodo 
  ON public.celulas_reunioes (ministry_id, congregacao_id, data_reuniao) 
  WHERE status = 'finalizada';

CREATE INDEX IF NOT EXISTS idx_celulas_reunioes_intel_celula_data 
  ON public.celulas_reunioes (ministry_id, celula_id, data_reuniao) 
  WHERE status = 'finalizada';

-- 2. Otimização de contagem e acompanhamento de participantes ativos por congregação/célula
CREATE INDEX IF NOT EXISTS idx_celulas_participantes_intel_ativo 
  ON public.celulas_participantes (ministry_id, congregacao_id, celula_id, status)
  WHERE status = 'ativo';

-- 3. Otimização de busca de supervisões por status e solicitações de apoio pastoral em aberto
CREATE INDEX IF NOT EXISTS idx_celulas_supervisoes_intel_apoio 
  ON public.celulas_supervisoes (ministry_id, congregacao_id, status, solicitou_apoio_pastoral);

-- 4. Otimização de histórico de multiplicações para genealogia e acompanhamento de crescimento
CREATE INDEX IF NOT EXISTS idx_celulas_multiplicacoes_intel_periodo
  ON public.celulas_multiplicacoes (ministry_id, congregacao_id, status, data_efetivacao);
