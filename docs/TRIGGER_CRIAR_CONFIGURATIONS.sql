-- ============================================
-- CRIAR TRIGGER PARA INICIALIZAR CONFIGURATIONS
-- ============================================
-- 
-- Quando um novo ministry é criado, cria automaticamente
-- uma row em configurations com nomenclaturas padrão
--
-- ============================================

-- Função que cria a row de configurações
CREATE OR REPLACE FUNCTION create_configuration_on_ministry_create()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.configurations (
    ministry_id,
    nomenclaturas,
    notification_settings,
    report_settings,
    custom_fields,
    church_profile
  )
  VALUES (
    NEW.id,
    '{
      "divisoes_organizacionais": {
        "schemaVersion": 3,
        "divisaoPrincipal": {"opcao1": "IGREJA", "custom": []},
        "divisaoSecundaria": {"opcao1": "CAMPO", "custom": []},
        "divisaoTerciaria": {"opcao1": "NENHUMA", "custom": []}
      }
    }'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  )
  ON CONFLICT (ministry_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger
DROP TRIGGER IF EXISTS trg_create_configuration_on_ministry_insert ON public.ministries;
CREATE TRIGGER trg_create_configuration_on_ministry_insert
  AFTER INSERT ON public.ministries
  FOR EACH ROW
  EXECUTE FUNCTION create_configuration_on_ministry_create();

-- ============================================
-- RESULTADO
-- ============================================
-- Agora sempre que um novo ministry é criado,
-- a tabela configurations é automaticamente preenchida
-- com nomenclaturas padrão já prontas para editar.
--
-- ============================================
