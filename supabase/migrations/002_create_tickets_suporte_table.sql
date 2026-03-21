-- Create tickets_suporte table
CREATE TABLE IF NOT EXISTS tickets_suporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo VARCHAR(100) NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_progresso', 'resolvido', 'fechado')),
  prioridade VARCHAR(20) NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
  categoria VARCHAR(50) NOT NULL DEFAULT 'Geral',
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  data_atualizacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_tickets_usuario_id ON tickets_suporte(usuario_id);
CREATE INDEX idx_tickets_status ON tickets_suporte(status);
CREATE INDEX idx_tickets_data_criacao ON tickets_suporte(data_criacao DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE tickets_suporte ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own tickets
CREATE POLICY "users_can_view_own_tickets"
  ON tickets_suporte
  FOR SELECT
  USING (auth.uid() = usuario_id);

-- RLS Policy: Users can only create tickets for themselves
CREATE POLICY "users_can_create_own_tickets"
  ON tickets_suporte
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- RLS Policy: Users can update their own tickets (status updates from admin will be separate)
CREATE POLICY "users_can_update_own_tickets"
  ON tickets_suporte
  FOR UPDATE
  USING (auth.uid() = usuario_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON tickets_suporte TO authenticated;
