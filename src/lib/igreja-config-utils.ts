// Utilitário para gerenciar configurações da igreja/ministério

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConfiguracaoIgreja {
    nome: string;
    endereco: string;
    cnpj: string;
    telefone: string;
    email: string;
    website?: string;
    descricao?: string;
    responsavel?: string;
    dataCadastro?: string;
    logo: string; // Base64 da imagem
}

// Configuração padrão
const CONFIGURACAO_PADRAO: ConfiguracaoIgreja = {
    nome: 'Igreja/Ministério',
    endereco: 'Endereço não configurado',
    cnpj: '',
    telefone: '',
    email: '',
    website: '',
    descricao: '',
    responsavel: '',
    logo: ''
};

/**
 * Resolve o ministryId a partir do próprio Supabase Auth.
 *
 * ATENÇÃO — uso restrito ao fallback.
 * Esta função é mantida EXCLUSIVAMENTE para consumidores que ainda não
 * recebem o ministryId via contexto oficial (useUserContext / useCurrentMinistry).
 * Em sessões de impersonação ela retorna o tenant do Super Admin (IEADMI),
 * o que é incorreto. Todos os consumidores em /configuracoes já passam
 * ministryId explicitamente e NUNCA chegam a chamar esta função.
 */
async function resolveMinistryIdFallback(supabase: SupabaseClient): Promise<string | null> {
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

/**
 * Busca as configurações da igreja/ministério.
 *
 * @param supabase  Cliente Supabase autenticado.
 * @param ministryId  ID do ministério resolvido pelo contexto oficial (useUserContext).
 *                    Quando fornecido, é utilizado diretamente — sem qualquer
 *                    consulta paralela ao Supabase Auth. Isso garante que sessões
 *                    de impersonação leiam o tenant correto.
 *                    Quando omitido, aplica o fallback via Auth (legado, somente
 *                    para chamadas fora do contexto de impersonação).
 */
export async function fetchConfiguracaoIgrejaFromSupabase(
    supabase: SupabaseClient,
    ministryId?: string | null
): Promise<ConfiguracaoIgreja> {
    // Usa o ministryId fornecido (fonte oficial) ou resolve via fallback (legado)
    const resolvedId = ministryId ?? await resolveMinistryIdFallback(supabase);
    if (!resolvedId) return CONFIGURACAO_PADRAO;

    const { data, error } = await supabase
        .from('ministries')
        .select('name, email_admin, cnpj_cpf, phone, website, description, logo_url, created_at')
        .eq('id', resolvedId)
        .maybeSingle();

    const { data: configRow } = await supabase
        .from('configurations')
        .select('church_profile')
        .eq('ministry_id', resolvedId)
        .maybeSingle();

    const churchProfile = (configRow as any)?.church_profile || {};

    if (error || !data) return CONFIGURACAO_PADRAO;

    return {
        nome: data.name || CONFIGURACAO_PADRAO.nome,
        endereco: churchProfile.endereco || CONFIGURACAO_PADRAO.endereco,
        cnpj: data.cnpj_cpf || '',
        telefone: data.phone || '',
        email: data.email_admin || '',
        website: data.website || '',
        descricao: data.description || '',
        responsavel: churchProfile.responsavel || CONFIGURACAO_PADRAO.responsavel || '',
        dataCadastro: data.created_at ? new Date(data.created_at).toISOString().split('T')[0] : '',
        logo: data.logo_url || ''
    };
}

/**
 * Atualiza as configurações da igreja/ministério.
 *
 * @param supabase  Cliente Supabase autenticado.
 * @param config  Campos a atualizar.
 * @param ministryId  ID do ministério resolvido pelo contexto oficial (useUserContext).
 *                    Mesma semântica de fetchConfiguracaoIgrejaFromSupabase.
 */
export async function updateConfiguracaoIgrejaInSupabase(
    supabase: SupabaseClient,
    config: Partial<ConfiguracaoIgreja>,
    ministryId?: string | null
): Promise<void> {
    // Usa o ministryId fornecido (fonte oficial) ou resolve via fallback (legado)
    const resolvedId = ministryId ?? await resolveMinistryIdFallback(supabase);
    if (!resolvedId) return;

    const updateMinistry: Record<string, any> = {};
    if (typeof config.nome === 'string') updateMinistry.name = config.nome;
    if (typeof config.email === 'string') updateMinistry.email_admin = config.email;
    if (typeof config.cnpj === 'string') updateMinistry.cnpj_cpf = config.cnpj;
    if (typeof config.telefone === 'string') updateMinistry.phone = config.telefone;
    if (typeof config.website === 'string') updateMinistry.website = config.website;
    if (typeof config.descricao === 'string') updateMinistry.description = config.descricao;
    if (typeof config.logo === 'string') updateMinistry.logo_url = config.logo;

    if (Object.keys(updateMinistry).length > 0) {
        await supabase
            .from('ministries')
            .update(updateMinistry)
            .eq('id', resolvedId);
    }

    const { data: configRow } = await supabase
        .from('configurations')
        .select('church_profile')
        .eq('ministry_id', resolvedId)
        .maybeSingle();

    const existingProfile = (configRow as any)?.church_profile || {};
    const nextProfile = {
        ...existingProfile,
        ...(typeof config.endereco === 'string' ? { endereco: config.endereco } : {}),
        ...(typeof config.responsavel === 'string' ? { responsavel: config.responsavel } : {})
    };

    const { error: upsertErr } = await supabase
        .from('configurations')
        .upsert(
            {
                ministry_id: resolvedId,
                church_profile: nextProfile,
                updated_at: new Date().toISOString(),
            } as any,
            { onConflict: 'ministry_id' }
        );

    if (upsertErr) throw upsertErr;
}
