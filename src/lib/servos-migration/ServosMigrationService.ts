import { SupabaseClient } from '@supabase/supabase-js';
import {
  TARGET_IEADMIM_MINISTRY_ID,
  ServosRawMember,
  ServosRowValidation,
  ServosPreviewReport,
  generateServosUniqueId,
  parseDateSafe,
  parseBoolSafe,
} from './types';
import { normalizeMemberStatus } from '../member-status';

const STORAGE_BUCKET = 'member-photos';

export class ServosMigrationService {
  constructor(
    private supabaseAdmin: SupabaseClient,
    private targetMinistryId: string
  ) {}

  public validateTargetMinistry(): void {
    if (this.targetMinistryId !== TARGET_IEADMIM_MINISTRY_ID) {
      throw new Error(
        `Operação restrita: esta rotina de migração do Gestão Servos é autorizada exclusivamente para o tenant IEADMIM (${TARGET_IEADMIM_MINISTRY_ID}). Tenant informado: ${this.targetMinistryId}`
      );
    }
  }

  /**
   * Executa a prévia (DRY-RUN) sem nenhuma alteração no banco de dados.
   */
  public async dryRun(rawMembers: ServosRawMember[]): Promise<ServosPreviewReport> {
    this.validateTargetMinistry();

    // 1. Carregar CPFs existentes do tenant destino
    const { data: existingMembers, error: fetchErr } = await this.supabaseAdmin
      .from('members')
      .select('id, cpf, matricula, unique_id, custom_fields')
      .eq('ministry_id', this.targetMinistryId);

    if (fetchErr) {
      throw new Error(`Erro ao consultar membros existentes do tenant: ${fetchErr.message}`);
    }

    const existingCpfs = new Set<string>();
    const existingMatriculas = new Set<string>();
    const existingServosIds = new Set<string>();

    (existingMembers || []).forEach((m: any) => {
      const cpfClean = (m.cpf || '').replace(/\D/g, '');
      if (cpfClean) existingCpfs.add(cpfClean);
      if (m.matricula) existingMatriculas.add(String(m.matricula).trim());
      const origemId = m.custom_fields?.origem_servos_id;
      if (origemId) existingServosIds.add(String(origemId).trim());
    });

    // 2. Mapear repetições dentro do próprio arquivo CSV
    const cpfCountsInFile = new Map<string, number[]>();
    const matriculaCountsInFile = new Map<string, number[]>();

    rawMembers.forEach((rm, idx) => {
      const lineNum = idx + 2; // cabeçalho = linha 1
      const cpfClean = (rm.cpf || '').replace(/\D/g, '');
      if (cpfClean) {
        if (!cpfCountsInFile.has(cpfClean)) cpfCountsInFile.set(cpfClean, []);
        cpfCountsInFile.get(cpfClean)!.push(lineNum);
      }

      const mat = (rm.matricula || '').trim();
      if (mat) {
        if (!matriculaCountsInFile.has(mat)) matriculaCountsInFile.set(mat, []);
        matriculaCountsInFile.get(mat)!.push(lineNum);
      }
    });

    const matriculasDuplicadasLegado: { matricula: string; linhas: number[] }[] = [];
    matriculaCountsInFile.forEach((linhas, matricula) => {
      if (linhas.length > 1) {
        matriculasDuplicadasLegado.push({ matricula, linhas });
      }
    });

    // 3. Processar cada linha individualmente para o relatório
    let totalCpfsAusentes = 0;
    let totalCpfsDuplicadosArquivo = 0;
    let totalCpfsExistentesBanco = 0;
    let totalMatriculasExistentesBanco = 0;
    let totalRegistrosJaImportados = 0;
    let totalFotosBase64 = 0;
    let totalUniqueIdsGerados = 0;
    let aptasParaInsercao = 0;

    const validations: ServosRowValidation[] = [];

    for (let i = 0; i < rawMembers.length; i++) {
      const rm = rawMembers[i];
      const lineNum = i + 2;
      const origemId = (rm.id || '').trim();
      const name = (rm.name || '').trim();
      const cpfClean = (rm.cpf || '').replace(/\D/g, '') || null;
      const mat = (rm.matricula || '').trim() || null;
      const cargo = (rm.cargo_ministerial || rm.role || 'Ministro').trim() || null;

      let uniqueId = (rm.unique_id || '').trim();
      let uniqueIdGerado = false;
      if (!uniqueId) {
        uniqueId = generateServosUniqueId();
        uniqueIdGerado = true;
        totalUniqueIdsGerados++;
      }

      const rawFoto = (rm.foto_url || '').trim();
      const hasFotoBase64 = rawFoto.startsWith('data:image');
      const fotoBytesApprox = hasFotoBase64 ? Math.round((rawFoto.length * 3) / 4) : 0;
      if (hasFotoBase64) totalFotosBase64++;

      const notes: string[] = [];
      let statusCpf: ServosRowValidation['status_cpf'] = 'valido';
      let statusMatricula: ServosRowValidation['status_matricula'] = 'unica';
      let statusOrigem: ServosRowValidation['status_origem'] = 'novo';
      let willInsert = true;

      // Validação de Origem
      if (origemId && existingServosIds.has(origemId)) {
        statusOrigem = 'ja_importado_banco';
        totalRegistrosJaImportados++;
        willInsert = false;
        notes.push('Registro já foi importado anteriormente para este tenant (origem_servos_id existente).');
      }

      // Validação de CPF
      if (!cpfClean) {
        statusCpf = 'ausente';
        totalCpfsAusentes++;
        notes.push('CPF ausente: será importado com valor NULL (permitido pelo schema).');
      } else if ((cpfCountsInFile.get(cpfClean)?.length || 0) > 1) {
        statusCpf = 'duplicado_arquivo';
        totalCpfsDuplicadosArquivo++;
        willInsert = false;
        notes.push(`CPF duplicado no arquivo nas linhas: ${cpfCountsInFile.get(cpfClean)?.join(', ')}.`);
      } else if (existingCpfs.has(cpfClean)) {
        statusCpf = 'ja_existe_banco';
        totalCpfsExistentesBanco++;
        willInsert = false;
        notes.push('CPF já cadastrado no banco deste ministério.');
      }

      // Validação de Matrícula
      if (mat) {
        if ((matriculaCountsInFile.get(mat)?.length || 0) > 1) {
          statusMatricula = 'duplicada_legado';
          notes.push(`Matrícula duplicada no legado de origem (linhas ${matriculaCountsInFile.get(mat)?.join(', ')}). Preservada sem alteração automática.`);
        }
        if (existingMatriculas.has(mat)) {
          totalMatriculasExistentesBanco++;
          notes.push('Atenção: Matrícula já existe em outro membro ativo deste tenant.');
        }
      }

      if (uniqueIdGerado) {
        notes.push('unique_id ausente na origem; gerado automaticamente novo identificador hex único.');
      }

      if (willInsert) {
        aptasParaInsercao++;
      }

      validations.push({
        index: lineNum,
        origem_id: origemId,
        name,
        cpf: cpfClean,
        matricula: mat,
        cargo,
        unique_id: uniqueId,
        unique_id_gerado: uniqueIdGerado,
        has_foto_base64: hasFotoBase64,
        foto_bytes_approx: fotoBytesApprox,
        status_cpf: statusCpf,
        status_matricula: statusMatricula,
        status_origem: statusOrigem,
        will_insert: willInsert,
        notes,
      });
    }

    return {
      target_ministry_id: this.targetMinistryId,
      is_target_matched: true,
      total_lidas: rawMembers.length,
      aptas_para_insercao: aptasParaInsercao,
      cpfs_ausentes: totalCpfsAusentes,
      cpfs_duplicados_arquivo: totalCpfsDuplicadosArquivo,
      cpfs_existentes_banco: totalCpfsExistentesBanco,
      matriculas_duplicadas_legado: matriculasDuplicadasLegado,
      matriculas_existentes_banco: totalMatriculasExistentesBanco,
      registros_ja_importados_banco: totalRegistrosJaImportados,
      fotos_base64_detectadas: totalFotosBase64,
      unique_ids_gerados: totalUniqueIdsGerados,
      preview_amostra: validations.slice(0, 50), // amostra das primeiras 50 linhas para UI
    };
  }

