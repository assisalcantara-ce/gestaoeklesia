-- Migração: Tipos de Agenda Configuráveis
-- Adiciona a tabela agenda_tipos e o relacionamento com agenda_eventos

BEGIN;

-- 1. Criar tabela agenda_tipos
CREATE TABLE IF NOT EXISTS public.agenda_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL,
  cor TEXT,
  icone TEXT,
  sistema BOOLEAN DEFAULT true,
  permite_edicao BOOLEAN DEFAULT true,
  gera_bloqueio BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  ordem SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (ministry_id, codigo),
  CONSTRAINT agenda_tipos_categoria CHECK (categoria IN ('culto', 'reuniao', 'evento', 'missoes', 'departamento', 'administrativo'))
);

CREATE INDEX IF NOT EXISTS idx_agenda_tipos_ministry ON public.agenda_tipos(ministry_id);
CREATE INDEX IF NOT EXISTS idx_agenda_tipos_categoria ON public.agenda_tipos(categoria);

-- RLS para agenda_tipos
ALTER TABLE public.agenda_tipos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_tipos_select ON public.agenda_tipos;
DROP POLICY IF EXISTS agenda_tipos_insert ON public.agenda_tipos;
DROP POLICY IF EXISTS agenda_tipos_update ON public.agenda_tipos;
DROP POLICY IF EXISTS agenda_tipos_delete ON public.agenda_tipos;

CREATE POLICY "agenda_tipos_select" ON public.agenda_tipos FOR SELECT USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_tipos_insert" ON public.agenda_tipos FOR INSERT WITH CHECK (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_tipos_update" ON public.agenda_tipos FOR UPDATE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

CREATE POLICY "agenda_tipos_delete" ON public.agenda_tipos FOR DELETE USING (
  ministry_id IN (
    SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
  )
);

