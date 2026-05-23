-- Migration: 20260522090000_fix_members_tipo_cadastro_default
-- Descrição: Corrige o DEFAULT de members.tipo_cadastro de 'ministro' para 'membro'.
--
-- Problema: O DEFAULT 'ministro' classificava erroneamente registros inseridos fora
--           do formulário (importações, scripts, APIs externas) como ministros.
--
-- Impacto:  Afeta APENAS novos registros inseridos sem valor explícito para tipo_cadastro.
--           Registros existentes NÃO são alterados.
--
-- Valor anterior : 'ministro'
-- Valor novo     : 'membro'

ALTER TABLE public.members
  ALTER COLUMN tipo_cadastro SET DEFAULT 'membro';
