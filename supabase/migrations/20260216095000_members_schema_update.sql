-- Update members schema to include cadastro fields and ministerial fields

BEGIN;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS tipo_cadastro TEXT,
  ADD COLUMN IF NOT EXISTS matricula TEXT,
  ADD COLUMN IF NOT EXISTS divisao_1 TEXT,
  ADD COLUMN IF NOT EXISTS divisao_2 TEXT,
  ADD COLUMN IF NOT EXISTS divisao_3 TEXT,
  ADD COLUMN IF NOT EXISTS tipo_sanguineo TEXT,
  ADD COLUMN IF NOT EXISTS escolaridade TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil TEXT,
  ADD COLUMN IF NOT EXISTS nome_conjuge TEXT,
  ADD COLUMN IF NOT EXISTS cpf_conjuge TEXT,
  ADD COLUMN IF NOT EXISTS data_nascimento_conjuge DATE,
  ADD COLUMN IF NOT EXISTS nome_pai TEXT,
  ADD COLUMN IF NOT EXISTS nome_mae TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS nacionalidade TEXT,
  ADD COLUMN IF NOT EXISTS naturalidade TEXT,
  ADD COLUMN IF NOT EXISTS titulo_eleitoral TEXT,
  ADD COLUMN IF NOT EXISTS zona TEXT,
  ADD COLUMN IF NOT EXISTS secao TEXT,
  ADD COLUMN IF NOT EXISTS celular TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS tem_funcao_igreja BOOLEAN,
  ADD COLUMN IF NOT EXISTS qual_funcao TEXT,
  ADD COLUMN IF NOT EXISTS setor_departamento TEXT,
  ADD COLUMN IF NOT EXISTS data_batismo_aguas DATE,
  ADD COLUMN IF NOT EXISTS data_batismo_espirito_santo DATE,
  ADD COLUMN IF NOT EXISTS curso_teologico TEXT,
  ADD COLUMN IF NOT EXISTS instituicao_teologica TEXT,
  ADD COLUMN IF NOT EXISTS pastor_auxiliar BOOLEAN,
  ADD COLUMN IF NOT EXISTS procedencia TEXT,
  ADD COLUMN IF NOT EXISTS procedencia_local TEXT,
  ADD COLUMN IF NOT EXISTS cargo_ministerial TEXT,
  ADD COLUMN IF NOT EXISTS dados_cargos JSONB,
  ADD COLUMN IF NOT EXISTS observacoes_ministeriais TEXT,
  ADD COLUMN IF NOT EXISTS dizimista BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_members_tipo_cadastro ON public.members(tipo_cadastro);
CREATE INDEX IF NOT EXISTS idx_members_matricula ON public.members(matricula);
CREATE INDEX IF NOT EXISTS idx_members_divisao_1 ON public.members(divisao_1);
CREATE INDEX IF NOT EXISTS idx_members_divisao_2 ON public.members(divisao_2);
CREATE INDEX IF NOT EXISTS idx_members_divisao_3 ON public.members(divisao_3);

-- Optional backfill from custom_fields
UPDATE public.members
SET
  tipo_cadastro = COALESCE(tipo_cadastro, custom_fields->>'tipoCadastro', custom_fields->>'tipo_cadastro', role),
  matricula = COALESCE(matricula, custom_fields->>'matricula'),
  divisao_1 = COALESCE(divisao_1, custom_fields->>'congregacao', custom_fields->>'divisao1'),
  divisao_2 = COALESCE(divisao_2, custom_fields->>'campo', custom_fields->>'divisao2'),
  divisao_3 = COALESCE(divisao_3, custom_fields->>'supervisao', custom_fields->>'divisao3'),
  tipo_sanguineo = COALESCE(tipo_sanguineo, custom_fields->>'tipoSanguineo'),
  escolaridade = COALESCE(escolaridade, custom_fields->>'escolaridade'),
  estado_civil = COALESCE(estado_civil, custom_fields->>'estadoCivil'),
  nome_conjuge = COALESCE(nome_conjuge, custom_fields->>'nomeConjuge'),
  cpf_conjuge = COALESCE(cpf_conjuge, custom_fields->>'cpfConjuge'),
  data_nascimento_conjuge = COALESCE(data_nascimento_conjuge, NULLIF(custom_fields->>'dataNascimentoConjuge', '')::date),
  nome_pai = COALESCE(nome_pai, custom_fields->>'nomePai'),
  nome_mae = COALESCE(nome_mae, custom_fields->>'nomeMae'),
  rg = COALESCE(rg, custom_fields->>'rg'),
  nacionalidade = COALESCE(nacionalidade, custom_fields->>'nacionalidade'),
  naturalidade = COALESCE(naturalidade, custom_fields->>'naturalidade'),
  titulo_eleitoral = COALESCE(titulo_eleitoral, custom_fields->>'tituloEleitoral'),
  zona = COALESCE(zona, custom_fields->>'zona'),
  secao = COALESCE(secao, custom_fields->>'secao'),
  celular = COALESCE(celular, custom_fields->>'celular'),
  whatsapp = COALESCE(whatsapp, custom_fields->>'whatsapp'),
  foto_url = COALESCE(foto_url, custom_fields->>'fotoUrl'),
  tem_funcao_igreja = COALESCE(tem_funcao_igreja, (custom_fields->>'temFuncaoIgreja')::boolean),
  qual_funcao = COALESCE(qual_funcao, custom_fields->>'qualFuncao'),
  setor_departamento = COALESCE(setor_departamento, custom_fields->>'setorDepartamento'),
  data_batismo_aguas = COALESCE(data_batismo_aguas, NULLIF(custom_fields->>'dataBatismoAguas', '')::date),
  data_batismo_espirito_santo = COALESCE(data_batismo_espirito_santo, NULLIF(custom_fields->>'dataBatismoEspiritoSanto', '')::date),
  curso_teologico = COALESCE(curso_teologico, custom_fields->>'cursoTeologico'),
  instituicao_teologica = COALESCE(instituicao_teologica, custom_fields->>'instituicaoTeologica'),
  pastor_auxiliar = COALESCE(pastor_auxiliar, (custom_fields->>'pastorAuxiliar')::boolean),
  procedencia = COALESCE(procedencia, custom_fields->>'procedencia'),
  procedencia_local = COALESCE(procedencia_local, custom_fields->>'procedenciaLocal'),
  cargo_ministerial = COALESCE(cargo_ministerial, custom_fields->>'cargoMinisterial'),
  dados_cargos = COALESCE(dados_cargos, custom_fields->'dadosCargos'),
  observacoes_ministeriais = COALESCE(observacoes_ministeriais, custom_fields->>'observacoesMinisteriais'),
  dizimista = COALESCE(dizimista, (custom_fields->>'dizimista')::boolean)
WHERE custom_fields IS NOT NULL;

COMMIT;
