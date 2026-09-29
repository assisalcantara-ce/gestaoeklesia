'use client';

/**
 * EbdSidebarMenu — menu operacional simplificado do módulo EBD com visual integrado ao novo Sidebar institucional.
 *
 * Estrutura:
 * EBD (raiz)
 * ├─ Dashboard             (/ebd/dashboard)
 * ├─ Chamada Dominical     (/ebd/chamada)
 * ├─ Turmas                (/ebd/turmas)
 * ├─ Alunos & Matrículas   (/ebd/alunos)
 * ├─ Professores           (/ebd/cadastro/professores)
 * ├─ Trimestres            (/ebd/trimestres)
 * ├─ Revistas / Pedidos    (/ebd/revistas)
 * ├─ Classes               (/ebd/cadastro/classes)
 * ├─ Relatórios            (/ebd/relatorios)
 * └─ Ofertas EBD           (/ebd/ofertas)
 */

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// ─── Tipo ────────────────────────────────────────────────────────────────────

interface EbdNode {
  /** Identificador único — usado como activeMenu nas páginas */
  id: string;
  /** Texto exibido no menu */
  label: string;
  /** Rota de navegação */
  path: string;
  /** IDs adicionais correspondentes a este item de menu para highlight */
  matchIds?: string[];
  /** Filhos opcionais se houver agrupador */
  children?: EbdNode[];
}

// ─── Árvore de dados EBD Simplificada ────────────────────────────────────────

export const EBD_TREE: EbdNode[] = [
  {
    id: 'ebd-dashboard',
    label: 'Dashboard',
    path: '/ebd/dashboard',
    matchIds: ['ebd-dashboard', 'ebd-dashboard-geral', 'ebd-dashboard-local'],
  },
  {
    id: 'ebd-aulas-frequencia',
    label: 'Chamada Dominical',
    path: '/ebd/chamada',
    matchIds: ['ebd-chamada', 'ebd-aulas-frequencia'],
  },
  {
    id: 'ebd-cadastro-turmas',
    label: 'Turmas',
    path: '/ebd/turmas',
    matchIds: ['ebd-turmas', 'ebd-cadastro-turmas'],
  },
  {
    id: 'ebd-cadastro-alunos',
    label: 'Alunos & Matrículas',
    path: '/ebd/alunos',
    matchIds: ['ebd-alunos', 'ebd-cadastro-alunos', 'ebd-cadastro-alunos-carteirinha'],
  },
  {
    id: 'ebd-cadastro-professores',
    label: 'Professores',
    path: '/ebd/cadastro/professores',
    matchIds: ['ebd-professores', 'ebd-cadastro-professores', 'ebd-cadastro-superintendente'],
  },
  {
    id: 'ebd-trimestres',
    label: 'Trimestres',
    path: '/ebd/trimestres',
    matchIds: ['ebd-trimestres', 'ebd-aulas-trimestres'],
  },
  {
    id: 'ebd-pedidos-revistas',
    label: 'Revistas / Pedidos',
    path: '/ebd/revistas',
    matchIds: ['ebd-revistas', 'ebd-pedidos-revistas', 'ebd-pedidos'],
  },
  {
    id: 'ebd-cadastro-classes',
    label: 'Classes',
    path: '/ebd/cadastro/classes',
    matchIds: ['ebd-classes', 'ebd-cadastro-classes'],
  },
  {
    id: 'ebd-relatorios',
    label: 'Relatórios Consolidados',
    path: '/ebd/relatorios',
    matchIds: [
      'ebd-relatorios',
      'ebd-relatorios-boletim',
      'ebd-relatorios-historico',
      'ebd-relatorios-aniversariantes',
      'ebd-relatorios-professores',
      'ebd-relatorios-alunos',
      'ebd-historico',
    ],
  },
  {
    id: 'ebd-caixa',
    label: 'Ofertas EBD',
    path: '/ebd/ofertas',
    matchIds: ['ebd-caixa', 'ebd-ofertas'],
  },
];

// ─── Conjunto de todos os IDs EBD (para uso externo no parentMap) ─────────────

function collectAllIds(nodes: EbdNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (node.matchIds) ids.push(...node.matchIds);
    if (node.children) ids.push(...collectAllIds(node.children));
  }
  return [...new Set(ids)];
}

export const ALL_EBD_IDS = collectAllIds(EBD_TREE);

// ─── Helper: retorna cadeia de ancestrais de um ID ────────────────────────────

function findAncestors(
  nodes: EbdNode[],
  targetId: string,
  path: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId || (node.matchIds && node.matchIds.includes(targetId))) return path;
    if (node.children) {
      const found = findAncestors(node.children, targetId, [...path, node.id]);
      if (found !== null) return found;
    }
  }
  return null;
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface EbdSidebarMenuProps {
  activeMenu: string;
  /** Callback fornecido pelo Sidebar pai — faz router.push + fecha menu mobile */
  onNavigate: (id: string, path: string) => void;
}

export default function EbdSidebarMenu({ activeMenu, onNavigate }: EbdSidebarMenuProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ancestors = findAncestors(EBD_TREE, activeMenu);
    if (ancestors && ancestors.length > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        ancestors.forEach(id => next.add(id));
        return next;
      });
    }
  }, [activeMenu]);

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const renderNode = (node: EbdNode, depth: number) => {
    const isExpanded = expanded.has(node.id);
    const isActive =
      activeMenu === node.id || (node.matchIds && node.matchIds.includes(activeMenu));
    const hasChildren = !!node.children?.length;

    const paddingClass =
      depth === 0 ? 'pl-11' : depth === 1 ? 'pl-14' : 'pl-16';

    const handleClick = () => {
      if (hasChildren) {
        toggleExpanded(node.id);
        if (node.path) onNavigate(node.id, node.path);
      } else if (node.path) {
        onNavigate(node.id, node.path);
      }
    };

    return (
      <div key={node.id}>
        <button
          onClick={handleClick}
          className={`w-full flex items-center gap-2.5 py-2 pr-4 text-left transition-all duration-150 text-[13px] ${paddingClass} ${
            isActive
              ? 'text-cyan-300 font-semibold bg-cyan-500/10'
              : 'text-slate-300/80 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors flex-shrink-0 ${
              isActive ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-500/60'
            }`}
          />
          <span className="flex-1 leading-snug truncate">{node.label}</span>
          {hasChildren && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                isExpanded ? 'rotate-180 text-cyan-400' : ''
              }`}
            />
          )}
        </button>

        {hasChildren && isExpanded && (
          <div className={depth === 0 ? 'bg-black/20' : ''}>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-[#061423]/90 py-1.5 border-t border-b border-white/[0.06]">
      {EBD_TREE.map(node => renderNode(node, 0))}
    </div>
  );
}
