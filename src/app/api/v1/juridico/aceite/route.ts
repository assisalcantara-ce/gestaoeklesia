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

    // Se o documento for INSTITUCIONAL, validar estritamente se o usuário possui permissão/role ADMINISTRADOR
    if (isInstitucional) {
      // 1. Verificar se é o proprietário (ministries.user_id)
      const { isMasterUsuarioMinisterio } = await import('@/lib/tenant-auth');
      const isOwner = await isMasterUsuarioMinisterio(supabaseAdmin, userId, cleanMinistryId);

      let isAdmin = isOwner;

      if (!isAdmin) {
        // 2. Verificar em ministry_users se possui role ou permissão ADMINISTRADOR
        const { data: muData } = await supabaseAdmin
          .from('ministry_users')
          .select('role, permissions')
          .eq('user_id', userId)
          .eq('ministry_id', cleanMinistryId)
          .limit(1)
          .maybeSingle();

        if (muData) {
          const { resolveRoles, normalizePermissions } = await import('@/lib/access-control');
          const roles = resolveRoles(muData.role, muData.permissions);
          const perms = normalizePermissions(muData.permissions);
          if (roles.includes('ADMINISTRADOR') || perms.includes('ADMINISTRADOR') || String(muData.role).toLowerCase() === 'admin') {
            isAdmin = true;
          }
        }
      }

      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            code: 'ADMIN_REQUIRED',
            error: 'Apenas usuários com perfil ADMINISTRADOR podem assinar contratos institucionais.',
          },
          { status: 403 }
        );
      }
    }

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    let registroAceite: any = null;
    let conteudoMaterializado: string | null = null;
    let hashDocumentoFinal: string | null = doc.hash_sha256 || null;
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

      const { ContratosRepository } = await import('@/repositories/ContratosRepository');
      const contratosRepo = new ContratosRepository(supabaseAdmin);
      const contratosExistentes = await contratosRepo.buscarPorMinistryId(cleanMinistryId);
      const contratoLegado = contratosExistentes.find(
        (c) => c.status === 'ATIVO' && (!c.conteudo_customizado || c.snapshot_status === 'HERDADO_MATRIZ')
      );

      const versaoAceitaRPC = contratoLegado ? `${doc.versao}-REGULARIZADO` : doc.versao;

      // Executar regularização contratual atômica via RPC PostgreSQL
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('regularizar_contrato_tenant', {
        p_ministry_id: cleanMinistryId,
        p_user_id: userId,
        p_documento_id: doc.id,
        p_versao_documento: doc.versao,
        p_versao_aceita: versaoAceitaRPC,
        p_hash_documento: hashDocumentoFinal,
        p_plano_contratado: planoComercialReal,
        p_valor_mensal: valorMensalReal,
        p_conteudo_customizado: conteudoMaterializado,
        p_numero_contrato: dadosTenant.numeroContrato,
        p_ip_address: ipAddress,
        p_user_agent: userAgent,
      });

      if (rpcErr) {
        console.error('[POST /juridico/aceite] Erro na RPC regularizar_contrato_tenant:', rpcErr);
        throw new Error(`Falha ao registrar contrato materializado: ${rpcErr.message}`);
      }

      registroAceite = {
        id: rpcRes?.aceite_id || doc.id,
        ministry_id: cleanMinistryId,
        user_id: userId,
        documento_id: doc.id,
        versao_aceita: versaoAceitaRPC,
        hash_documento: hashDocumentoFinal,
        created_at: new Date().toISOString(),
      };
    } else {
      if (!hashDocumentoFinal) {
        const crypto = require('crypto');
        hashDocumentoFinal = crypto.createHash('sha256').update(doc.conteudo_md || '').digest('hex');
      }

      const aceitesService = new AceitesService(supabaseAdmin);
      registroAceite = await aceitesService.registrarAceite({
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
    }

    // 4. Registrar auditoria jurídica obrigatória
    const auditoriaService = new AuditoriaJuridicaService(supabaseAdmin);
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
        aceite_id: registroAceite?.id,
        origem: 'TELA_ACEITE_JURIDICO',
        escopo: doc.escopo,
        is_institucional: isInstitucional,
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