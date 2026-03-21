// Utilitário para gerenciar cargos ministeriais compartilhados entre páginas

export interface CargoMinisterial {
    id: number;
    nome: string;
    ativo: boolean;
}

const STORAGE_KEY = 'gestaoeclesial_cargos_ministeriais';

// Lista padrão de cargos ministeriais
const CARGOS_PADRAO: CargoMinisterial[] = [
    { id: 1, nome: 'Auxiliar', ativo: true },
    { id: 2, nome: 'Diácono', ativo: true },
    { id: 3, nome: 'Diaconisa', ativo: true },
    { id: 4, nome: 'Presbítero', ativo: true },
    { id: 5, nome: 'Missionário', ativo: true },
    { id: 6, nome: 'Missionária', ativo: true },
    { id: 7, nome: 'Evangelista', ativo: true },
    { id: 8, nome: 'Pastor', ativo: true }
];

/**
 * Obtém a lista de cargos ministeriais do localStorage
 * Se não existir, retorna a lista padrão
 */
export function getCargosMinisteriais(): CargoMinisterial[] {
    if (typeof window === 'undefined') {
        return CARGOS_PADRAO;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Erro ao carregar cargos ministeriais:', error);
    }

    return CARGOS_PADRAO;
}

/**
 * Salva a lista de cargos ministeriais no localStorage
 */
export function saveCargosMinisteriais(cargos: CargoMinisterial[]): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cargos));
    } catch (error) {
        console.error('Erro ao salvar cargos ministeriais:', error);
    }
}
