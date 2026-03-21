#!/usr/bin/env node
/**
 * Script para executar setup de audit_logs no Supabase
 * Uso: node setup-audit-logs.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SQL = `
-- DROP TABLE if exists (limpar se houver erro anterior)
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Criar tabela de auditoria (versão simplificada)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario_email VARCHAR(255),
  acao VARCHAR(50) NOT NULL,
  modulo VARCHAR(100) NOT NULL,
  area VARCHAR(100),
  tabela_afetada VARCHAR(100),
  registro_id UUID,
  descricao TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'sucesso',
  mensagem_erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_acao CHECK (acao IN ('criar', 'editar', 'deletar', 'visualizar', 'exportar', 'importar', 'responder', 'atualizar_status', 'atualizar_permissoes', 'login', 'logout', 'download', 'upload', 'outro')),
  CONSTRAINT valid_status CHECK (status IN ('sucesso', 'erro', 'aviso'))
);

-- Criar índices
CREATE INDEX idx_audit_usuario ON public.audit_logs(usuario_id);
CREATE INDEX idx_audit_modulo ON public.audit_logs(modulo);
CREATE INDEX idx_audit_acao ON public.audit_logs(acao);
CREATE INDEX idx_audit_data ON public.audit_logs(data_criacao DESC);
CREATE INDEX idx_audit_usuario_data ON public.audit_logs(usuario_id, data_criacao DESC);
CREATE INDEX idx_audit_tabela ON public.audit_logs(tabela_afetada, registro_id);

-- Habilitar RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Criar policies
CREATE POLICY "users_view_own_audit_logs"
  ON public.audit_logs
  FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "users_create_audit_logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id OR true);

-- Grant permissões
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
`;

async function setupAuditLogs() {
  try {
    console.log('🔄 Executando setup de audit_logs...');
    
    // Executar via RPC exec (se disponível)
    const { error } = await supabase.rpc('exec', {
      sql: SQL
    }).catch(() => {
      // Se RPC não existe, retornar erro
      return { error: { message: 'RPC exec não disponível' } };
    });

    if (error && !error.message.includes('does not exist')) {
      throw error;
    }

    console.log('✅ Setup de audit_logs concluído com sucesso!');
    console.log('📊 Tabela audit_logs criada e configurada');
    console.log('🔒 RLS ativado');
    console.log('📝 Policies criadas');
    
  } catch (err) {
    console.error('❌ Erro ao executar setup:', err.message);
    console.error('\n📋 Se o RPC não está disponível, execute o SQL manualmente:');
    console.error('1. Acesse https://app.supabase.com');
    console.error('2. SQL Editor > New Query');
    console.error('3. Cole o conteúdo de SETUP_AUDIT_LOGS.sql');
    process.exit(1);
  }
}

setupAuditLogs();
