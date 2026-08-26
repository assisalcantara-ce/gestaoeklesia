// Utilitário para gerenciar configurações da igreja/ministério via API Backend Next.js (/api/v1/configuracoes/perfil)
// Utiliza exclusivamente o cliente HTTP centralizado da plataforma (authenticatedFetch),
// garantindo envio automático de Authorization (Bearer token) da sessão nativa Supabase.

import { authenticatedFetch } from '@/lib/api-client';

export interface ConfiguracaoIgreja {
    id?: string;
    slug?: string;
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
 * Busca as configurações da igreja/ministério via API Backend (/api/v1/configuracoes/perfil)
 * utilizando o cliente HTTP centralizado (authenticatedFetch).
 *
 * @param _supabase  Parâmetro mantido por retrocompatibilidade de assinatura.
 * @param _ministryId  Parâmetro mantido por retrocompatibilidade de assinatura.
 */
export async function fetchConfiguracaoIgrejaFromSupabase(
    _supabase?: any,
    _ministryId?: string | null
): Promise<ConfiguracaoIgreja> {
    console.log('[DIAGNOSTICO UTILS] Início da chamada fetchConfiguracaoIgrejaFromSupabase() via authenticatedFetch');
    try {
        const res = await authenticatedFetch('/api/v1/configuracoes/perfil', {
            method: 'GET',
            cache: 'no-store',
        });

        console.log('[DIAGNOSTICO UTILS] Status HTTP retornado por authenticatedFetch:', res.status, res.statusText);

        if (!res.ok) {
            console.error('[DIAGNOSTICO UTILS] Erro na requisição GET /api/v1/configuracoes/perfil:', res.status, res.statusText);
            return CONFIGURACAO_PADRAO;
        }

        const json = await res.json();
        console.log('[DIAGNOSTICO UTILS] JSON recebido da API:', JSON.stringify(json));

        if (json?.data) {
            console.log('[DIAGNOSTICO UTILS] Objeto final retornado pela função (json.data):', json.data);
            return json.data as ConfiguracaoIgreja;
        }

        return CONFIGURACAO_PADRAO;
    } catch (err) {
        console.error('[DIAGNOSTICO UTILS] Exceção ao buscar configuração da igreja via API:', err);
        return CONFIGURACAO_PADRAO;
    }
}

/**
 * Atualiza as configurações da igreja/ministério via API Backend (/api/v1/configuracoes/perfil)
 * utilizando o cliente HTTP centralizado (authenticatedFetch).
 *
 * @param _supabase  Parâmetro mantido por retrocompatibilidade de assinatura.
 * @param config  Campos a atualizar.
 * @param _ministryId  Parâmetro mantido por retrocompatibilidade de assinatura.
 */
export async function updateConfiguracaoIgrejaInSupabase(
    _supabase: any,
    config: Partial<ConfiguracaoIgreja>,
    _ministryId?: string | null
): Promise<void> {
    console.log('[DIAGNOSTICO UTILS] Início de updateConfiguracaoIgrejaInSupabase() via authenticatedFetch. Payload:', config);
    const res = await authenticatedFetch('/api/v1/configuracoes/perfil', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    });

    console.log('[DIAGNOSTICO UTILS] Status HTTP do PUT:', res.status);

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error('[DIAGNOSTICO UTILS] Erro no PUT:', errJson);
        throw new Error(errJson.error || errJson.detail || 'Erro ao salvar configurações do ministério via API.');
    }
}
