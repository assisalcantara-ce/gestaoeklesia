import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AceitesService } from '@/services/AceitesService';
import { DocumentosJuridicosService } from '@/services/DocumentosJuridicosService';
import { AuditoriaJuridicaService } from '@/services/AuditoriaJuridicaService';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, error: 'Servidor não configurado.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authData?.user?.id) {
      return NextResponse.json({ success: false, error: 'Sessão inválida ou expirada.' }, { status: 401 });
    }

    const body = await request.json();
    const { documento_id, ministry_id } = body;

    if (!documento_id || typeof documento_id !== 'string' || documento_id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'O ID do documento ("documento_id") é obrigatório.' },
        { status: 400 }
      );
    }
    if (!ministry_id || typeof ministry_id !== 'string' || ministry_id.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'O ID do ministério/tenant ("ministry_id") é obrigatório.' },
        { status: 400 }
      );
    }

    const userId = authData.user.id;
    const cleanDocumentoId = documento_id.trim();
    const cleanMinistryId = ministry_id.trim();

    // Validar vínculo real entre o usuário autenticado e o ministério informado
    const { validarVinculoUsuarioMinisterio } = await import('@/lib/tenant-auth');
    const temVinculo = await validarVinculoUsuarioMinisterio(supabaseAdmin, userId, cleanMinistryId);

    if (!temVinculo) {
      return NextResponse.json(
        { success: false, error: 'Acesso negado: você não possui vínculo com este ministério.' },
        { status: 403 }
      );
    }

    // 1. Localizar o documento e verificar se está PUBLICADO
    const docsService = new DocumentosJuridicosService(supabaseAdmin);
    const doc = await docsService.buscarPorId(cleanDocumentoId);

    if (doc.status !== 'PUBLICADO' || !doc.ativo) {
      return NextResponse.json(
        { success: false, error: 'Apenas documentos publicados e ativos podem ser aceitos.' },
        { status: 400 }
      );
    }

    const isInstitucional = doc.escopo === 'INSTITUCIONAL' || ['CONTRATO_SERVICO', 'ADITIVO'].includes(doc.tipo);

    // Se o documento for INSTITUCIONAL, validar estritamente se o usuário é o MASTER/Proprietário oficial do tenant
    if (isInstitucional) {
      const { isMasterUsuarioMinisterio } = await import('@/lib/tenant-auth');
      const isMaster = await isMasterUsuarioMinisterio(supabaseAdmin, userId, cleanMinistryId);

      if (!isMaster) {
        return NextResponse.json(
          {
            success: false,
            code: 'LEGAL_REPRESENTATIVE_REQUIRED',
            error: 'Apenas o usuário MASTER (responsável principal do ministério/tenant) possui autoridade legal para aceitar e assinar documentos institucionais e contratuais.',
          },
          { status: 403 }
        );
      }
    }

    // Materializar dados reais do contrato se for um documento INSTITUCIONAL
    let conteudoMaterializado: string | null = null;
    let hashDocumentoFinal = doc.hash_sha256 || null;
    let planoComercialReal: string = 'starter';
    let valorMensalReal: number | null = null;

    if (isInstitucional) {
      const { MaterializacaoContratoService } = await import('@/services/MaterializacaoContratoService');
      const matService = new MaterializacaoContratoService(supabaseAdmin);
      const dadosTenant = await matService.obterDadosOficiaisTenant(cleanMinistryId, userId);
      const matResultado = matService.materializarConteudo(doc.conteudo_md, dadosTenant);

      conteudoMaterializado = matResultado.conteudoMaterializado;
      hashDocumentoFinal = matResultado.hashSha256;
      planoComercialReal = dadosTenant.planoNome;
      valorMensalReal = dadosTenant.valorMensal;
    } else if (!hashDocumentoFinal) {
      const crypto = require('crypto');
      hashDocumentoFinal = crypto.createHash('sha256').update(doc.conteudo_md || '').digest('hex');
    }

    // 2. Registrar o aceite via AceitesService
    const aceitesService = new AceitesService(supabaseAdmin);
    const auditoriaService = new AuditoriaJuridicaService(supabaseAdmin);

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const registroAceite = await aceitesService.registrarAceite({
      ministry_id: cleanMinistryId,
      user_id: userId,
      documento_id: doc.id,
      versao_aceita: doc.versao,
      hash_documento: hashDocumentoFinal!,
      ip_address: ipAddress,
      user_agent: userAgent,
      payload_aceite: {
        origem: 'TELA_ACEITE_JURIDICO',
        escopo: doc.escopo,
        hash_sha256_materializado: hashDocumentoFinal,
      },
    });

    // 3. Se for um documento INSTITUCIONAL (Contrato de Serviço / Aditivo), sincronizar com tenant_contratos salvando o snapshot imutável
    if (isInstitucional) {
      const { ContratosRepository } = await import('@/repositories/ContratosRepository');
      const contratosRepo = new ContratosRepository(supabaseAdmin);

      const contratosExistentes = await contratosRepo.buscarPorMinistryId(cleanMinistryId);
      const contratoAtual = contratosExistentes[0] || null;

      const payloadContrato = {
        documento_base_id: doc.id,
        documento_raiz_id: doc.documento_raiz_id || doc.id,
        versao_documento: doc.versao,
        hash_documento: hashDocumentoFinal,
        plano_contratado: planoComercialReal,
        valor_mensal: valorMensalReal,
        conteudo_customizado: conteudoMaterializado,
        snapshot_status: 'INTEGRO_IMUTAVEL' as const,
        origem_snapshot: 'CELEBRACAO_ORIGINAL' as const,
        integridade_verificada: true,
        status: 'ATIVO' as const,
        assinado_em: new Date().toISOString(),
        assinado_por: userId,
      };

      if (contratoAtual) {
        // Atualizar contrato existente para ATIVO com o snapshot impresso
        await supabaseAdmin
          .from('tenant_contratos')
          .update(payloadContrato)
          .eq('id', contratoAtual.id);
      } else {
        // Criar registro de contrato ATIVO para o tenant com o snapshot impresso
        await contratosRepo.criar({
          ministry_id: cleanMinistryId,
          ...payloadContrato,
          data_inicio: new Date().toISOString(),
        });
      }
    }

    // 4. Registrar auditoria jurídica obrigatória
    await auditoriaService.registrarEvento({
      usuario_id: userId,
      ministry_id: cleanMinistryId,
      documento_id: doc.id,
      versao: doc.versao,
      hash_documento: hashDocumentoFinal!,
      tipo_evento: 'ACEITE_REGISTRADO',
      ip_address: ipAddress,
      user_agent: userAgent,
      detalhes: {
        aceite_id: registroAceite.id,
        origem: 'TELA_ACEITE_JURIDICO',
        escopo: doc.escopo,
      },
    });

    return NextResponse.json({ success: true, data: registroAceite }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Erro ao registrar aceite do documento.' },
      { status: 400 }
    );
  }
}