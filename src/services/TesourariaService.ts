/**
 * TesourariaService
 * Camada de negócio da Tesouraria para operações de lançamentos financeiros.
 */

import { TesourariaRepository, type LancamentoInsert, type LancamentoRow } from '@/repositories/TesourariaRepository';

export interface CriarLancamentoDTO {
  data_lancamento: string;
  tipo_movimento: 'entrada' | 'saida';
  tipo_recebimento: string;
  valor: number;
  referencia?: string | null;
  observacoes?: string | null;
  descricao?: string | null;
  congregacao_id?: string | null;
  departamento_id?: string | null;
  conta_id?: string | null;
  categoria_id?: string | null;
  member_id?: string | null;
}

export class TesourariaService {
  private repository: TesourariaRepository;

  constructor(supabase: any) {
    this.repository = new TesourariaRepository(supabase);
  }

  async criarLancamento(
    ministryId: string,
    dto: CriarLancamentoDTO
  ): Promise<LancamentoRow> {
    // ── Validações de negócio ──────────────────────────────────────────────

    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ministry_id é obrigatório.');
    }

    if (!dto.data_lancamento || !/^\d{4}-\d{2}-\d{2}$/.test(dto.data_lancamento)) {
      throw new Error('data_lancamento inválida. Use o formato YYYY-MM-DD.');
    }

    if (dto.tipo_movimento !== 'entrada' && dto.tipo_movimento !== 'saida') {
      throw new Error('tipo_movimento deve ser "entrada" ou "saida".');
    }

    if (!dto.tipo_recebimento || dto.tipo_recebimento.trim().length === 0) {
      throw new Error('tipo_recebimento é obrigatório.');
    }

    if (typeof dto.valor !== 'number' || isNaN(dto.valor) || dto.valor <= 0) {
      throw new Error('O valor deve ser um número positivo maior que zero.');
    }

    // ── Montar payload para inserção ───────────────────────────────────────

    const payload: LancamentoInsert = {
      ministry_id: ministryId,
      data_lancamento: dto.data_lancamento,
      tipo_movimento: dto.tipo_movimento,
      tipo_recebimento: dto.tipo_recebimento.trim(),
      valor: dto.valor,
      referencia: dto.referencia ?? null,
      observacoes: dto.observacoes ?? null,
      descricao: dto.descricao ?? null,
      congregacao_id: dto.congregacao_id ?? null,
      departamento_id: dto.departamento_id ?? null,
      conta_id: dto.conta_id ?? null,
      categoria_id: dto.categoria_id ?? null,
      member_id: dto.member_id ?? null,
    };

    return this.repository.criarLancamento(payload);
  }

  async atualizarLancamento(
    id: string,
    ministryId: string,
    dto: Partial<CriarLancamentoDTO>
  ): Promise<LancamentoRow> {
    if (!id || id.trim().length === 0) {
      throw new Error('O ID do lançamento é obrigatório para atualização.');
    }

    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ministry_id é obrigatório.');
    }

    if (dto.data_lancamento && !/^\d{4}-\d{2}-\d{2}$/.test(dto.data_lancamento)) {
      throw new Error('data_lancamento inválida. Use o formato YYYY-MM-DD.');
    }

    if (dto.tipo_movimento && dto.tipo_movimento !== 'entrada' && dto.tipo_movimento !== 'saida') {
      throw new Error('tipo_movimento deve ser "entrada" ou "saida".');
    }

    if (dto.valor !== undefined && (typeof dto.valor !== 'number' || isNaN(dto.valor) || dto.valor <= 0)) {
      throw new Error('O valor deve ser um número positivo maior que zero.');
    }

    const payload: Partial<LancamentoInsert> = {};
    if (dto.data_lancamento) payload.data_lancamento = dto.data_lancamento;
    if (dto.tipo_movimento) payload.tipo_movimento = dto.tipo_movimento;
    if (dto.tipo_recebimento) payload.tipo_recebimento = dto.tipo_recebimento.trim();
    if (dto.valor !== undefined) payload.valor = dto.valor;
    if (dto.referencia !== undefined) payload.referencia = dto.referencia;
    if (dto.observacoes !== undefined) payload.observacoes = dto.observacoes;
    if (dto.descricao !== undefined) payload.descricao = dto.descricao;
    if (dto.congregacao_id !== undefined) payload.congregacao_id = dto.congregacao_id;
    if (dto.departamento_id !== undefined) payload.departamento_id = dto.departamento_id;
    if (dto.conta_id !== undefined) payload.conta_id = dto.conta_id;
    if (dto.categoria_id !== undefined) payload.categoria_id = dto.categoria_id;
    if (dto.member_id !== undefined) payload.member_id = dto.member_id;

    return this.repository.atualizarLancamento(id, ministryId, payload);
  }

  async deletarLancamento(id: string, ministryId: string): Promise<boolean> {
    if (!id || id.trim().length === 0) {
      throw new Error('O ID do lançamento é obrigatório para exclusão.');
    }

    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ministry_id é obrigatório.');
    }

    return this.repository.deletarLancamento(id, ministryId);
  }
}
