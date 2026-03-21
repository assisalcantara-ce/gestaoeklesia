-- Tabela de Usuários Administrativos
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'financeiro', 'suporte')),
  
  -- Dados Pessoais
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  rg VARCHAR(20),
  data_nascimento DATE,
  data_admissao DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  
  -- Contato
  telefone VARCHAR(20),
  whatsapp VARCHAR(20),
  
  -- Endereço
  cep VARCHAR(10),
  endereco TEXT,
  cidade VARCHAR(100),
  bairro VARCHAR(100),
  uf VARCHAR(2),
  
  -- Dados Financeiros (para usuários com role 'financeiro')
  banco VARCHAR(100),
  agencia VARCHAR(20),
  conta_corrente VARCHAR(20),
  pix VARCHAR(255),
  obs TEXT,
  
  -- Função/Cargo
  funcao VARCHAR(100),
  grupo VARCHAR(100),
  
  -- Controle
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID REFERENCES auth.users(id),
  
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status)
);

-- Habilitar RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
-- Admin pode fazer tudo
CREATE POLICY admin_all_access ON admin_users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Usuários podem ver seus próprios dados
CREATE POLICY user_own_data ON admin_users
  FOR SELECT
  USING (id = auth.uid());

-- Trigger para atualizar atualizado_em
CREATE OR REPLACE FUNCTION update_admin_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_users_updated_at
BEFORE UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION update_admin_users_updated_at();
