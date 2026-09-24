// Utilitário para gerenciar cargos ministeriais compartilhados entre páginas

export interface CargoMinisterial {
    id: number;
    nome: string;
    ativo: boolean;
}

const STORAGE_KEY = 'gestaoeklesia_cargos_ministeriais';

// Lista padrão de cargos ministeriais nativos do sistema
export const CARGOS_PADRAO: CargoMinisterial[] = [
    { id: 1, nome: 'Auxiliar', ativo: true },
    { id: 2, nome: 'Obreiro(a)', ativo: true },
    { id: 3, nome: 'Diácono', ativo: true },
    { id: 4, nome: 'Diaconisa', ativo: true },
    { id: 5, nome: 'Presbítero', ativo: true },
    { id: 6, nome: 'Missionário(a)', ativo: true },
    { id: 7, nome: 'Evangelista', ativo: true },
    { id: 8, nome: 'Pastor', ativo: true }
];

export const CARGOS_NATIVOS_NOMES = [
    'Auxiliar',
    'Obreiro(a)',
    'Diácono',
    'Diaconisa',
    'Presbítero',
    'Missionário(a)',
    'Evangelista',
    'Pastor'
];

/**
 * Normaliza lista de cargos ministeriais (migra nomenclaturas antigas)
 */
export function normalizeCargosMinisteriais(cargos: unknown): CargoMinisterial[] {
    if (!Array.isArray(cargos) || cargos.length === 0) {
        return CARGOS_PADRAO;
    }

    const result: CargoMinisterial[] = [];
    const seenNames = new Set<string>();

    for (const c of cargos) {
        if (!c || typeof c !== 'object') continue;
        let nome = String((c as any).nome || '').trim();
        if (!nome) continue;

        // Migração de nomenclaturas antigas:
        // Remover "Missionária" separada
        if (nome.toLowerCase() === 'missionária' || nome.toLowerCase() === 'missionaria') {
            continue;
        }
        // Transformar "Missionário" em "Missionário(a)"
        if (nome.toLowerCase() === 'missionário' || nome.toLowerCase() === 'missionario') {
            nome = 'Missionário(a)';
        }

        const norm = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (seenNames.has(norm)) continue;
        seenNames.add(norm);

        result.push({
            id: Number((c as any).id) || result.length + 1,
            nome,
            ativo: (c as any).ativo !== false,
        });
    }

    // Garantir que Obreiro(a) esteja na lista se ainda não existir
    const hasObreiro = result.some(c => {
        const n = c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return n.includes('obreiro');
    });
    if (!hasObreiro) {
        const nextId = Math.max(...result.map(c => c.id), 0) + 1;
        const auxIdx = result.findIndex(c => c.nome.toLowerCase().includes('auxiliar'));
        const obreiroObj: CargoMinisterial = { id: nextId, nome: 'Obreiro(a)', ativo: true };
        if (auxIdx >= 0) {
            result.splice(auxIdx + 1, 0, obreiroObj);
        } else {
            result.unshift(obreiroObj);
        }
    }

    // Garantir que Missionário(a) esteja presente
    const hasMissionario = result.some(c => {
        const n = c.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return n.includes('missionario');
    });
    if (!hasMissionario) {
        const nextId = Math.max(...result.map(c => c.id), 0) + 1;
        result.push({ id: nextId, nome: 'Missionário(a)', ativo: true });
    }

    return result;
}

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
            return normalizeCargosMinisteriais(JSON.parse(stored));
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
