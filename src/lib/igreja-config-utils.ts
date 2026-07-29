// Utilitário para gerenciar configurações da igreja/ministério via API Backend Next.js (/api/v1/configuracoes/perfil)
// ELIMINADA toda consulta client-side direta via Supabase Browser Client para as tabelas ministries e configurations.

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
 * Obtém os cabeçalhos HTTP necessários para chamadas à API Next.js,
 * incluindo o token de impersonação quando ativo.
 */
function getApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (typeof window !== 'undefined') {
        const impToken = sessionStorage.getItem('eklesia_impersonation_token') || localStorage.getItem('eklesia_impersonation_token');
        if (impToken) {
            headers['x-impersonation-token'] = impToken;
        }
    }

    return headers;
}

/**
 * Busca as configurações da igreja/ministério exclusivamente via API Backend (/api/v1/configuracoes/perfil).
 * O backend utiliza `resolveTenantAuth()` e `createAdminClient()` (service_role) para resolver o tenant
 * correto tanto em sessões nativas quanto em sessões de impersonação, sem restrições de RLS.
 *
 * @param _supabase  Parâmetro mantido por retrocompatibilidade de assinatura com os consumidores existentes, porém NÃO utilizado para queries no banco.
 * @param _ministryId  Parâmetro mantido por retrocompatibilidade de assinatura.
 */
export async function fetchConfiguracaoIgrejaFromSupabase(
    _supabase?: any,
    _ministryId?: string | null
): Promise<ConfiguracaoIgreja> {
    try {
        const res = await fetch('/api/v1/configuracoes/perfil', {
            method: 'GET',
            headers: getApiHeaders(),
            cache: 'no-store',
        });

        if (!res.ok) {
            console.error('[igreja-config-utils] Erro na requisição GET /api/v1/configuracoes/perfil:', res.status, res.statusText);
            return CONFIGURACAO_PADRAO;
        }

        const json = await res.json();
        if (json?.data) {
            return json.data as ConfiguracaoIgreja;
        }

        return CONFIGURACAO_PADRAO;
    } catch (err) {
        console.error('[igreja-config-utils] Exceção ao buscar configuração da igreja via API:', err);
        return CONFIGURACAO_PADRAO;
    }
}

/**
 * Atualiza as configurações da igreja/ministério exclusivamente via API Backend (/api/v1/configuracoes/perfil).
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
    const res = await fetch('/api/v1/configuracoes/perfil', {
        method: 'PUT',
        headers: getApiHeaders(),
        body: JSON.stringify(config),
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || errJson.detail || 'Erro ao salvar configurações do ministério via API.');
    }
}
