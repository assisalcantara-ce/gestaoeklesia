import { NextRequest, NextResponse } from 'next/server';
import { resolveTenantAuth } from '@/lib/tenant-auth';
import { hasRole, temAcessoEscrita } from '@/lib/access-control';
import { ServosMigrationService } from '@/lib/servos-migration/ServosMigrationService';
import { TARGET_IEADMIM_MINISTRY_ID, parseCSVStream } from '@/lib/servos-migration/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveTenantAuth(request);
    const { admin, ministryId, roles, nivel, isOwner } = auth;

    // 1. Validação estrita de Tenant
    if (ministryId !== TARGET_IEADMIM_MINISTRY_ID) {
      return NextResponse.json(
        {
          error: `Acesso negado: a importação da migração Gestão Servos é permitida exclusivamente para o tenant IEADMIM (${TARGET_IEADMIM_MINISTRY_ID}). Seu tenant autenticado é: ${ministryId}`,
        },
        { status: 403 }
      );
    }

    // 2. Validação estrita de permissões administrativas conforme RBAC oficial do Gestão Eklésia
    // Permite Owner, Administrador Geral, Secretário Geral ou qualquer perfil com escrita no módulo secretaria
    const hasAdminPermission =
      isOwner ||
      hasRole(roles, ['ADMINISTRADOR', 'ADMIN', 'SECRETARIO_GERAL', 'PRESIDENCIA']) ||
      temAcessoEscrita(nivel, 'secretaria');

    if (!hasAdminPermission) {
      return NextResponse.json(
        { error: 'Acesso negado: permissão administrativa necessária para importar membros.' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const mode = (formData.get('mode') as string | null) || 'dry-run'; // 'dry-run' ou 'import'
    const csvFile = formData.get('file') as File | null;
    const templateFile = formData.get('template_file') as File | null;

    const migrationService = new ServosMigrationService(admin, ministryId);

    // Caso seja apenas importação de template de carteirinha
    if (templateFile && !csvFile) {
      const templateText = await templateFile.text();
      let templateJson: any;
      try {
        templateJson = JSON.parse(templateText);
      } catch (err: any) {
        return NextResponse.json({ error: `JSON de carteirinha inválido: ${err.message}` }, { status: 400 });
      }

      const templateResult = await migrationService.importCartaoTemplate(templateJson);
      return NextResponse.json({
        success: true,
        tipo: 'template_carteirinha',
        ...templateResult,
      });
    }

    // Processamento do CSV
    if (!csvFile) {
      return NextResponse.json({ error: 'Arquivo CSV é obrigatório.' }, { status: 400 });
    }

    const csvText = await csvFile.text();
    const { headers, rows } = parseCSVStream(csvText);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV vazio ou sem registros.' }, { status: 400 });
    }

    // Validação mínima de cabeçalho da exportação do Servos (precisa de 'name' e 'matricula')
    if (!headers.includes('name') && !headers.includes('nome')) {
      return NextResponse.json(
        { error: 'Cabeçalho do CSV inválido para a migração do Servos (coluna "name" ausente).' },
        { status: 400 }
      );
    }

    if (mode === 'dry-run') {
      const report = await migrationService.dryRun(rows as any);
      return NextResponse.json({
        success: true,
        mode: 'dry-run',
        report,
      });
    }

    if (mode === 'import') {
      const importResult = await migrationService.executeImport(rows as any, {
        importPhotos: true,
      });

      // Se veio template de carteirinha junto, processar também
      let templateResult: any = null;
      if (templateFile) {
        try {
          const tText = await templateFile.text();
          const tJson = JSON.parse(tText);
          templateResult = await migrationService.importCartaoTemplate(tJson);
        } catch (tErr: any) {
          console.warn('Erro ao importar template conjunto:', tErr.message);
        }
      }

      return NextResponse.json({
        success: true,
        mode: 'import',
        importResult,
        templateResult,
      });
    }

    return NextResponse.json({ error: 'Modo de operação inválido. Use "dry-run" ou "import".' }, { status: 400 });
  } catch (err: any) {
    console.error('POST /api/v1/secretaria/membros/servos-migration:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno ao processar migração do Servos.' },
      { status: 500 }
    );
  }
}
