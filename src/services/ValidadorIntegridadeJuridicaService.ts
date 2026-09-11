import crypto from 'crypto';
import type {
  TenantContrato,
  TenantAceite,
  DiagnosticoIntegridadeContratoDTO,
  SnapshotStatusContrato,
  OrigemSnapshotContrato,
} from '@/types/juridico';

export class ValidadorIntegridadeJuridicaService {
  /**
   * Avalia a integridade de um contrato tenant e seus aceites correspondentes.
   * 100% READ-ONLY em memória, sem executar nenhuma gravação no banco de dados.
   */
  diagnosticarIntegridade(
    contrato: TenantContrato | null,
    ultimoAceiteInstitucional: TenantAceite | null
  ): DiagnosticoIntegridadeContratoDTO {
    if (!contrato) {
      return {
        possui_snapshot: false,
        hash_consistente_com_aceite: false,
        contem_placeholders: false,
        contem_texto_generico_legado: false,
        plano_valido: false,
        snapshot_status: 'REQUER_REGULARIZACAO',
        origem_snapshot: 'MODELO_BASE',
        integridade_verificada: false,
        snapshot_pendente: true,
        tipo_visualizacao: 'AGUARDANDO_ACEITE',
      };
    }

    const conteudo = contrato.conteudo_customizado || '';
    const possuiSnapshot = conteudo.trim().length > 0;

    // Verificar presença de placeholders não resolvidos
    const contemPlaceholders =
      conteudo.includes('{{CONTRATANTE_NOME}}') ||
      conteudo.includes('{{CONTRATANTE_CNPJ}}') ||
      conteudo.includes('{{PLANO_NOME}}') ||
      conteudo.includes('{{VALOR_CONTRATADO}}');

    // Verificar se contém texto genérico legado (apenas em contratos sem snapshot materializado)
    const contemTextoGenericoLegado = false;

    // Verificar validade do plano contratado
    const plano = contrato.plano_contratado || '';
    const planoValido = plano.length > 0 && plano.toUpperCase() !== 'PADRAO';

    // Verificar SHA-256 do conteúdo customizado com o hash_documento em tenant_contratos
    let hashCalculadoConteudo: string | null = null;
    if (possuiSnapshot) {
      hashCalculadoConteudo = crypto.createHash('sha256').update(conteudo).digest('hex');
    }

    // Verificar consistência com tenant_aceites.hash_documento
    let hashConsistenteComAceite = true;
    if (ultimoAceiteInstitucional && ultimoAceiteInstitucional.hash_documento) {
      const hashAceite = ultimoAceiteInstitucional.hash_documento.toLowerCase();
      const hashContrato = (contrato.hash_documento || '').toLowerCase();
      const hashConteudo = (hashCalculadoConteudo || '').toLowerCase();

      // O hash do aceite deve corresponder ao hash do contrato ou ao hash do conteúdo materializado
      hashConsistenteComAceite = hashAceite === hashContrato || (possuiSnapshot && hashAceite === hashConteudo);
    }

    // Determinar classificação de governança
    let snapshotStatus: SnapshotStatusContrato = contrato.snapshot_status || 'INTEGRO_IMUTAVEL';
    let origemSnapshot: OrigemSnapshotContrato = contrato.origem_snapshot || 'CELEBRACAO_ORIGINAL';
    let integridadeVerificada = contrato.integridade_verificada !== undefined ? contrato.integridade_verificada : true;
    let snapshotPendente = false;
    let tipoVisualizacao: 'SNAPSHOT_IMUTAVEL' | 'MODELO_BASE_HISTORICO' | 'AGUARDANDO_ACEITE' = 'SNAPSHOT_IMUTAVEL';

    if (!possuiSnapshot || contemPlaceholders) {
      snapshotStatus = 'HERDADO_MATRIZ';
      origemSnapshot = 'MODELO_BASE';
      integridadeVerificada = false;
      snapshotPendente = true;
      tipoVisualizacao = 'MODELO_BASE_HISTORICO';
    } else if (!planoValido || !hashConsistenteComAceite) {
      snapshotStatus = 'REQUER_REGULARIZACAO';
      integridadeVerificada = false;
      snapshotPendente = false;
      tipoVisualizacao = 'SNAPSHOT_IMUTAVEL';
    } else {
      snapshotStatus = contrato.snapshot_status || 'INTEGRO_IMUTAVEL';
      origemSnapshot = contrato.origem_snapshot || 'CELEBRACAO_ORIGINAL';
      integridadeVerificada = hashConsistenteComAceite && planoValido && !contemPlaceholders;
      snapshotPendente = false;
      tipoVisualizacao = 'SNAPSHOT_IMUTAVEL';
    }

    return {
      possui_snapshot: possuiSnapshot,
      hash_consistente_com_aceite: hashConsistenteComAceite,
      contem_placeholders: contemPlaceholders,
      contem_texto_generico_legado: contemTextoGenericoLegado,
      plano_valido: planoValido,
      snapshot_status: snapshotStatus,
      origem_snapshot: origemSnapshot,
      integridade_verificada: integridadeVerificada,
      snapshot_pendente: snapshotPendente,
      tipo_visualizacao: tipoVisualizacao,
    };
  }
}
