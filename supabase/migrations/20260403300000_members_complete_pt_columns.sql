-- ============================================================
-- MIGRAÇÃO COMPLETA: Tabela members
-- Renomeia colunas inglesas para português (sem acento)
-- e adiciona todos os campos do formulário de cadastro
-- (/secretaria/membros - abas: Dados, Endereço+Contato, Ministerial, Foto)
-- ============================================================

-- ============================================================
-- PARTE 1: Renomear colunas existentes (inglês → português)
-- ============================================================

-- Aba Dados: Data Nascimento
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='birth_date') THEN
    ALTER TABLE public.members RENAME COLUMN birth_date TO data_nascimento;
  END IF;
END $$;

-- Aba Dados: Sexo
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='gender') THEN
    ALTER TABLE public.members RENAME COLUMN gender TO sexo;
  END IF;
END $$;

-- Aba Dados: Estado Civil
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='marital_status') THEN
    ALTER TABLE public.members RENAME COLUMN marital_status TO estado_civil;
  END IF;
END $$;

-- Aba Ministerial: Profissão
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='occupation') THEN
    ALTER TABLE public.members RENAME COLUMN occupation TO profissao;
  END IF;
END $$;

-- Aba Endereço: Logradouro
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='address') THEN
    ALTER TABLE public.members RENAME COLUMN address TO logradouro;
  END IF;
END $$;

-- Aba Endereço: Complemento
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='complement') THEN
    ALTER TABLE public.members RENAME COLUMN complement TO complemento;
  END IF;
END $$;

-- Aba Endereço: Cidade
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='city') THEN
    ALTER TABLE public.members RENAME COLUMN city TO cidade;
  END IF;
END $$;

-- Aba Endereço: Estado (UF)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='state') THEN
    ALTER TABLE public.members RENAME COLUMN state TO estado;
  END IF;
END $$;

-- Aba Endereço: CEP
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='zipcode') THEN
    ALTER TABLE public.members RENAME COLUMN zipcode TO cep;
  END IF;
END $$;

-- Observações gerais
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='notes') THEN
    ALTER TABLE public.members RENAME COLUMN notes TO observacoes;
  END IF;
END $$;

-- ============================================================
-- PARTE 2: Adicionar colunas ausentes
-- ============================================================

-- Aba Dados: Matrícula
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS matricula VARCHAR(50);

-- Aba Dados: Código único para QR Code (16 chars)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS unique_id VARCHAR(20);

-- Aba Dados: Tipo de Cadastro (membro, congregado, ministro, crianca)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS tipo_cadastro VARCHAR(50) DEFAULT 'ministro';

-- Aba Dados: Tipo Sanguíneo
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS tipo_sanguineo VARCHAR(10);

-- Aba Dados: Escolaridade
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS escolaridade VARCHAR(50);

-- Aba Dados: Nome do Cônjuge
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nome_conjuge VARCHAR(255);

-- Aba Dados: CPF do Cônjuge
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS cpf_conjuge VARCHAR(20);

-- Aba Dados: Data Nascimento do Cônjuge
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS data_nascimento_conjuge DATE;

-- Aba Dados: Nome do Pai
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nome_pai VARCHAR(255);

-- Aba Dados: Nome da Mãe
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nome_mae VARCHAR(255);

-- Aba Dados: RG
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS rg VARCHAR(30);

-- Aba Dados: Nacionalidade
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nacionalidade VARCHAR(50) DEFAULT 'BRASILEIRA';

-- Aba Dados: Naturalidade
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS naturalidade VARCHAR(100);

-- Aba Dados: UF (de naturalidade)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS uf_naturalidade CHAR(2);

-- Aba Dados: Título Eleitoral
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS titulo_eleitoral VARCHAR(50);

-- Aba Dados: Zona Eleitoral
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS zona_eleitoral VARCHAR(20);

-- Aba Dados: Seção Eleitoral
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS secao_eleitoral VARCHAR(20);

-- Aba Dados: Data de Batismo nas Águas
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS data_batismo_aguas DATE;

-- Aba Dados: Data de Batismo no Espírito Santo
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS data_batismo_espirito_santo DATE;

-- Aba Endereço: Número do endereço
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS numero VARCHAR(20);

-- Aba Endereço: Bairro
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);

-- Aba Contato: Celular
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS celular VARCHAR(20);

-- Aba Contato: WhatsApp
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20);

-- Aba Ministerial: Curso Teológico
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS curso_teologico VARCHAR(50);

-- Aba Ministerial: Instituição Teológica
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS instituicao_teologica VARCHAR(255);

-- Aba Ministerial: Pastor Auxiliar
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS pastor_auxiliar BOOLEAN DEFAULT false;

-- Aba Ministerial: Procedência
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS procedencia VARCHAR(50);

-- Aba Ministerial: Procedência Local
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS procedencia_local VARCHAR(255);

-- Aba Ministerial: Cargo Ministerial
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS cargo_ministerial VARCHAR(100);

-- Aba Ministerial: Dados dos Cargos (JSON - datas, locais de consagração)
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS dados_cargos JSONB DEFAULT '{}';

-- Aba Ministerial: Tem Função na Igreja
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS tem_funcao_igreja BOOLEAN DEFAULT false;

-- Aba Ministerial: Qual Função
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS qual_funcao VARCHAR(255);

-- Aba Ministerial: Setor/Departamento
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS setor_departamento VARCHAR(100);

-- Aba Ministerial: Observações Ministeriais
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS observacoes_ministeriais TEXT;

-- Aba Foto: URL da Foto
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- ============================================================
-- PARTE 3: Índices para campos de busca comuns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_members_tipo_cadastro ON public.members(tipo_cadastro);
CREATE INDEX IF NOT EXISTS idx_members_cidade ON public.members(cidade);
CREATE INDEX IF NOT EXISTS idx_members_estado ON public.members(estado);
CREATE INDEX IF NOT EXISTS idx_members_cargo_ministerial ON public.members(cargo_ministerial);
CREATE INDEX IF NOT EXISTS idx_members_unique_id ON public.members(unique_id);

-- ============================================================
-- RESULTADO: Verificar estrutura final
-- ============================================================
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'members'
-- ORDER BY ordinal_position;
