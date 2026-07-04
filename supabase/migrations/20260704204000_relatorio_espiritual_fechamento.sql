-- Migração: Criar tabela de fechamentos do Relatório Espiritual
CREATE TABLE IF NOT EXISTS relatorio_espiritual_fechamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text_id VARCHAR(100), -- Reservado para compatibilidade se necessário
    ministry_id UUID NOT NULL REFERENCES ministries(id) ON DELETE CASCADE,
    congregacao_id UUID REFERENCES congregacoes(id) ON DELETE CASCADE,
    mes INT NOT NULL CHECK (mes >= 1 AND mes <= 12),
    ano INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Aberta' CHECK (status IN ('Aberta', 'Fechada')),
    fechado_em TIMESTAMPTZ,
    fechado_por UUID,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir unicidade: se congregacao_id for null (visão consolidada), usamos uuid nulo no index parcial ou COALESCE
CREATE UNIQUE INDEX IF NOT EXISTS uq_rel_esp_fechamento 
ON relatorio_espiritual_fechamentos (ministry_id, COALESCE(congregacao_id, '00000000-0000-0000-0000-000000000000'), mes, ano);

-- Habilitar RLS
ALTER TABLE relatorio_espiritual_fechamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS simples baseadas no ministry_id do usuário logado
CREATE POLICY "Permitir leitura geral para membros do mesmo ministry"
ON relatorio_espiritual_fechamentos
FOR SELECT
TO authenticated
USING (
  ministry_id IN (
    SELECT mu.ministry_id FROM ministry_users mu WHERE mu.user_id = auth.uid()
  )
);

CREATE POLICY "Permitir modificação para membros do mesmo ministry"
ON relatorio_espiritual_fechamentos
FOR ALL
TO authenticated
USING (
  ministry_id IN (
    SELECT mu.ministry_id FROM ministry_users mu WHERE mu.user_id = auth.uid()
  )
)
WITH CHECK (
  ministry_id IN (
    SELECT mu.ministry_id FROM ministry_users mu WHERE mu.user_id = auth.uid()
  )
);