  /**
   * Executa a importação assistida de membros com isolamento por lote e tratamento de fotos.
   */
  public async executeImport(
    rawMembers: ServosRawMember[],
    options?: { importPhotos?: boolean }
  ): Promise<{
    total_lidas: number;
    inseridos: number;
    ignorados: number;
    fotos_enviadas: number;
    falhas_fotos: number;
    erros: { linha: number; nome: string; motivo: string }[];
  }> {
    this.validateTargetMinistry();

    // 1. Obter snapshot atual do banco para idempotência rigorosa
    const { data: existingMembers, error: fetchErr } = await this.supabaseAdmin
      .from('members')
      .select('id, cpf, matricula, custom_fields')
      .eq('ministry_id', this.targetMinistryId);

    if (fetchErr) {
      throw new Error(`Erro ao verificar banco antes de importar: ${fetchErr.message}`);
    }

    const existingCpfs = new Set<string>();
    const existingServosIds = new Set<string>();

    (existingMembers || []).forEach((m: any) => {
      const cpfClean = (m.cpf || '').replace(/\D/g, '');
      if (cpfClean) existingCpfs.add(cpfClean);
      const origemId = m.custom_fields?.origem_servos_id;
      if (origemId) existingServosIds.add(String(origemId).trim());
    });

    let inseridos = 0;
    let ignorados = 0;
    let fotosEnviadas = 0;
    let falhasFotos = 0;
    const erros: { linha: number; nome: string; motivo: string }[] = [];

    // Processar em lotes de 25 registros
    const BATCH_SIZE = 25;
    for (let i = 0; i < rawMembers.length; i += BATCH_SIZE) {
      const batch = rawMembers.slice(i, i + BATCH_SIZE);
      const recordsToInsert: Record<string, any>[] = [];
      const batchPhotos: { memberTempIndex: number; base64: string }[] = [];

      for (let j = 0; j < batch.length; j++) {
        const rm = batch[j];
        const lineNum = i + j + 2;
        const origemId = (rm.id || '').trim();
        const name = (rm.name || '').trim();

        if (!name) {
          erros.push({ linha: lineNum, nome: '(sem nome)', motivo: 'Nome obrigatório ausente' });
          continue;
        }

        // Idempotência
        if (origemId && existingServosIds.has(origemId)) {
          ignorados++;
          continue;
        }

        const cpfClean = (rm.cpf || '').replace(/\D/g, '') || null;
        if (cpfClean && existingCpfs.has(cpfClean)) {
          ignorados++;
          continue;
        }

        let uniqueId = (rm.unique_id || '').trim();
        if (!uniqueId) {
          uniqueId = generateServosUniqueId();
        }

        // Construir custom_fields enriquecido
        let customFieldsOrigem: Record<string, any> = {};
        if (typeof rm.custom_fields === 'string') {
          try {
            customFieldsOrigem = JSON.parse(rm.custom_fields);
          } catch {
            customFieldsOrigem = { raw: rm.custom_fields };
          }
        } else if (typeof rm.custom_fields === 'object' && rm.custom_fields !== null) {
          customFieldsOrigem = rm.custom_fields;
        }

        const customFieldsFinal = {
          ...customFieldsOrigem,
          origem_servos_id: origemId || null,
          migrado_em: new Date().toISOString(),
          origem_sistema: 'gestao_servos',
        };

        // Parse dados_cargos
        let dadosCargosFinal: Record<string, any> = {};
        if (typeof rm.dados_cargos === 'string') {
          try {
            dadosCargosFinal = JSON.parse(rm.dados_cargos);
          } catch {
            dadosCargosFinal = {};
          }
        } else if (typeof rm.dados_cargos === 'object' && rm.dados_cargos !== null) {
          dadosCargosFinal = rm.dados_cargos;
        }

        const rawFoto = (rm.foto_url || '').trim();
        const hasFotoBase64 = rawFoto.startsWith('data:image');

        const payload: Record<string, any> = {
          ministry_id: this.targetMinistryId,
          name,
          cpf: cpfClean,
          email: (rm.email || '').trim().toLowerCase() || null,
          phone: (rm.phone || rm.celular || rm.whatsapp || '').trim() || null,
          celular: (rm.celular || '').trim() || null,
          whatsapp: (rm.whatsapp || '').trim() || null,
          matricula: (rm.matricula || '').trim() || null,
          unique_id: uniqueId,
          tipo_cadastro: 'ministro',
          status: normalizeMemberStatus(rm.status, true) || 'active',
          role: (rm.role || 'ministro').toLowerCase(),
          is_dizimista: true, // Ministros são automaticamente dizimistas
          pastor_auxiliar: parseBoolSafe(rm.pastor_auxiliar),
          tem_funcao_igreja: parseBoolSafe(rm.tem_funcao_igreja),
          qual_funcao: (rm.qual_funcao || '').trim() || null,
          cargo_ministerial: (rm.cargo_ministerial || 'Pastor').trim() || null,
          setor_departamento: (rm.setor_departamento || '').trim() || null,
          observacoes_ministeriais: (rm.observacoes_ministeriais || '').trim() || null,
          observacoes: (rm.observacoes || '').trim() || null,
          curso_teologico: (rm.curso_teologico || '').trim() || null,
          instituicao_teologica: (rm.instituicao_teologica || '').trim() || null,
          procedencia: (rm.procedencia || '').trim() || null,
          procedencia_local: (rm.procedencia_local || '').trim() || null,
          rg: (rm.rg || '').trim() || null,
          orgao_emissor: (rm.orgao_emissor || '').trim() || null,
          nacionalidade: (rm.nacionalidade || 'BRASILEIRO').trim() || null,
          naturalidade: (rm.naturalidade || '').trim() || null,
          uf_naturalidade: (rm.uf_naturalidade || '').trim() || null,
          sexo: (rm.sexo || '').trim().toUpperCase() || null,
          estado_civil: (rm.estado_civil || '').trim().toUpperCase() || null,
          profissao: (rm.profissao || '').trim() || null,
          tipo_sanguineo: (rm.tipo_sanguineo || '').trim() || null,
          escolaridade: (rm.escolaridade || '').trim() || null,
          nome_pai: (rm.nome_pai || '').trim() || null,
          nome_mae: (rm.nome_mae || '').trim() || null,
          nome_conjuge: (rm.nome_conjuge || '').trim() || null,
          cpf_conjuge: (rm.cpf_conjuge || '').replace(/\D/g, '') || null,
          titulo_eleitoral: (rm.titulo_eleitoral || '').trim() || null,
          zona_eleitoral: (rm.zona_eleitoral || '').trim() || null,
          secao_eleitoral: (rm.secao_eleitoral || '').trim() || null,
          logradouro: (rm.logradouro || '').trim() || null,
          numero: (rm.numero || '').trim() || null,
          complemento: (rm.complemento || '').trim() || null,
          bairro: (rm.bairro || '').trim() || null,
          cidade: (rm.cidade || '').trim() || null,
          estado: (rm.estado || '').trim() || null,
          cep: (rm.cep || '').trim() || null,
          data_nascimento: parseDateSafe(rm.data_nascimento),
          data_nascimento_conjuge: parseDateSafe(rm.data_nascimento_conjuge),
          data_batismo_aguas: parseDateSafe(rm.data_batismo_aguas),
          data_batismo_espirito_santo: parseDateSafe(rm.data_batismo_espirito_santo),
          data_consagracao: parseDateSafe(rm.data_consagracao),
          data_emissao: parseDateSafe(rm.data_emissao),
          data_validade_credencial: parseDateSafe(rm.data_validade_credencial),
          member_since: parseDateSafe(rm.member_since),
          custom_fields: customFieldsFinal,
          dados_cargos: dadosCargosFinal,
          foto_url: null, // será preenchido após upload para storage se houver foto
          congregacao_id: null, // sem congregação obrigatória para convenção
        };

        const currentPos = recordsToInsert.length;
        recordsToInsert.push(payload);

        if (hasFotoBase64 && options?.importPhotos !== false) {
          batchPhotos.push({
            memberTempIndex: currentPos,
            base64: rawFoto,
          });
        }
      }

      if (recordsToInsert.length === 0) continue;

      // Inserir lote no banco
      const { data: insertedMembers, error: insertErr } = await this.supabaseAdmin
        .from('members')
        .insert(recordsToInsert)
        .select('id, name');

      if (insertErr) {
        erros.push({
          linha: i + 2,
          nome: `Lote ${i / BATCH_SIZE + 1}`,
          motivo: insertErr.message,
        });
        continue;
      }

      inseridos += insertedMembers?.length || 0;

      // Atualizar coleções de controle em memória para não duplicar no mesmo arquivo
      recordsToInsert.forEach((rec) => {
        if (rec.cpf) existingCpfs.add(rec.cpf);
        if (rec.custom_fields?.origem_servos_id) existingServosIds.add(rec.custom_fields.origem_servos_id);
      });

      // Processar uploads de fotos do lote
      if (insertedMembers && batchPhotos.length > 0) {
        for (const bp of batchPhotos) {
          const createdMember = insertedMembers[bp.memberTempIndex];
          if (!createdMember?.id) continue;

          try {
            const publicUrl = await this.uploadBase64Photo(
              createdMember.id,
              bp.base64
            );
            if (publicUrl) {
              await this.supabaseAdmin
                .from('members')
                .update({ foto_url: publicUrl })
                .eq('id', createdMember.id);
              fotosEnviadas++;
            }
          } catch (pErr) {
            falhasFotos++;
            console.error(`Falha ao salvar foto do ministro ${createdMember.name}:`, pErr);
          }
        }
      }
    }

    return {
      total_lidas: rawMembers.length,
      inseridos,
      ignorados,
      fotos_enviadas: fotosEnviadas,
      falhas_fotos: falhasFotos,
      erros,
    };
  }

