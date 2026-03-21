import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDefaultCertificadosSnapshot } from '@/lib/certificados-templates';
import { resolveMinistryId } from '@/lib/cartoes-templates-sync';

function sanitizeTemplateForStorage(template: any): any {
  if (!template || typeof template !== 'object') return template;
  const copy = { ...template };
  delete copy.backgroundFile;
  return copy;
}

export async function fetchCertificadosTemplatesFromSupabase(
  supabase: SupabaseClient,
  ministryId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('certificados_templates')
    .select('template_key,name,template_data,is_active,created_at,updated_at')
    .eq('ministry_id', ministryId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Erro ao buscar templates de certificados:', error);
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
        ativo: r.is_active === true
      };
    })
    .filter(Boolean);
}

export async function persistCertificadosTemplatesSnapshotToSupabase(
  supabase: SupabaseClient,
  ministryId: string,
  templatesSnapshot: any[]
): Promise<void> {
  const templatesToSave = templatesSnapshot.map(sanitizeTemplateForStorage);

  const { data: existingRows, error: listErr } = await supabase
    .from('certificados_templates')
    .select('template_key')
    .eq('ministry_id', ministryId);

  if (listErr) {
    console.error('Erro ao listar templates existentes:', listErr);
    return;
  }

  const existingKeys = new Set(((existingRows as any[]) || []).map(r => r.template_key));
  const nextKeys = new Set(templatesToSave.map(t => String(t.id)));

  const toDelete = Array.from(existingKeys).filter(k => !nextKeys.has(k));
  if (toDelete.length > 0) {
    const del = await supabase
      .from('certificados_templates')
      .delete()
      .eq('ministry_id', ministryId)
      .in('template_key', toDelete);

    if (del.error) console.error('Erro ao deletar templates antigos:', del.error);
  }

  if (templatesToSave.length === 0) return;

  const rows = templatesToSave.map(t => ({
    ministry_id: ministryId,
    template_key: String(t.id),
    name: String(t.nome || t.name || t.id),
    description: null,
    template_data: t,
    preview_url: (t.previewImage || null) as any,
    is_default: (t.ativo === true) as any,
    is_active: (t.ativo === true) as any
  }));

  const up = await supabase
    .from('certificados_templates')
    .upsert(rows as any, { onConflict: 'ministry_id,template_key' });

  if (up.error) console.error('Erro ao upsert templates de certificados:', up.error);
}

export async function loadCertificadosTemplatesForCurrentUser(
  supabase: SupabaseClient
): Promise<{ templates: any[]; ministryId: string | null }>
{
  const ministryId = await resolveMinistryId(supabase);
  if (!ministryId) return { templates: [], ministryId: null };

  const fromDb = await fetchCertificadosTemplatesFromSupabase(supabase, ministryId);
  if (fromDb.length > 0) return { templates: fromDb, ministryId };

  const base = buildDefaultCertificadosSnapshot();
  await persistCertificadosTemplatesSnapshotToSupabase(supabase, ministryId, base as any[]);

  return { templates: base as any[], ministryId };
}
