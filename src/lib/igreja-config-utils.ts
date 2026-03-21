// Utilitário para gerenciar configurações da igreja/ministério

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConfiguracaoIgreja {
    nome: string;
    endereco: string;
    cnpj: string;
    telefone: string;
    email: string;
    website?: string;
    responsavel?: string;
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
    responsavel: '',
    logo: ''
};

async function resolveMinistryId(supabase: SupabaseClient): Promise<string | null> {
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

export async function fetchConfiguracaoIgrejaFromSupabase(
    supabase: SupabaseClient
): Promise<ConfiguracaoIgreja> {
    const ministryId = await resolveMinistryId(supabase);
    if (!ministryId) return CONFIGURACAO_PADRAO;

    const { data, error } = await supabase
        .from('ministries')
        .select('name, email_admin, cnpj_cpf, phone, website, logo_url')
        .eq('id', ministryId)
        .maybeSingle();

    const { data: configRow } = await supabase
        .from('configurations')
        .select('church_profile')
        .eq('ministry_id', ministryId)
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
        responsavel: churchProfile.responsavel || CONFIGURACAO_PADRAO.responsavel || '',
        logo: data.logo_url || ''
    };
}

export async function updateConfiguracaoIgrejaInSupabase(
    supabase: SupabaseClient,
    config: Partial<ConfiguracaoIgreja>
): Promise<void> {
    const ministryId = await resolveMinistryId(supabase);
    if (!ministryId) return;

    const updateMinistry: Record<string, any> = {};
    if (typeof config.nome === 'string') updateMinistry.name = config.nome;
    if (typeof config.email === 'string') updateMinistry.email_admin = config.email;
    if (typeof config.cnpj === 'string') updateMinistry.cnpj_cpf = config.cnpj;
    if (typeof config.telefone === 'string') updateMinistry.phone = config.telefone;
    if (typeof config.website === 'string') updateMinistry.website = config.website;
    if (typeof config.logo === 'string') updateMinistry.logo_url = config.logo;

    if (Object.keys(updateMinistry).length > 0) {
        await supabase
            .from('ministries')
            .update(updateMinistry)
            .eq('id', ministryId);
    }

    const { data: configRow } = await supabase
        .from('configurations')
        .select('church_profile')
        .eq('ministry_id', ministryId)
        .maybeSingle();

    const existingProfile = (configRow as any)?.church_profile || {};
    const nextProfile = {
        ...existingProfile,
        ...(typeof config.endereco === 'string' ? { endereco: config.endereco } : {}),
        ...(typeof config.responsavel === 'string' ? { responsavel: config.responsavel } : {})
    };

    await supabase
        .from('configurations')
        .upsert(
            {
                ministry_id: ministryId,
                church_profile: nextProfile,
                updated_at: new Date().toISOString(),
            } as any,
            { onConflict: 'ministry_id' }
        );
}