  /**
   * Converte foto base64 e grava no bucket 'member-photos'
   */
  private async uploadBase64Photo(memberId: string, base64Str: string): Promise<string | null> {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';

    const path = `${this.targetMinistryId}/membros/${memberId}.${ext}`;

    const { error: uploadError } = await this.supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = this.supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }

  /**
   * Importa o template de carteirinha JSON garantindo isolamento total por ministry_id
   */
  public async importCartaoTemplate(templateJson: Record<string, any>): Promise<{
    template_key: string;
    action: 'criado' | 'atualizado';
  }> {
    this.validateTargetMinistry();

    const templateKey = (templateJson.template_key || 'ministro-branco').trim();
    const name = (templateJson.name || 'Ministro Modelo 01').trim();
    const tipoCadastro = (templateJson.tipo_cadastro || 'ministro').trim();
    const templateData = templateJson.template_data || templateJson;

    // Verificar se já existe template com essa chave no tenant
    const { data: existing } = await this.supabaseAdmin
      .from('cartoes_templates')
      .select('id, template_key')
      .eq('ministry_id', this.targetMinistryId)
      .eq('template_key', templateKey)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateErr } = await this.supabaseAdmin
        .from('cartoes_templates')
        .update({
          name,
          tipo_cadastro: tipoCadastro,
          is_active: true,
          template_data: templateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateErr) throw new Error(`Falha ao atualizar template: ${updateErr.message}`);
      return { template_key: templateKey, action: 'atualizado' };
    } else {
      const { error: insertErr } = await this.supabaseAdmin
        .from('cartoes_templates')
        .insert({
          ministry_id: this.targetMinistryId,
          template_key: templateKey,
          name,
          tipo_cadastro: tipoCadastro,
          is_active: true,
          is_default: true,
          template_data: templateData,
        });

      if (insertErr) throw new Error(`Falha ao inserir template: ${insertErr.message}`);
      return { template_key: templateKey, action: 'criado' };
    }
  }
}
