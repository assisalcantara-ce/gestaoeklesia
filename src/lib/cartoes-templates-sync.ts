import type { SupabaseClient } from '@supabase/supabase-js';

export type TipoCartao = 'membro' | 'congregado' | 'ministro' | 'funcionario';

export async function resolveMinistryId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const mu = await supabase
      .from('ministry_users')
      .select('ministry_id')
      .eq('user_id', user.id)
      .limit(1);

    const ministryIdFromMu = (mu.data as any)?.[0]?.ministry_id as string | undefined;
    if (ministryIdFromMu) return ministryIdFromMu;

    const m = await supabase.from('ministries').select('id').eq('user_id', user.id).limit(1);
    const ministryIdFromOwner = (m.data as any)?.[0]?.id as string | undefined;
    return ministryIdFromOwner || null;
  } catch {
    return null;
  }
}

function ensureDefaultActives(templatesInput: any[]): { next: any[]; changed: boolean } {
  const tipos: TipoCartao[] = ['membro', 'congregado', 'ministro', 'funcionario'];
  let changed = false;
  const next = templatesInput.map(t => ({ ...t }));

  tipos.forEach((tipo) => {
    const hasActive = next.some(t => (t?.tipoCadastro || t?.tipo) === tipo && t?.ativo);
    if (hasActive) return;

    const firstOfType = next.find(t => (t?.tipoCadastro || t?.tipo) === tipo);
    if (firstOfType) {
      firstOfType.ativo = true;
      changed = true;
    }
  });

  return { next, changed };
}

function buildDefaultTemplatesSnapshot(): any[] {
  const { TEMPLATES_CUSTOMIZADOS } = require('@/lib/custom-card-templates');
  const { TEMPLATES_DISPONIVEIS, converterParaTemplateEditavel } = require('@/lib/card-templates');
  const mapCustomizados = new Map();
  TEMPLATES_CUSTOMIZADOS.forEach((ct: any) => mapCustomizados.set(ct.id, ct));

  return TEMPLATES_DISPONIVEIS.map((t: any) => {
    const customizado = mapCustomizados.get(t.id);
    const templateParaUsar = customizado || t;
    const editavel = converterParaTemplateEditavel(templateParaUsar);
    const tipoCadastro = editavel.tipoCadastro || templateParaUsar.tipo || templateParaUsar.tipoCadastro;
    return {
      ...editavel,
      tipoCadastro: tipoCadastro,
      tipo: tipoCadastro,
    };
  });
}

function sanitizeTemplateForStorage(template: any): any {
  if (!template || typeof template !== 'object') return template;
  const copy = { ...template };
  delete copy.backgroundFile;
  delete copy.backgroundFileVerso;
  return copy;
}

export async function fetchCartoesTemplatesFromSupabase(
  supabase: SupabaseClient,
  ministryId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('cartoes_templates')
    .select('template_key,tipo_cadastro,is_active,template_data,updated_at,created_at')
    .eq('ministry_id', ministryId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('❌ Erro ao buscar templates no Supabase:', error);
    return [];
  }

  const rows = (data as any[]) || [];
  return rows
    .map((r: any) => {
      const t = r?.template_data;
      if (!t) return null;
      const tipoCadastro = (t.tipoCadastro || r.tipo_cadastro || t.tipo) as string | undefined;
      return {
        ...t,
        id: t.id || r.template_key,
        tipoCadastro: tipoCadastro,
        tipo: tipoCadastro,
        ativo: r.is_active === true,
      };
    })
    .filter(Boolean);
}

export async function persistTemplatesSnapshotToSupabase(
  supabase: SupabaseClient,
  ministryId: string,
  tipo: TipoCartao,
  templatesSnapshot: any[]
): Promise<void> {
  const templatesDoTipo = templatesSnapshot
    .filter(t => (t?.tipoCadastro || t?.tipo) === tipo)
    .map(sanitizeTemplateForStorage);

  const { data: existingRows, error: listErr } = await supabase
    .from('cartoes_templates')
    .select('template_key')
    .eq('ministry_id', ministryId)
    .eq('tipo_cadastro', tipo);

  if (listErr) {
    console.error('❌ Erro ao listar templates existentes no Supabase:', listErr);
    return;
  }

  const existingKeys = new Set(((existingRows as any[]) || []).map(r => r.template_key));
  const nextKeys = new Set(templatesDoTipo.map(t => String(t.id)));

  const toDelete = Array.from(existingKeys).filter(k => !nextKeys.has(k));
  if (toDelete.length > 0) {
    const del = await supabase
      .from('cartoes_templates')
      .delete()
      .eq('ministry_id', ministryId)
      .eq('tipo_cadastro', tipo)
      .in('template_key', toDelete);

    if (del.error) console.error('❌ Erro ao deletar templates no Supabase:', del.error);
  }

  if (templatesDoTipo.length === 0) return;

  const rows = templatesDoTipo.map(t => ({
    ministry_id: ministryId,
    template_key: String(t.id),
    tipo_cadastro: tipo,
    name: String(t.nome || t.name || t.id),
    description: null,
    template_data: t,
    preview_url: (t.previewImage || null) as any,
    is_default: (t.ativo === true) as any,
    is_active: (t.ativo === true) as any,
  }));

  const up = await supabase
    .from('cartoes_templates')
    .upsert(rows as any, { onConflict: 'ministry_id,template_key' });

  if (up.error) console.error('❌ Erro ao upsert templates no Supabase:', up.error);
}

export async function loadTemplatesForCurrentUser(
  supabase: SupabaseClient,
  options?: { allowLocalMigration?: boolean }
): Promise<{ templates: any[]; ministryId: string | null }>
{
  const ministryId = await resolveMinistryId(supabase);
  if (!ministryId) return { templates: [], ministryId: null };

  const fromDb = await fetchCartoesTemplatesFromSupabase(supabase, ministryId);
  if (fromDb.length > 0) {
    const ensured = ensureDefaultActives(fromDb);
    if (ensured.changed) {
      const tipos: TipoCartao[] = ['membro', 'congregado', 'ministro', 'funcionario'];
      for (const tipo of tipos) {
        // eslint-disable-next-line no-await-in-loop
        await persistTemplatesSnapshotToSupabase(supabase, ministryId, tipo, ensured.next);
      }
    }
    return { templates: ensured.next, ministryId };
  }

  let templatesBase: any[] = [];
  let migratedFromLocal = false;

  if (options?.allowLocalMigration && typeof window !== 'undefined') {
    try {
      const legacy = localStorage.getItem('cartoes_templates_v2');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          templatesBase = parsed;
          migratedFromLocal = true;
        }
      }
    } catch {
      // ignore
    }
  }

  if (templatesBase.length === 0) {
    templatesBase = buildDefaultTemplatesSnapshot();
  }

  const ensured = ensureDefaultActives(templatesBase);
  const templatesFinal = ensured.next;

  const tipos: TipoCartao[] = ['membro', 'congregado', 'ministro', 'funcionario'];
  for (const tipo of tipos) {
    // eslint-disable-next-line no-await-in-loop
    await persistTemplatesSnapshotToSupabase(supabase, ministryId, tipo, templatesFinal);
  }

  if (migratedFromLocal && typeof window !== 'undefined') {
    try {
      localStorage.removeItem('cartoes_templates_v2');
    } catch {
      // ignore
    }
  }

  return { templates: templatesFinal, ministryId };
}
