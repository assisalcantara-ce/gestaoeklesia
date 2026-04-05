import type { SupabaseClient } from '@supabase/supabase-js';

export type TipoCartao = 'membro' | 'congregado' | 'ministro' | 'funcionario';

const TIPOS_HABILITADOS: TipoCartao[] = ['ministro', 'funcionario'];

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
      try {
        dump[k] = anyErr[k];
      } catch {
        // ignore property access issues
      }
    }
    const json = JSON.stringify(dump);
    return json && json !== '{}' ? json : String(anyErr);
  } catch {
    return String(anyErr || 'erro desconhecido');
  }
}

function isCartoesTemplatesUnavailableError(error: any): boolean {
  const text = getSupabaseErrorText(error).toLowerCase();
  return (
    (text.includes('cartoes_templates') && (text.includes('schema cache') || text.includes('could not find the table'))) ||
    text.includes('pgrst205') ||
    text.includes('permission denied') ||
    text.includes('not authorized') ||
    text.includes('violates row-level security') ||
    text.includes('failed to fetch') ||
    text.includes('networkerror') ||
    text.includes('network request failed')
  );
}

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
  const tipos: TipoCartao[] = TIPOS_HABILITADOS;
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

  return TEMPLATES_DISPONIVEIS
    .filter((t: any) => TIPOS_HABILITADOS.includes((t.tipo || t.tipoCadastro) as TipoCartao))
    .map((t: any) => {
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
    const msg = getSupabaseErrorText(error);
    if (isCartoesTemplatesUnavailableError(error)) {
      console.warn('⚠️ Tabela/rede de cartoes_templates indisponível; usando templates locais.');
      return [];
    }
    console.error('❌ Erro ao buscar templates no Supabase:', msg || error);
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
  let templatesDoTipo = templatesSnapshot
    .filter(t => (t?.tipoCadastro || t?.tipo) === tipo)
    .map(sanitizeTemplateForStorage);

  // Garante no máximo um template ativo por tipo para respeitar o índice parcial único.
  const ativos = templatesDoTipo.filter(t => t?.ativo === true);
  if (ativos.length > 1) {
    const keepId = String(ativos[ativos.length - 1]?.id || '');
    templatesDoTipo = templatesDoTipo.map((t) => ({
      ...t,
      ativo: String(t?.id || '') === keepId,
    }));
  }

  const { data: existingRows, error: listErr } = await supabase
    .from('cartoes_templates')
    .select('template_key')
    .eq('ministry_id', ministryId)
    .eq('tipo_cadastro', tipo);

  if (listErr) {
    const msg = getSupabaseErrorText(listErr);
    if (isCartoesTemplatesUnavailableError(listErr)) {
      console.warn('⚠️ Tabela/RLS de cartoes_templates indisponível; persistência ignorada para este ambiente.');
      return;
    }
    console.error('❌ Erro ao listar templates existentes no Supabase:', msg || listErr);
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

  // Evita violação transitória da constraint unique_active_per_tipo durante upsert em lote.
  const clearActive = await supabase
    .from('cartoes_templates')
    .update({ is_active: false, is_default: false } as any)
    .eq('ministry_id', ministryId)
    .eq('tipo_cadastro', tipo)
    .eq('is_active', true);

  if (clearActive.error) {
    const msg = getSupabaseErrorText(clearActive.error);
    if (isCartoesTemplatesUnavailableError(clearActive.error)) {
      console.warn('⚠️ Persistência de templates ignorada: cartoes_templates indisponível neste ambiente.');
      return;
    }
    console.error('❌ Erro ao limpar template ativo atual no Supabase:', msg || clearActive.error);
    return;
  }

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

  if (up.error) {
    const msg = getSupabaseErrorText(up.error);
    if (isCartoesTemplatesUnavailableError(up.error)) {
      console.warn('⚠️ Persistência de templates ignorada: cartoes_templates indisponível neste ambiente.');
      return;
    }
    console.error('❌ Erro ao upsert templates no Supabase:', msg || up.error);
  }
}

async function canUseCartoesTemplatesTable(supabase: SupabaseClient, ministryId: string): Promise<boolean> {
  const probe = await supabase
    .from('cartoes_templates')
    .select('template_key', { count: 'exact', head: true })
    .eq('ministry_id', ministryId)
    .limit(1);

  if (!probe.error) return true;
  if (isCartoesTemplatesUnavailableError(probe.error)) return false;
  return true;
}

export async function loadTemplatesForCurrentUser(
  supabase: SupabaseClient,
  options?: { allowLocalMigration?: boolean }
): Promise<{ templates: any[]; ministryId: string | null }>
{
  const ministryId = await resolveMinistryId(supabase);
  if (!ministryId) return { templates: [], ministryId: null };

  const tableAvailable = await canUseCartoesTemplatesTable(supabase, ministryId);
  if (!tableAvailable) {
    const fallback = buildDefaultTemplatesSnapshot();
    const ensuredFallback = ensureDefaultActives(fallback);
    return { templates: ensuredFallback.next, ministryId };
  }

  const fromDb = await fetchCartoesTemplatesFromSupabase(supabase, ministryId);
  const fromDbFiltrado = fromDb.filter((t: any) => TIPOS_HABILITADOS.includes((t?.tipoCadastro || t?.tipo) as TipoCartao));
  if (fromDbFiltrado.length > 0) {
    const ensured = ensureDefaultActives(fromDbFiltrado);
    if (ensured.changed) {
      const tipos: TipoCartao[] = TIPOS_HABILITADOS;
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

  templatesBase = templatesBase.filter((t: any) => TIPOS_HABILITADOS.includes((t?.tipoCadastro || t?.tipo) as TipoCartao));

  const ensured = ensureDefaultActives(templatesBase);
  const templatesFinal = ensured.next;

  const tipos: TipoCartao[] = TIPOS_HABILITADOS;
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
