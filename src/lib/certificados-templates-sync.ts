import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';
import { CERTIFICADOS_TEMPLATES_PADRAO } from '@/lib/certificados-templates-padrao';

function sanitizeTemplateForStorage(template: any): any {
  if (!template || typeof template !== 'object') return template;
  const copy = { ...template };
  delete copy.backgroundFile;
  return copy;
}

function getSupabaseErrorText(error: any): string {
  if (!error) return '';
  const anyErr = error as any;
  const parts = [
    anyErr?.code ? `(${String(anyErr.code)})` : '',
    anyErr?.message ? String(anyErr.message) : '',
    anyErr?.details ? String(anyErr.details) : '',
    anyErr?.hint ? String(anyErr.hint) : '',
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  try {
    const ownNames = Object.getOwnPropertyNames(anyErr || {});
    const dump: Record<string, unknown> = {};
    for (const k of ownNames) {
      try { dump[k] = anyErr[k]; } catch { /* ignore */ }
    }
    const json = JSON.stringify(dump);
    return json && json !== '{}' ? json : String(anyErr);
  } catch {
    return String(anyErr || 'erro desconhecido');
  }
}


export async function fetchCertificadosTemplatesFromSupabase(
  supabase: SupabaseClient,
  ministryId: string
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('certificados_templates')
      .select('template_key,name,template_data,is_active,created_at,updated_at')
      .eq('ministry_id', ministryId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Aviso certificados_templates:', getSupabaseErrorText(error));
      return [];
    }

    const rows = (data as any[]) || [];
    return rows
      .map((r) => {
        const t = r?.template_data;
        if (!t) return null;
        return {
          ...t,
          id: t.id || r.template_key,
          nome: t.nome || r.name,
          ativo: r.is_active === true,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function persistCertificadosTemplatesSnapshotToSupabase(
  supabase: SupabaseClient,
  ministryId: string,
  templatesSnapshot: any[]
): Promise<void> {
  const templatesToSave = templatesSnapshot.map(sanitizeTemplateForStorage);

  try {
    const { data: existingRows, error: listErr } = await supabase
      .from('certificados_templates')
      .select('template_key')
      .eq('ministry_id', ministryId);

    if (listErr) {
      console.warn('Aviso ao listar certificados_templates:', getSupabaseErrorText(listErr));
      return;
    }

    const existingKeys = new Set(((existingRows as any[]) || []).map((r) => r.template_key));
    const nextKeys = new Set(templatesToSave.map((t) => String(t.id)));

    const toDelete = Array.from(existingKeys).filter((k) => !nextKeys.has(k));
    if (toDelete.length > 0) {
      const del = await supabase
        .from('certificados_templates')
        .delete()
        .eq('ministry_id', ministryId)
        .in('template_key', toDelete);
      if (del.error) console.warn('Aviso ao deletar certificados:', getSupabaseErrorText(del.error));
    }

    if (templatesToSave.length === 0) return;

    const rows = templatesToSave.map((t) => ({
      ministry_id: ministryId,
      template_key: String(t.id),
      name: String(t.nome || t.name || t.id),
      description: null as null,
      template_data: t,
      preview_url: null as null,
      is_default: false,
      is_active: t.ativo === true,
    }));

    const up = await supabase
      .from('certificados_templates')
      .upsert(rows as any, { onConflict: 'ministry_id,template_key' });

    if (up.error) console.warn('Aviso ao salvar certificados_templates:', getSupabaseErrorText(up.error));
  } catch {
    console.warn('Persistencia de certificados_templates ignorada.');
  }
}

export async function loadCertificadosTemplatesForCurrentUser(
  supabase: SupabaseClient
): Promise<{ templates: any[]; ministryId: string | null }> {
  try {
    const ministryId = await resolveMinistryId(supabase);
    if (!ministryId) return { templates: [], ministryId: null };

    const fromDb = await fetchCertificadosTemplatesFromSupabase(supabase, ministryId);

    // Mapa de template_id -> cargo_key e backgroundUrl para fallback em templates antigos no banco
    const padraoMap = new Map(
      CERTIFICADOS_TEMPLATES_PADRAO.map((p) => [
        p.id,
        { cargo_key: (p as any).cargo_key as string | undefined, backgroundUrl: p.backgroundUrl },
      ])
    );

    // Carregar cargos ministeriais ativos do tenant
    let cargosAtivos: string[] = [];
    try {
      const { data: configRow } = await supabase
        .from('configurations')
        .select('nomenclaturas')
        .eq('ministry_id', ministryId)
        .maybeSingle();
      const rawNomenclaturas = (configRow as any)?.nomenclaturas || {};
      const cargos: any[] = rawNomenclaturas?.cargos_ministeriais || [];
      // Se houver cargos configurados, usar os ativos; se não houver, liberar todos
      if (Array.isArray(cargos) && cargos.length > 0) {
        cargosAtivos = cargos
          .filter((c: any) => c.ativo !== false)
          .map((c: any) => (c.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      }
    } catch {
      // sem configuracao: liberar todos
    }

    // Normaliza nome para comparação insensível a acento e case
    const normalizeStr = (s: string) =>
      (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Auto-seed: para cada template padrão, verifica se o ministério já tem esse template pelo ID/chave
    for (const padrao of CERTIFICADOS_TEMPLATES_PADRAO) {
      // Filtro de cargos: se o template tem cargo_key e o tenant tem cargos configurados,
      // verificar se esse cargo está ativo
      const cargoKey = (padrao as any).cargo_key as string | undefined;
      if (cargoKey && cargosAtivos.length > 0) {
        const cargoNorm = normalizeStr(cargoKey);
        const cargoPermitido = cargosAtivos.some((c) => c === cargoNorm);
        if (!cargoPermitido) continue; // pular templates cujo cargo não está ativo
      }

      const existente = fromDb.find((t: any) => t.template_key === padrao.id || t.id === padrao.id);
      if (!existente) {
        // Novo template — inserir
        const row = {
          ministry_id: ministryId,
          template_key: padrao.id,
          name: padrao.nome,
          description: null,
          template_data: padrao,
          preview_url: null,
          is_default: true,
          is_active: true,
        };
        const { error } = await supabase
          .from('certificados_templates')
          .upsert(row as any, { onConflict: 'ministry_id,template_key' });
        if (!error) fromDb.push({ ...padrao, ativo: true });
      } else if (!existente.backgroundUrl && padrao.backgroundUrl) {
        // Template existente sem background — atualizar apenas backgroundUrl e cargo_key
        const updatedData = { ...existente, backgroundUrl: padrao.backgroundUrl, cargo_key: cargoKey };
        await supabase
          .from('certificados_templates')
          .update({ template_data: updatedData })
          .eq('ministry_id', ministryId)
          .eq('template_key', padrao.id);
        // Atualizar localmente também
        const idx = fromDb.indexOf(existente);
        if (idx >= 0) fromDb[idx] = updatedData;
      }
    }

    // Filtrar templates retornados: remover templates ministeriais de cargos inativos/removidos
    const filtered = cargosAtivos.length === 0
      ? fromDb
      : fromDb.filter((t: any) => {
          // Tentar cargo_key do próprio template, ou fazer lookup pelo ID no padraoMap
          const cargoKey: string | undefined =
            t.cargo_key ?? padraoMap.get(t.id ?? t.template_key)?.cargo_key;
          if (!cargoKey) return true; // sem cargo_key, sempre mostrar
          const cargoNorm = normalizeStr(cargoKey);
          return cargosAtivos.some((c) => c === cargoNorm);
        });

    return { templates: filtered, ministryId };
  } catch {
    return { templates: [], ministryId: null };
  }
}