-- 2. Função de Seed para tipos padrões
CREATE OR REPLACE FUNCTION public.seed_agenda_tipos_padrao(p_ministry_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Categoria: Cultos
  INSERT INTO public.agenda_tipos (ministry_id, codigo, nome, categoria, cor, icone, sistema, permite_edicao, gera_bloqueio, ordem)
  VALUES
    (p_ministry_id, 'culto_doutrina', 'Culto de Doutrina', 'culto', '#ef4444', 'BookOpen', true, true, false, 1),
    (p_ministry_id, 'culto_familia', 'Culto da Família', 'culto', '#f87171', 'Home', true, true, false, 2),
    (p_ministry_id, 'culto_missoes', 'Culto de Missões', 'culto', '#dc2626', 'Globe', true, true, false, 3),
    (p_ministry_id, 'culto_jovens', 'Culto de Jovens', 'culto', '#fca5a5', 'Sparkles', true, true, false, 4),
    (p_ministry_id, 'culto_criancas', 'Culto de Crianças', 'culto', '#fecdd3', 'Smile', true, true, false, 5),
    (p_ministry_id, 'culto_senhoras', 'Culto de Senhoras', 'culto', '#fda4af', 'Heart', true, true, false, 6),
    (p_ministry_id, 'culto_varoes', 'Culto de Varões', 'culto', '#e11d48', 'Shield', true, true, false, 7),
    (p_ministry_id, 'santa_ceia', 'Santa Ceia', 'culto', '#991b1b', 'GlassWater', true, true, true, 8),
    (p_ministry_id, 'vigilia', 'Vigília', 'culto', '#7f1d1d', 'Moon', true, true, false, 9),
    (p_ministry_id, 'evangelismo', 'Evangelismo', 'culto', '#b91c1c', 'Megaphone', true, true, false, 10)
  ON CONFLICT (ministry_id, codigo) DO NOTHING;

  -- Categoria: Reuniões
  INSERT INTO public.agenda_tipos (ministry_id, codigo, nome, categoria, cor, icone, sistema, permite_edicao, gera_bloqueio, ordem)
  VALUES
    (p_ministry_id, 'reuniao_ministerial', 'Reunião Ministerial', 'reuniao', '#8b5cf6', 'Briefcase', true, true, false, 11),
    (p_ministry_id, 'reuniao_obreiros', 'Reunião de Obreiros', 'reuniao', '#a78bfa', 'Users', true, true, false, 12),
    (p_ministry_id, 'reuniao_diretoria', 'Reunião de Diretoria', 'reuniao', '#7c3aed', 'Award', true, true, false, 13),
    (p_ministry_id, 'reuniao_ebd', 'Reunião da EBD', 'reuniao', '#ddd6fe', 'BookOpen', true, true, false, 14),
    (p_ministry_id, 'reuniao_departamento', 'Reunião de Departamento', 'reuniao', '#c084fc', 'Folder', true, true, false, 15)
  ON CONFLICT (ministry_id, codigo) DO NOTHING;

  -- Categoria: Eventos
  INSERT INTO public.agenda_tipos (ministry_id, codigo, nome, categoria, cor, icone, sistema, permite_edicao, gera_bloqueio, ordem)
  VALUES
    (p_ministry_id, 'congresso', 'Congresso', 'evento', '#10b981', 'Calendar', true, true, true, 16),
    (p_ministry_id, 'conferencia', 'Conferência', 'evento', '#34d399', 'Mic', true, true, true, 17),
    (p_ministry_id, 'seminario', 'Seminário', 'evento', '#059669', 'GraduationCap', true, true, false, 18),
    (p_ministry_id, 'retiro', 'Retiro', 'evento', '#6ee7b7', 'Compass', true, true, false, 19),
    (p_ministry_id, 'acampamento', 'Acampamento', 'evento', '#047857', 'Tent', true, true, false, 20)
  ON CONFLICT (ministry_id, codigo) DO NOTHING;

  -- Categoria: Missões
  INSERT INTO public.agenda_tipos (ministry_id, codigo, nome, categoria, cor, icone, sistema, permite_edicao, gera_bloqueio, ordem)
  VALUES
    (p_ministry_id, 'conferencia_missionaria', 'Conferência Missionária', 'missoes', '#f59e0b', 'Globe', true, true, false, 21),
    (p_ministry_id, 'viagem_missionaria', 'Viagem Missionária', 'missoes', '#fbbf24', 'Plane', true, true, false, 22),
    (p_ministry_id, 'campanha_missionaria', 'Campanha Missionária', 'missoes', '#d97706', 'Flag', true, true, false, 23)
  ON CONFLICT (ministry_id, codigo) DO NOTHING;

  -- Categoria: Administrativo
  INSERT INTO public.agenda_tipos (ministry_id, codigo, nome, categoria, cor, icone, sistema, permite_edicao, gera_bloqueio, ordem)
  VALUES
    (p_ministry_id, 'atendimento_pastoral', 'Atendimento Pastoral', 'administrativo', '#3b82f6', 'MessageSquare', true, true, false, 24),
    (p_ministry_id, 'casamento', 'Casamento', 'administrativo', '#60a5fa', 'Heart', true, true, false, 25),
    (p_ministry_id, 'batismo', 'Batismo', 'administrativo', '#2563eb', 'Droplet', true, true, false, 26),
    (p_ministry_id, 'apresentacao_criancas', 'Apresentação de Crianças', 'administrativo', '#93c5fd', 'Baby', true, true, false, 27),
    (p_ministry_id, 'assembleia_geral', 'Assembleia Geral', 'administrativo', '#1d4ed8', 'FileText', true, true, true, 28)
  ON CONFLICT (ministry_id, codigo) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_agenda_tipos_padrao TO authenticated;

-- 3. Adicionar coluna tipo_id à agenda_eventos
ALTER TABLE public.agenda_eventos ADD COLUMN IF NOT EXISTS tipo_id UUID REFERENCES public.agenda_tipos(id) ON DELETE SET NULL;

-- 4. Executar migração de dados e associar registros antigos
DO $$
DECLARE
  r RECORD;
  v_tipo_id UUID;
  v_codigo TEXT;
BEGIN
  -- Para cada ministério com eventos cadastrados, garante o seed dos tipos padrões
  FOR r IN SELECT DISTINCT ministry_id FROM public.agenda_eventos LOOP
    PERFORM public.seed_agenda_tipos_padrao(r.ministry_id);
  END LOOP;

  -- Atualiza cada evento de acordo com a coluna de texto atual "tipo"
  FOR r IN SELECT id, ministry_id, tipo FROM public.agenda_eventos LOOP
    v_codigo := CASE r.tipo
      WHEN 'culto' THEN 'culto_doutrina'
      WHEN 'reuniao' THEN 'reuniao_obreiros'
      WHEN 'aula' THEN 'reuniao_ebd'
      WHEN 'evento' THEN 'congresso'
      WHEN 'tarefa' THEN 'atendimento_pastoral'
      ELSE 'assembleia_geral'
    END;

    SELECT id INTO v_tipo_id FROM public.agenda_tipos WHERE ministry_id = r.ministry_id AND codigo = v_codigo LIMIT 1;

    IF v_tipo_id IS NOT NULL THEN
      UPDATE public.agenda_eventos SET tipo_id = v_tipo_id WHERE id = r.id;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
