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
  codigo_registro?: string | null;
  permitir_duplicidade?: boolean;
}

export class TesourariaService {
  private repository: TesourariaRepository;

  constructor(supabase: any) {
    this.repository = new TesourariaRepository(supabase);
  }

  async obterProximoCodigo(ministryId: string, dataLancamento?: string): Promise<string> {
    if (!ministryId || !ministryId.trim()) {
      throw new Error('O ministry_id é obrigatório.');
    }
    const ano = dataLancamento ? parseInt(dataLancamento.split('-')[0], 10) : new Date().getFullYear();
    const anoValido = !isNaN(ano) && ano > 2000 ? ano : new Date().getFullYear();
    return this.repository.obterPreviaCodigoRegistro(ministryId, anoValido);
  }

  async verificarCodigoExiste(ministryId: string, codigo: string, excludeId?: string): Promise<boolean> {
    if (!ministryId || !codigo) return false;
    return this.repository.verificarCodigoExiste(ministryId, codigo, excludeId);
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

    const ano = parseInt(dto.data_lancamento.split('-')[0], 10) || new Date().getFullYear();
    const temCodigoInformado = Boolean(dto.codigo_registro && dto.codigo_registro.trim().length > 0);
    const isManual = Boolean(
      temCodigoInformado &&
      !/^REG-\d{4}-\d+$/i.test(dto.codigo_registro!.trim())
    );

    // Helper para montar payload
    const montarPayload = (codigo: string | null): LancamentoInsert => ({
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
      codigo_registro: codigo,
    });

    // ── Caso 1: Usuário confirmou/permitiu salvar com código duplicado ──────────
    if (dto.permitir_duplicidade && temCodigoInformado) {
      const codigoForcado = dto.codigo_registro!.trim();
      return this.repository.criarLancamento(montarPayload(codigoForcado));
    }

    // ── Caso 2: Código Manual Customizado (ex: OFERTA-2026-001, NF-4587/2026) ──
    if (isManual) {
      const codigoManual = dto.codigo_registro!.trim();
      const jaExiste = await this.repository.verificarCodigoExiste(ministryId, codigoManual);
      if (jaExiste) {
        throw new Error('Já existe um lançamento registrado com este Código/ID.');
      }
      return this.repository.criarLancamento(montarPayload(codigoManual));
    }

    // ── Caso 3: Código informado pelo usuário no formato REG-YYYY-XXXXXX que já existe ──
    if (temCodigoInformado) {
      const codigoInformado = dto.codigo_registro!.trim();
      const jaExiste = await this.repository.verificarCodigoExiste(ministryId, codigoInformado);
      if (jaExiste) {
        throw new Error('Já existe um lançamento registrado com este Código/ID.');
      }
    }

    // ── Caso 4: Código Automático (REG-YYYY-XXXXXX) ou omitido ───────────────
    // Se o operador não informou código ou enviou um padrão automático (que pode ter sofrido concorrência)
    // Aloca atômica e definitivamente no banco com lock
    const maxTentativas = 5;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      try {
        const codigoAlocado = await this.repository.alocarProximoCodigoRegistro(ministryId, ano);
        return await this.repository.criarLancamento(montarPayload(codigoAlocado));
      } catch (err: any) {
        const isCollision = err?.message?.includes('Já existe um lançamento registrado com este Código/ID') ||
                            err?.message?.includes('23505') ||
                            err?.message?.includes('idx_tesouraria_lancamentos_codigo_registro');
        if (isCollision && tentativa < maxTentativas) {
          // Em caso de colisão concorrente rara, tenta novamente para obter o próximo número da sequência
          continue;
        }
        throw err;
      }
    }

    throw new Error('Não foi possível gerar um código de registro único para o lançamento.');
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

    if (dto.codigo_registro !== undefined) {
      if (dto.codigo_registro && dto.codigo_registro.trim().length > 0) {
        const codigoTrim = dto.codigo_registro.trim();
        if (!dto.permitir_duplicidade) {
          const jaExiste = await this.repository.verificarCodigoExiste(ministryId, codigoTrim, id);
          if (jaExiste) {
            throw new Error('Já existe um lançamento registrado com este Código/ID.');
          }
        }
        payload.codigo_registro = codigoTrim;
      } else {
        payload.codigo_registro = null;
      }
    }

    return this.repository.atualizarLancamento(id, ministryId, payload);
  }

  async deletarLancamento(id: string, ministryId: string, userId?: string | null): Promise<boolean> {
    if (!id || id.trim().length === 0) {
      throw new Error('O ID do lançamento é obrigatório para exclusão.');
    }

    if (!ministryId || ministryId.trim().length === 0) {
      throw new Error('O ministry_id é obrigatório.');
    }

    return this.repository.deletarLancamento(id, ministryId, userId);
  }
}
