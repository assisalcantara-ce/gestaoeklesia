-- ============================================
-- SETUP TABELAS DE GEOLOCALIZAÇÃO
-- ============================================

-- Criar tabela de membros com geolocalização
CREATE TABLE IF NOT EXISTS membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  celular TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT DEFAULT 'AM',
  cep TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  tipoCadastro TEXT DEFAULT 'membro' CHECK (tipoCadastro IN ('membro', 'congregado', 'ministro', 'crianca')),
  congregacao TEXT,
  supervisao TEXT,
  fotoUrl TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de congregações com geolocalização
CREATE TABLE IF NOT EXISTS congregacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT DEFAULT 'AM',
  cep TEXT,
  telefone TEXT,
  email TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  pastor_responsavel TEXT,
  data_fundacao DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_membros_cidade ON membros(cidade);
CREATE INDEX IF NOT EXISTS idx_membros_status ON membros(status);
CREATE INDEX IF NOT EXISTS idx_membros_geoloc ON membros USING GIST (ll_to_earth(latitude, longitude));
CREATE INDEX IF NOT EXISTS idx_congregacoes_cidade ON congregacoes(cidade);
CREATE INDEX IF NOT EXISTS idx_congregacoes_status ON congregacoes(status);
CREATE INDEX IF NOT EXISTS idx_congregacoes_geoloc ON congregacoes USING GIST (ll_to_earth(latitude, longitude));

-- ============================================
-- INSERIR DADOS DE TESTE
-- ============================================

-- Membros em Manaus
INSERT INTO membros (nome, email, celular, logradouro, numero, bairro, cidade, estado, latitude, longitude, status, tipoCadastro, congregacao) VALUES
('João Silva Santos', 'joao.silva@email.com', '(92) 99999-8888', 'Rua das Flores', '123', 'Centro', 'Manaus', 'AM', -3.1190, -60.0217, 'ativo', 'membro', 'Congregação Central'),
('Maria Costa Oliveira', 'maria.costa@email.com', '(92) 98888-7777', 'Avenida Getúlio Vargas', '456', 'Nazaré', 'Manaus', 'AM', -3.0900, -60.0300, 'ativo', 'membro', 'Congregação Nazaré'),
('Pedro Ferreira Rocha', 'pedro.ferreira@email.com', '(92) 97777-6666', 'Rua 10 de Julho', '789', 'Centro', 'Manaus', 'AM', -3.1195, -60.0210, 'ativo', 'congregado', 'Congregação Central'),
('Ana Paula Gomes', 'ana.paula@email.com', '(92) 96666-5555', 'Avenida Djalma Batista', '321', 'Chapada', 'Manaus', 'AM', -3.0500, -60.0500, 'ativo', 'membro', 'Congregação Chapada'),
('Carlos Eduardo Mendes', 'carlos.mendes@email.com', '(92) 95555-4444', 'Rua Nhamundá', '654', 'Educandos', 'Manaus', 'AM', -3.1400, -60.0100, 'inativo', 'membro', 'Congregação Educandos'),
('Juliana Ribeiro Santos', 'juliana.ribeiro@email.com', '(92) 94444-3333', 'Avenida Brasil', '987', 'Raiz', 'Manaus', 'AM', -3.0800, -60.0600, 'ativo', 'ministro', 'Congregação Raiz'),
('Roberto Alves Costa', 'roberto.alves@email.com', '(92) 93333-2222', 'Rua Teresina', '147', 'Adrianópolis', 'Manaus', 'AM', -3.0700, -60.0400, 'ativo', 'membro', 'Congregação Adrianópolis');

-- Congregações em Manaus
INSERT INTO congregacoes (nome, endereco, numero, bairro, cidade, estado, latitude, longitude, status, pastor_responsavel, data_fundacao) VALUES
('Congregação Central', 'Rua das Flores', '123', 'Centro', 'Manaus', 'AM', -3.1190, -60.0217, 'ativo', 'Pastor João da Silva', '2010-01-15'),
('Congregação Nazaré', 'Avenida Getúlio Vargas', '456', 'Nazaré', 'Manaus', 'AM', -3.0900, -60.0300, 'ativo', 'Pastor Pedro Costa', '2012-03-20'),
('Congregação Chapada', 'Avenida Djalma Batista', '321', 'Chapada', 'Manaus', 'AM', -3.0500, -60.0500, 'ativo', 'Pastor Carlos Mendes', '2015-06-10'),
('Congregação Educandos', 'Rua Nhamundá', '654', 'Educandos', 'Manaus', 'AM', -3.1400, -60.0100, 'inativo', 'Pastor Roberto Alves', '2008-11-05'),
('Congregação Raiz', 'Avenida Brasil', '987', 'Raiz', 'Manaus', 'AM', -3.0800, -60.0600, 'ativo', 'Pastor Juliana Ribeiro', '2018-04-12');

-- ============================================
-- CONFIGURAR RLS (Row Level Security) - Opcional
-- ============================================

-- Habilitar RLS nas tabelas (comentado - ativar conforme necessário)
-- ALTER TABLE membros ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE congregacoes ENABLE ROW LEVEL SECURITY;

-- Política para permissão pública de leitura (desenvolvimento)
-- CREATE POLICY "allow_public_read_membros" ON membros FOR SELECT USING (true);
-- CREATE POLICY "allow_public_read_congregacoes" ON congregacoes FOR SELECT USING (true);
