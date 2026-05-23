-- Hardening RLS do modulo EBD:
-- - Administrador/EBD/Coordenador: escopo global do ministerio.
-- - Superintendente: escopo local da propria congregacao.
-- - Dono do ministerio: escopo global.

BEGIN;

CREATE OR REPLACE FUNCTION public.ebd_user_global_access(p_ministry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ministries m
    WHERE m.id = p_ministry_id
      AND m.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND (
        lower(coalesce(mu.role, '')) IN ('admin', 'administrador', 'manager', 'coordenador', 'coordinator')
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["ADMINISTRADOR"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["EBD"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["COORDENADOR"]'::jsonb
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ebd_user_local_access(p_ministry_id uuid, p_church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ebd_user_global_access(p_ministry_id)
  OR EXISTS (
    SELECT 1
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND mu.congregacao_id = p_church_id
      AND (
        lower(coalesce(mu.role, '')) IN ('superintendente', 'superintendent')
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["SUPERINTENDENTE"]'::jsonb
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ebd_user_any_access(p_ministry_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ebd_user_global_access(p_ministry_id)
  OR EXISTS (
    SELECT 1
    FROM public.ministry_users mu
    WHERE mu.user_id = auth.uid()
      AND mu.ministry_id = p_ministry_id
      AND (
        lower(coalesce(mu.role, '')) IN ('superintendente', 'superintendent', 'coordenador', 'coordinator')
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["SUPERINTENDENTE"]'::jsonb
        OR coalesce(mu.permissions, '[]'::jsonb) @> '["COORDENADOR"]'::jsonb
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ebd_turma_access(p_turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ebd_turmas t
    WHERE t.id = p_turma_id
      AND public.ebd_user_local_access(t.ministry_id, t.church_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.ebd_aluno_access(p_aluno_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ebd_alunos a
    WHERE a.id = p_aluno_id
      AND public.ebd_user_local_access(a.ministry_id, a.church_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.ebd_aula_access(p_aula_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ebd_aulas a
    JOIN public.ebd_turmas t ON t.id = a.turma_id
    WHERE a.id = p_aula_id
      AND a.ministry_id = t.ministry_id
      AND public.ebd_user_local_access(a.ministry_id, t.church_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.ebd_matricula_access(p_ministry_id uuid, p_aluno_id uuid, p_turma_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ebd_user_global_access(p_ministry_id)
  OR (
    public.ebd_aluno_access(p_aluno_id)
    AND public.ebd_turma_access(p_turma_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.ebd_pedido_access(p_pedido_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ebd_pedidos_revistas p
    WHERE p.id = p_pedido_id
      AND (
        public.ebd_user_global_access(p.ministry_id)
        OR (p.church_id IS NOT NULL AND public.ebd_user_local_access(p.ministry_id, p.church_id))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.ebd_oferta_access(p_ministry_id uuid, p_church_id uuid, p_aula_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.ebd_user_global_access(p_ministry_id)
  OR (
    p_church_id IS NOT NULL
    AND public.ebd_user_local_access(p_ministry_id, p_church_id)
  )
  OR (
    p_aula_id IS NOT NULL
    AND public.ebd_aula_access(p_aula_id)
  );
$$;

-- Tabelas globais do modulo: superintendentes podem ler, mas escrita fica global.
DROP POLICY IF EXISTS ebd_classes_select ON public.ebd_classes;
DROP POLICY IF EXISTS ebd_classes_insert ON public.ebd_classes;
DROP POLICY IF EXISTS ebd_classes_update ON public.ebd_classes;
DROP POLICY IF EXISTS ebd_classes_delete ON public.ebd_classes;
CREATE POLICY ebd_classes_select ON public.ebd_classes FOR SELECT USING (public.ebd_user_any_access(ministry_id));
CREATE POLICY ebd_classes_insert ON public.ebd_classes FOR INSERT WITH CHECK (public.ebd_user_global_access(ministry_id));
CREATE POLICY ebd_classes_update ON public.ebd_classes FOR UPDATE USING (public.ebd_user_global_access(ministry_id)) WITH CHECK (public.ebd_user_global_access(ministry_id));
CREATE POLICY ebd_classes_delete ON public.ebd_classes FOR DELETE USING (public.ebd_user_global_access(ministry_id));

DROP POLICY IF EXISTS ebd_trimestres_access ON public.ebd_trimestres;
DROP POLICY IF EXISTS ebd_trimestres_select ON public.ebd_trimestres;
DROP POLICY IF EXISTS ebd_trimestres_insert ON public.ebd_trimestres;
DROP POLICY IF EXISTS ebd_trimestres_update ON public.ebd_trimestres;
DROP POLICY IF EXISTS ebd_trimestres_delete ON public.ebd_trimestres;
CREATE POLICY ebd_trimestres_select ON public.ebd_trimestres FOR SELECT USING (public.ebd_user_any_access(ministry_id));
CREATE POLICY ebd_trimestres_insert ON public.ebd_trimestres FOR INSERT WITH CHECK (public.ebd_user_global_access(ministry_id));
CREATE POLICY ebd_trimestres_update ON public.ebd_trimestres FOR UPDATE USING (public.ebd_user_global_access(ministry_id)) WITH CHECK (public.ebd_user_global_access(ministry_id));
CREATE POLICY ebd_trimestres_delete ON public.ebd_trimestres FOR DELETE USING (public.ebd_user_global_access(ministry_id));

DROP POLICY IF EXISTS ebd_revistas_select ON public.ebd_revistas;
DROP POLICY IF EXISTS ebd_revistas_insert ON public.ebd_revistas;
DROP POLICY IF EXISTS ebd_revistas_update ON public.ebd_revistas;
DROP POLICY IF EXISTS ebd_revistas_delete ON public.ebd_revistas;
CREATE POLICY ebd_revistas_select ON public.ebd_revistas FOR SELECT USING (public.ebd_user_any_access(ministry_id));
CREATE POLICY ebd_revistas_insert ON public.ebd_revistas FOR INSERT WITH CHECK (public.ebd_user_global_access(ministry_id));
CREATE POLICY ebd_revistas_update ON public.ebd_revistas FOR UPDATE USING (public.ebd_user_global_access(ministry_id)) WITH CHECK (public.ebd_user_global_access(ministry_id));
CREATE POLICY ebd_revistas_delete ON public.ebd_revistas FOR DELETE USING (public.ebd_user_global_access(ministry_id));

-- Tabelas com church_id direto.
DROP POLICY IF EXISTS ebd_professores_select ON public.ebd_professores;
DROP POLICY IF EXISTS ebd_professores_insert ON public.ebd_professores;
DROP POLICY IF EXISTS ebd_professores_update ON public.ebd_professores;
DROP POLICY IF EXISTS ebd_professores_delete ON public.ebd_professores;
CREATE POLICY ebd_professores_select ON public.ebd_professores FOR SELECT USING (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_professores_insert ON public.ebd_professores FOR INSERT WITH CHECK (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_professores_update ON public.ebd_professores FOR UPDATE USING (public.ebd_user_local_access(ministry_id, church_id)) WITH CHECK (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_professores_delete ON public.ebd_professores FOR DELETE USING (public.ebd_user_global_access(ministry_id));

DROP POLICY IF EXISTS ebd_turmas_select ON public.ebd_turmas;
DROP POLICY IF EXISTS ebd_turmas_insert ON public.ebd_turmas;
DROP POLICY IF EXISTS ebd_turmas_update ON public.ebd_turmas;
DROP POLICY IF EXISTS ebd_turmas_delete ON public.ebd_turmas;
CREATE POLICY ebd_turmas_select ON public.ebd_turmas FOR SELECT USING (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_turmas_insert ON public.ebd_turmas FOR INSERT WITH CHECK (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_turmas_update ON public.ebd_turmas FOR UPDATE USING (public.ebd_user_local_access(ministry_id, church_id)) WITH CHECK (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_turmas_delete ON public.ebd_turmas FOR DELETE USING (public.ebd_user_global_access(ministry_id));

DROP POLICY IF EXISTS ebd_alunos_select ON public.ebd_alunos;
DROP POLICY IF EXISTS ebd_alunos_insert ON public.ebd_alunos;
DROP POLICY IF EXISTS ebd_alunos_update ON public.ebd_alunos;
DROP POLICY IF EXISTS ebd_alunos_delete ON public.ebd_alunos;
CREATE POLICY ebd_alunos_select ON public.ebd_alunos FOR SELECT USING (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_alunos_insert ON public.ebd_alunos FOR INSERT WITH CHECK (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_alunos_update ON public.ebd_alunos FOR UPDATE USING (public.ebd_user_local_access(ministry_id, church_id)) WITH CHECK (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_alunos_delete ON public.ebd_alunos FOR DELETE USING (public.ebd_user_global_access(ministry_id));

DROP POLICY IF EXISTS ebd_super_ministry_access ON public.ebd_superintendentes;
DROP POLICY IF EXISTS ebd_super_select ON public.ebd_superintendentes;
DROP POLICY IF EXISTS ebd_super_insert ON public.ebd_superintendentes;
DROP POLICY IF EXISTS ebd_super_update ON public.ebd_superintendentes;
DROP POLICY IF EXISTS ebd_super_delete ON public.ebd_superintendentes;
CREATE POLICY ebd_super_select ON public.ebd_superintendentes FOR SELECT USING (public.ebd_user_local_access(ministry_id, church_id));
CREATE POLICY ebd_super_insert ON public.ebd_superintendentes FOR INSERT WITH CHECK (public.ebd_user_global_access(ministry_id));
CREATE POLICY ebd_super_update ON public.ebd_superintendentes FOR UPDATE USING (public.ebd_user_global_access(ministry_id)) WITH CHECK (public.ebd_user_global_access(ministry_id));
CREATE POLICY ebd_super_delete ON public.ebd_superintendentes FOR DELETE USING (public.ebd_user_global_access(ministry_id));

DROP POLICY IF EXISTS ebd_pedidos_select ON public.ebd_pedidos_revistas;
DROP POLICY IF EXISTS ebd_pedidos_insert ON public.ebd_pedidos_revistas;
DROP POLICY IF EXISTS ebd_pedidos_update ON public.ebd_pedidos_revistas;
CREATE POLICY ebd_pedidos_select ON public.ebd_pedidos_revistas FOR SELECT USING (
  public.ebd_user_global_access(ministry_id)
  OR (church_id IS NOT NULL AND public.ebd_user_local_access(ministry_id, church_id))
);
CREATE POLICY ebd_pedidos_insert ON public.ebd_pedidos_revistas FOR INSERT WITH CHECK (
  public.ebd_user_global_access(ministry_id)
  OR (church_id IS NOT NULL AND public.ebd_user_local_access(ministry_id, church_id))
);
CREATE POLICY ebd_pedidos_update ON public.ebd_pedidos_revistas FOR UPDATE USING (
  public.ebd_user_global_access(ministry_id)
  OR (church_id IS NOT NULL AND public.ebd_user_local_access(ministry_id, church_id))
) WITH CHECK (
  public.ebd_user_global_access(ministry_id)
  OR (church_id IS NOT NULL AND public.ebd_user_local_access(ministry_id, church_id))
);

-- Tabelas com escopo indireto.
DROP POLICY IF EXISTS ebd_tp_select ON public.ebd_turma_professores;
DROP POLICY IF EXISTS ebd_tp_insert ON public.ebd_turma_professores;
DROP POLICY IF EXISTS ebd_tp_delete ON public.ebd_turma_professores;
CREATE POLICY ebd_tp_select ON public.ebd_turma_professores FOR SELECT USING (public.ebd_turma_access(turma_id));
CREATE POLICY ebd_tp_insert ON public.ebd_turma_professores FOR INSERT WITH CHECK (public.ebd_turma_access(turma_id));
CREATE POLICY ebd_tp_delete ON public.ebd_turma_professores FOR DELETE USING (public.ebd_user_global_access(ministry_id));

DROP POLICY IF EXISTS ebd_matriculas_select ON public.ebd_matriculas;
DROP POLICY IF EXISTS ebd_matriculas_insert ON public.ebd_matriculas;
DROP POLICY IF EXISTS ebd_matriculas_update ON public.ebd_matriculas;
CREATE POLICY ebd_matriculas_select ON public.ebd_matriculas FOR SELECT USING (public.ebd_matricula_access(ministry_id, aluno_id, turma_id));
CREATE POLICY ebd_matriculas_insert ON public.ebd_matriculas FOR INSERT WITH CHECK (public.ebd_matricula_access(ministry_id, aluno_id, turma_id));
CREATE POLICY ebd_matriculas_update ON public.ebd_matriculas FOR UPDATE USING (public.ebd_matricula_access(ministry_id, aluno_id, turma_id)) WITH CHECK (public.ebd_matricula_access(ministry_id, aluno_id, turma_id));

DROP POLICY IF EXISTS ebd_aulas_select ON public.ebd_aulas;
DROP POLICY IF EXISTS ebd_aulas_insert ON public.ebd_aulas;
DROP POLICY IF EXISTS ebd_aulas_update ON public.ebd_aulas;
DROP POLICY IF EXISTS ebd_aulas_delete ON public.ebd_aulas;
CREATE POLICY ebd_aulas_select ON public.ebd_aulas FOR SELECT USING (public.ebd_turma_access(turma_id));
CREATE POLICY ebd_aulas_insert ON public.ebd_aulas FOR INSERT WITH CHECK (public.ebd_turma_access(turma_id));
CREATE POLICY ebd_aulas_update ON public.ebd_aulas FOR UPDATE USING (public.ebd_turma_access(turma_id)) WITH CHECK (public.ebd_turma_access(turma_id));
CREATE POLICY ebd_aulas_delete ON public.ebd_aulas FOR DELETE USING (public.ebd_user_global_access(ministry_id));

DROP POLICY IF EXISTS ebd_freq_select ON public.ebd_frequencias;
DROP POLICY IF EXISTS ebd_freq_insert ON public.ebd_frequencias;
DROP POLICY IF EXISTS ebd_freq_update ON public.ebd_frequencias;
DROP POLICY IF EXISTS ebd_freq_delete ON public.ebd_frequencias;
CREATE POLICY ebd_freq_select ON public.ebd_frequencias FOR SELECT USING (public.ebd_aula_access(aula_id) AND public.ebd_aluno_access(aluno_id));
CREATE POLICY ebd_freq_insert ON public.ebd_frequencias FOR INSERT WITH CHECK (public.ebd_aula_access(aula_id) AND public.ebd_aluno_access(aluno_id));
CREATE POLICY ebd_freq_update ON public.ebd_frequencias FOR UPDATE USING (public.ebd_aula_access(aula_id) AND public.ebd_aluno_access(aluno_id)) WITH CHECK (public.ebd_aula_access(aula_id) AND public.ebd_aluno_access(aluno_id));
CREATE POLICY ebd_freq_delete ON public.ebd_frequencias FOR DELETE USING (public.ebd_aula_access(aula_id));

DROP POLICY IF EXISTS ebd_visit_select ON public.ebd_visitantes_aula;
DROP POLICY IF EXISTS ebd_visit_insert ON public.ebd_visitantes_aula;
DROP POLICY IF EXISTS ebd_visit_delete ON public.ebd_visitantes_aula;
CREATE POLICY ebd_visit_select ON public.ebd_visitantes_aula FOR SELECT USING (public.ebd_aula_access(aula_id));
CREATE POLICY ebd_visit_insert ON public.ebd_visitantes_aula FOR INSERT WITH CHECK (public.ebd_aula_access(aula_id));
CREATE POLICY ebd_visit_delete ON public.ebd_visitantes_aula FOR DELETE USING (public.ebd_aula_access(aula_id));

DROP POLICY IF EXISTS ebd_itens_select ON public.ebd_pedidos_itens;
DROP POLICY IF EXISTS ebd_itens_insert ON public.ebd_pedidos_itens;
DROP POLICY IF EXISTS ebd_itens_update ON public.ebd_pedidos_itens;
DROP POLICY IF EXISTS ebd_itens_delete ON public.ebd_pedidos_itens;
CREATE POLICY ebd_itens_select ON public.ebd_pedidos_itens FOR SELECT USING (public.ebd_pedido_access(pedido_id));
CREATE POLICY ebd_itens_insert ON public.ebd_pedidos_itens FOR INSERT WITH CHECK (public.ebd_pedido_access(pedido_id));
CREATE POLICY ebd_itens_update ON public.ebd_pedidos_itens FOR UPDATE USING (public.ebd_pedido_access(pedido_id)) WITH CHECK (public.ebd_pedido_access(pedido_id));
CREATE POLICY ebd_itens_delete ON public.ebd_pedidos_itens FOR DELETE USING (public.ebd_pedido_access(pedido_id));

DROP POLICY IF EXISTS ebd_ofertas_select ON public.ebd_ofertas;
DROP POLICY IF EXISTS ebd_ofertas_insert ON public.ebd_ofertas;
DROP POLICY IF EXISTS ebd_ofertas_update ON public.ebd_ofertas;
DROP POLICY IF EXISTS ebd_ofertas_delete ON public.ebd_ofertas;
CREATE POLICY ebd_ofertas_select ON public.ebd_ofertas FOR SELECT USING (public.ebd_oferta_access(ministry_id, church_id, aula_id));
CREATE POLICY ebd_ofertas_insert ON public.ebd_ofertas FOR INSERT WITH CHECK (public.ebd_oferta_access(ministry_id, church_id, aula_id));
CREATE POLICY ebd_ofertas_update ON public.ebd_ofertas FOR UPDATE USING (public.ebd_oferta_access(ministry_id, church_id, aula_id)) WITH CHECK (public.ebd_oferta_access(ministry_id, church_id, aula_id));
CREATE POLICY ebd_ofertas_delete ON public.ebd_ofertas FOR DELETE USING (public.ebd_user_global_access(ministry_id));

COMMIT;
