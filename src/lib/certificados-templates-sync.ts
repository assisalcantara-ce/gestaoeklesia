import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';

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
    return { templates: fromDb, ministryId };
  } catch {
    return { templates: [], ministryId: null };
  }
}
