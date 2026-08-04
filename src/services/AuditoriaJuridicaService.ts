import { createClient } from '@/lib/supabase-client';
import type { RegistrarEventoAuditoriaJuridicaDTO } from '@/types/juridico';

export class AuditoriaJuridicaService {
  private customClient?: any;

  constructor(customClient?: any) {
    this.customClient = customClient;
  }

  private get client() {
    return this.customClient || createClient();
  }

  async registrarEvento(dto: RegistrarEventoAuditoriaJuridicaDTO): Promise<void> {
    if (!dto.usuario_id || dto.usuario_id.trim().length === 0) {
      throw new Error('O ID do usuário é obrigatório para registrar auditoria jurídica.');
    }
    if (!dto.ministry_id || dto.ministry_id.trim().length === 0) {
      throw new Error('O ID do ministério (ministry_id) é obrigatório para registrar auditoria jurídica.');
    }
    if (!dto.documento_id || dto.documento_id.trim().length === 0) {
      throw new Error('O ID do documento é obrigatório para registrar auditoria jurídica.');
    }
    if (!dto.versao || dto.versao.trim().length === 0) {
      throw new Error('A versão do documento é obrigatória para registrar auditoria jurídica.');
    }
    if (!dto.hash_documento || dto.hash_documento.trim().length === 0) {
      throw new Error('O hash do documento é obrigatório para registrar auditoria jurídica.');
    }
    if (!dto.tipo_evento) {
      throw new Error('O tipo do evento é obrigatório para registrar auditoria jurídica.');
    }

    const payload = {
      usuario_id: dto.usuario_id.trim(),
      ministry_id: dto.ministry_id.trim(),
      tabela_afetada: 'documentos_juridicos',
      registro_id: dto.documento_id.trim(),
      modulo: 'JURIDICO',
      acao: dto.tipo_evento,
      detalhes: {
        versao: dto.versao.trim(),
        hash_documento: dto.hash_documento.trim(),
        ip_address: dto.ip_address || null,
        user_agent: dto.user_agent || null,
        ...(dto.detalhes || {}),
      },
      data_criacao: new Date().toISOString(),
    };

    try {
      // 1. Grava no barramento padrão de audit_logs da plataforma
      const { error: auditErr } = await this.client
        .from('audit_logs')
        .insert([payload]);

      if (auditErr) {
        console.warn('[AuditoriaJuridicaService] Falha ao gravar em audit_logs:', auditErr.message);
      }
    } catch (err: any) {
      console.warn('[AuditoriaJuridicaService] Exceção capturada ao gravar audit_logs:', err?.message || err);
    }
  }
}
