import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-guard'

const SQL_CREATE_AUDIT_TABLE = `
-- Criar tabela de auditoria (versão simplificada)
CREATE TABLE IF NOT EXISTS public.audit_logs (
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
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_acao CHECK (acao IN ('criar', 'editar', 'deletar', 'visualizar', 'exportar', 'importar', 'responder', 'atualizar_status', 'atualizar_permissoes', 'login', 'logout', 'download', 'upload', 'outro')),
  CONSTRAINT valid_status CHECK (status IN ('sucesso', 'erro', 'aviso'))
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON public.audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_modulo ON public.audit_logs(modulo);
CREATE INDEX IF NOT EXISTS idx_audit_acao ON public.audit_logs(acao);
CREATE INDEX IF NOT EXISTS idx_audit_data ON public.audit_logs(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_audit_usuario_data ON public.audit_logs(usuario_id, data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_audit_tabela ON public.audit_logs(tabela_afetada, registro_id);

-- RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas se existirem
DROP POLICY IF EXISTS "users_view_own_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "users_create_audit_logs" ON public.audit_logs;

-- Políticas
CREATE POLICY "users_view_own_audit_logs"
  ON public.audit_logs
  FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "users_create_audit_logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- Permissões
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
`

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response

    const supabase = createServerClient()

    // Executar SQL para criar tabela
    const { error } = await supabase.rpc('exec', {
      sql: SQL_CREATE_AUDIT_TABLE,
    })

    if (error && !error.message?.includes('already exists')) {
      // Tentar via query direto
      const { error: queryError } = await supabase
        .from('audit_logs')
        .select('count')
        .limit(1)

      if (queryError && queryError.code === 'PGRST116') {
        // Tabela realmente não existe, vamos tentar criar
        console.error('Tabela não pode ser criada via RPC, necessário SQL direto')
        return NextResponse.json(
          {
            error:
              'Tabela de auditoria ainda não existe. Execute o SQL manualmente.',
            sql: SQL_CREATE_AUDIT_TABLE,
          },
          { status: 409 },
        )
      }
    }

    // Esperar um pouco para propagação
    await new Promise(resolve => setTimeout(resolve, 2000))

    return NextResponse.json({
      success: true,
      message: 'Tabela de auditoria criada com sucesso',
    })
  } catch (error) {
    console.error('Erro ao criar tabela de auditoria:', error)
    return NextResponse.json(
      {
        error: 'Erro ao criar tabela',
        details: String(error),
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response

    const supabase = createServerClient()

    // Verificar se tabela existe
    const { error } = await supabase
      .from('audit_logs')
      .select('count')
      .limit(1)

    if (error && error.code === 'PGRST116') {
      return NextResponse.json({ exists: false })
    }

    return NextResponse.json({ exists: true })
  } catch (error) {
    console.error('Erro ao verificar auditoria:', error)
    return NextResponse.json({ exists: false })
  }
}
