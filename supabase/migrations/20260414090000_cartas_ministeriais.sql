-- Modulo Cartas Ministeriais: templates e registros

BEGIN;

CREATE TABLE IF NOT EXISTS public.cartas_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID REFERENCES public.ministries(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  title TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'custom',
  scope TEXT NOT NULL DEFAULT 'tenant',
  content_json JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cartas_templates_ministry_id
  ON public.cartas_templates(ministry_id);
CREATE INDEX IF NOT EXISTS idx_cartas_templates_scope
  ON public.cartas_templates(scope);
CREATE INDEX IF NOT EXISTS idx_cartas_templates_tipo
  ON public.cartas_templates(tipo);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cartas_templates_system_key
  ON public.cartas_templates(template_key)
  WHERE scope = 'system';

CREATE UNIQUE INDEX IF NOT EXISTS ux_cartas_templates_tenant_key
  ON public.cartas_templates(ministry_id, template_key)
  WHERE scope = 'tenant';

ALTER TABLE public.cartas_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cartas_templates_select ON public.cartas_templates;
DROP POLICY IF EXISTS cartas_templates_insert ON public.cartas_templates;
DROP POLICY IF EXISTS cartas_templates_update ON public.cartas_templates;
DROP POLICY IF EXISTS cartas_templates_delete ON public.cartas_templates;

CREATE POLICY cartas_templates_select
  ON public.cartas_templates FOR SELECT
  USING (
    scope = 'system'
    OR (
      scope = 'tenant'
      AND ministry_id IN (
        SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY cartas_templates_insert
  ON public.cartas_templates FOR INSERT
  WITH CHECK (
    scope = 'tenant'
    AND ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY cartas_templates_update
  ON public.cartas_templates FOR UPDATE
  USING (
    scope = 'tenant'
    AND ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY cartas_templates_delete
  ON public.cartas_templates FOR DELETE
  USING (
    scope = 'tenant'
    AND ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.cartas_registros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.cartas_templates(id) ON DELETE SET NULL,
  template_key TEXT,
  template_title TEXT,
  status TEXT NOT NULL DEFAULT 'emitida',
  payload_snapshot JSONB DEFAULT '{}'::jsonb,
  template_snapshot JSONB,
  rendered_html TEXT,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cartas_registros_ministry_id
  ON public.cartas_registros(ministry_id);
CREATE INDEX IF NOT EXISTS idx_cartas_registros_status
  ON public.cartas_registros(status);
CREATE INDEX IF NOT EXISTS idx_cartas_registros_member_id
  ON public.cartas_registros(member_id);

ALTER TABLE public.cartas_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cartas_registros_select ON public.cartas_registros;
DROP POLICY IF EXISTS cartas_registros_insert ON public.cartas_registros;
DROP POLICY IF EXISTS cartas_registros_update ON public.cartas_registros;
DROP POLICY IF EXISTS cartas_registros_delete ON public.cartas_registros;

CREATE POLICY cartas_registros_select
  ON public.cartas_registros FOR SELECT
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY cartas_registros_insert
  ON public.cartas_registros FOR INSERT
  WITH CHECK (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY cartas_registros_update
  ON public.cartas_registros FOR UPDATE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY cartas_registros_delete
  ON public.cartas_registros FOR DELETE
  USING (
    ministry_id IN (
      SELECT ministry_id FROM public.ministry_users WHERE user_id = auth.uid()
    )
  );

-- Templates nativos
INSERT INTO public.cartas_templates (template_key, title, tipo, scope, content_json, is_active)
VALUES
  (
    'mudanca',
    'Carta de Mudança',
    'mudanca',
    'system',
    $$
    {
      "type": "doc",
      "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "CARTA DE MUDANCA"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Declaramos para os devidos fins que {{membro.nome}}, CPF {{membro.cpf}}, membro desta igreja, encontra-se em plena comunhao e esta apto(a) para mudanca."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Congregacao: {{membro.congregacao}}. Cargo: {{membro.cargo}}."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Em fe de verdade, firmamos a presente."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{igreja.nome}} - {{igreja.endereco}}"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{data.extenso}}"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "________________________________________"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{pastor.responsavel}}"}]}
      ]
    }
    $$::jsonb,
    true
  ),
  (
    'transito',
    'Carta de Transito',
    'transito',
    'system',
    $$
    {
      "type": "doc",
      "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "CARTA DE TRANSITO"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Certificamos que {{membro.nome}}, CPF {{membro.cpf}}, esta em transito e permanece em comunhao com {{igreja.nome}}."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Cargo: {{membro.cargo}}. Congregacao: {{membro.congregacao}}."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Esta carta tem validade de 30 dias a partir da data de emissao."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{data.extenso}}"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "________________________________________"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{pastor.responsavel}}"}]}
      ]
    }
    $$::jsonb,
    true
  ),
  (
    'desligamento',
    'Carta de Desligamento',
    'desligamento',
    'system',
    $$
    {
      "type": "doc",
      "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "CARTA DE DESLIGAMENTO"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Comunicamos que {{membro.nome}}, CPF {{membro.cpf}}, encontra-se desligado(a) do quadro de membros de {{igreja.nome}}."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Motivo (se aplicavel): {{carta.motivo}}."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{data.extenso}}"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "________________________________________"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{pastor.responsavel}}"}]}
      ]
    }
    $$::jsonb,
    true
  ),
  (
    'recomendacao',
    'Carta de Recomendacao',
    'recomendacao',
    'system',
    $$
    {
      "type": "doc",
      "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "CARTA DE RECOMENDACAO"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Recomendamos {{membro.nome}}, CPF {{membro.cpf}}, membro de {{igreja.nome}}, por sua conduta cristã e bom testemunho."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "Cargo: {{membro.cargo}}. Congregacao: {{membro.congregacao}}."}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{data.extenso}}"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "________________________________________"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "{{pastor.responsavel}}"}]}
      ]
    }
    $$::jsonb,
    true
  )
ON CONFLICT (template_key) WHERE scope = 'system' DO NOTHING;

COMMIT;
