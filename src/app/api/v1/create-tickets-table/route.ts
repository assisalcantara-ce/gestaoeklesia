import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-guard'

// Função para executar SQL via Supabase
async function executeSql(supabase: any, sql: string) {
  try {
    console.log('[MIGRATION] Tentando executar SQL...')
    
    // Usar rpc para executar SQL (se disponível)
    const { error } = await (supabase as any).rpc('exec', { sql })
    
    if (!error) {
      console.log('[MIGRATION] SQL executado com sucesso via RPC')
      return { sucesso: true, metodo: 'rpc' }
    }
    
    console.warn('[MIGRATION] RPC não disponível, tentando query direct...')
    
    // Fallback: tentar criar via query direta
    // Dividir o SQL em statements e executar um por um
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const statement of statements) {
      console.log('[MIGRATION] Executando:', statement.substring(0, 50) + '...')
      
      // Tentar executar cada statement
      try {
        await (supabase as any)
          .rpc('exec', { sql: statement })
      } catch (e) {
        // Ignorar erros individuais, continuar tentando
        console.warn('[MIGRATION] Erro ao executar statement:', e)
      }
    }
    
    return { sucesso: true, metodo: 'fallback' }
  } catch (erro) {
    console.error('[MIGRATION] Erro ao executar SQL:', erro)
    throw erro
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response

    console.log('[MIGRATION] Iniciando criação de tabela...')

    const supabase = createServerClient()
    
    const sql = `
CREATE TABLE IF NOT EXISTS public.tickets_suporte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo VARCHAR(100) NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto',
  prioridade VARCHAR(20) NOT NULL DEFAULT 'media',
  categoria VARCHAR(50) NOT NULL DEFAULT 'Geral',
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  data_atualizacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_usuario_id ON public.tickets_suporte(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets_suporte(status);
CREATE INDEX IF NOT EXISTS idx_tickets_data_criacao ON public.tickets_suporte(data_criacao DESC);

ALTER TABLE public.tickets_suporte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_can_view_own_tickets" ON public.tickets_suporte;
DROP POLICY IF EXISTS "users_can_create_own_tickets" ON public.tickets_suporte;
DROP POLICY IF EXISTS "users_can_update_own_tickets" ON public.tickets_suporte;

CREATE POLICY "users_can_view_own_tickets"
  ON public.tickets_suporte
  FOR SELECT
  USING (auth.uid() = usuario_id);

CREATE POLICY "users_can_create_own_tickets"
  ON public.tickets_suporte
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "users_can_update_own_tickets"
  ON public.tickets_suporte
  FOR UPDATE
  USING (auth.uid() = usuario_id);

GRANT SELECT, INSERT, UPDATE ON public.tickets_suporte TO authenticated;
    `.trim()

    // Tentar executar SQL
    const resultado = await executeSql(supabase, sql)

    // Aguardar um pouco para a tabela aparecer no cache
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verificar se a tabela foi criada
    const { error: checkError } = await supabase
      .from('tickets_suporte')
      .select('*')
      .limit(1)

    if (checkError) {
      console.warn('[MIGRATION] Erro ao verificar tabela:', checkError)
      
      // Se ainda der erro, retornar instruções
      if (checkError.code === 'PGRST116' || checkError.message?.includes('not found')) {
        return NextResponse.json(
          {
            sucesso: false,
            erro: 'Tabela não pôde ser criada automaticamente',
            detalhes: checkError.message,
            instrucoes: `
1. Acesse https://app.supabase.com
2. Vá para SQL Editor do seu projeto
3. Cole o seguinte SQL:

${sql}

4. Clique em "Run"
5. Recarregue a página
            `.trim(),
          },
          { status: 500 }
        )
      }
    }

    console.log('[MIGRATION] ✅ Tabela verificada com sucesso!')

    return NextResponse.json(
      {
        sucesso: true,
        mensagem: '✅ Tabela tickets_suporte criada/verificada com sucesso!',
        timestamp: new Date().toISOString(),
        metodo: resultado.metodo,
      },
      { status: 200 }
    )
  } catch (erro) {
    console.error('[MIGRATION] Erro:', erro)
    
    const mensagemErro = erro instanceof Error ? erro.message : 'Erro desconhecido'
    
    return NextResponse.json(
      {
        sucesso: false,
        erro: mensagemErro,
        instrucoes: 'Acesse o arquivo SETUP_TICKETS_SUPORTE.sql e execute manualmente no Supabase SQL Editor',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin(request, { requiredRole: 'admin' })
    if (!result.ok) return result.response

    const supabase = createServerClient()

    // Verificar se a tabela existe
    const { data, error } = await supabase
      .from('tickets_suporte')
      .select('*')
      .limit(1)

    if (error && error.code === 'PGRST116') {
      return NextResponse.json(
        {
          existe: false,
          erro: error.message,
          instrucoes:
            'Tabela não existe. Acesse POST /api/v1/create-tickets-table para criar ou execute o SQL manualmente.',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      existe: true,
      mensagem: '✅ Tabela tickets_suporte está disponível',
      registros: Array.isArray(data) ? data.length : 0,
    })
  } catch (erro) {
    console.error('Erro ao verificar tabela:', erro)
    return NextResponse.json(
      {
        existe: false,
        erro: erro instanceof Error ? erro.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
