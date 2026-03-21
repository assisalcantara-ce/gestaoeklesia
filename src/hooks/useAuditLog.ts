import { useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

export type AcaoTipo = 'criar' | 'editar' | 'deletar' | 'visualizar' | 'exportar' | 'importar' | 'responder' | 'login' | 'logout' | 'atualizar_status' | 'atualizar_permissoes' | 'download' | 'upload' | 'outro'

export type StatusAuditoria = 'sucesso' | 'erro' | 'aviso'

interface RegistrarAcaoParams {
  acao: AcaoTipo
  modulo: string
  area?: string
  tabela_afetada?: string
  registro_id?: string
  descricao?: string
  dados_anteriores?: Record<string, any>
  dados_novos?: Record<string, any>
  status?: StatusAuditoria
  mensagem_erro?: string
}

export function useAuditLog() {
  const supabase = createClient()

  const registrarAcao = useCallback(
    async (params: RegistrarAcaoParams) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          console.warn('Usuário não autenticado, não pode registrar auditoria')
          return
        }

        // Obter IP (será obtido via API quando necessário)
        // Por enquanto, registramos via API que tem acesso ao IP real

        const dados = {
          acao: params.acao,
          modulo: params.modulo,
          area: params.area || null,
          tabela_afetada: params.tabela_afetada || null,
          registro_id: params.registro_id || null,
          descricao: params.descricao || null,
          dados_anteriores: params.dados_anteriores || null,
          dados_novos: params.dados_novos || null,
          usuario_email: user.email,
          status: params.status || 'sucesso',
          mensagem_erro: params.mensagem_erro || null,
        }

        // Registrar via API (que terá acesso ao IP e user-agent)
        const response = await fetch('/api/v1/audit-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dados),
        })

        if (!response.ok) {
          console.error('Erro ao registrar auditoria:', await response.text())
        }
      } catch (error) {
        console.error('Erro ao registrar ação de auditoria:', error)
        // Não interrompe a execução normal se falhar
      }
    },
    [supabase],
  )

  return { registrarAcao }
}
